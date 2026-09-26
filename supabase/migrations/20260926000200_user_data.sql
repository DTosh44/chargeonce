begin;

create type public.report_type as enum ('working', 'not_working', 'queue', 'payment_problem', 'slow_charging', 'blocked_bay', 'incorrect_availability');
create type public.route_mode as enum ('balanced', 'cheapest', 'fastest');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 120),
  postcode text check (length(postcode) <= 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 120));
  return new;
end;
$$;
create trigger auth_user_profile after insert on auth.users for each row execute function public.create_user_profile();
revoke all on function public.create_user_profile() from public;
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 120) from auth.users on conflict(id) do nothing;

create table public.user_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  nickname text check (length(nickname) <= 100),
  registration text check (length(registration) <= 16),
  is_default boolean not null default false,
  efficiency_override numeric(7,3) check (efficiency_override > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.user_vehicles.efficiency_override is 'Driver-specific miles per kWh, not kWh per mile.';
-- At most one default; users may have none before selecting a car or after removing it.
create unique index user_vehicles_one_default_idx on public.user_vehicles(user_id) where is_default;
create index user_vehicles_user_idx on public.user_vehicles(user_id);
create index user_vehicles_vehicle_idx on public.user_vehicles(vehicle_id);
create trigger user_vehicles_updated_at before update on public.user_vehicles for each row execute function public.set_updated_at();

create function public.set_default_user_vehicle(p_user_vehicle_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Serialise concurrent switches for this user; RLS still governs every update.
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  if not exists(select 1 from public.user_vehicles where id = p_user_vehicle_id and user_id = current_user_id) then
    raise exception 'Vehicle is not in your garage' using errcode = '42501';
  end if;
  update public.user_vehicles set is_default = false where user_id = current_user_id and is_default;
  update public.user_vehicles set is_default = true where id = p_user_vehicle_id and user_id = current_user_id;
end;
$$;
revoke all on function public.set_default_user_vehicle(uuid) from public;
grant execute on function public.set_default_user_vehicle(uuid) to authenticated;

create table public.favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.charging_locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, location_id)
);
create index favourites_location_idx on public.favourites(location_id);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  location_id uuid not null references public.charging_locations(id) on delete cascade,
  evse_id uuid,
  report_type public.report_type not null,
  comment text check (length(comment) <= 2000),
  created_at timestamptz not null default now(),
  -- Prevent reports from attaching an EVSE at a different location.
  foreign key(evse_id, location_id) references public.evses(id, location_id) on delete set null (evse_id)
);
create index user_reports_user_time_idx on public.user_reports(user_id, created_at desc);
create index user_reports_location_time_idx on public.user_reports(location_id, created_at desc);
create index user_reports_evse_idx on public.user_reports(evse_id);

-- Keep only non-identifying operational reports after deleting an account.
create function public.scrub_deleted_profile_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.user_reports set comment = null where user_id = old.id;
  return old;
end;
$$;
create trigger profile_report_privacy before delete on public.profiles for each row execute function public.scrub_deleted_profile_reports();
revoke all on function public.scrub_deleted_profile_reports() from public;

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  origin jsonb not null check (jsonb_typeof(origin) = 'object' and origin ? 'label' and jsonb_typeof(origin->'label') = 'string' and length(trim(origin->>'label')) > 0),
  destination jsonb not null check (jsonb_typeof(destination) = 'object' and destination ? 'label' and jsonb_typeof(destination->'label') = 'string' and length(trim(destination->>'label')) > 0),
  starting_battery_percent numeric(5,2) not null check (starting_battery_percent between 0 and 100),
  minimum_arrival_percent numeric(5,2) not null default 10 check (minimum_arrival_percent between 0 and 100),
  route_mode public.route_mode not null default 'balanced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journeys_user_time_idx on public.journeys(user_id, created_at desc);
create index journeys_vehicle_idx on public.journeys(vehicle_id);
create trigger journeys_updated_at before update on public.journeys for each row execute function public.set_updated_at();

create table public.journey_stops (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  location_id uuid not null references public.charging_locations(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  arrival_battery_percent numeric(5,2) not null check (arrival_battery_percent between 0 and 100),
  departure_battery_percent numeric(5,2) not null check (departure_battery_percent between arrival_battery_percent and 100),
  estimated_minutes numeric(8,2) not null check (estimated_minutes >= 0),
  estimated_cost numeric(10,2) not null check (estimated_cost >= 0),
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  primary key(journey_id, sequence)
);
create index journey_stops_location_idx on public.journey_stops(location_id);

-- Reserved for a later feature. No public access, booking or payment functionality.
create table public.community_chargers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null unique references public.charging_locations(id) on delete cascade,
  description text check (length(description) <= 2000),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_chargers_owner_idx on public.community_chargers(owner_id);
create trigger community_chargers_updated_at before update on public.community_chargers for each row execute function public.set_updated_at();
create function public.validate_community_location() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.charging_locations where id = new.location_id and is_community and not is_public) then
    raise exception 'Community charger requires a private community location' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger community_private_location before insert or update of location_id on public.community_chargers for each row execute function public.validate_community_location();
revoke all on function public.validate_community_location() from public;
create table public.community_availability (
  id uuid primary key default gen_random_uuid(),
  community_charger_id uuid not null references public.community_chargers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_charger_id, starts_at, ends_at)
);
create index community_availability_charger_time_idx on public.community_availability(community_charger_id, starts_at);
create trigger community_availability_updated_at before update on public.community_availability for each row execute function public.set_updated_at();

-- Remove private home locations as well as ownership links on account deletion.
create function public.cleanup_user_community_locations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.journeys where user_id = old.id;
  delete from public.charging_locations l using public.community_chargers c
  where c.owner_id = old.id and c.location_id = l.id and l.is_community and not l.is_public;
  return old;
end;
$$;
create trigger profile_community_cleanup before delete on public.profiles for each row execute function public.cleanup_user_community_locations();
revoke all on function public.cleanup_user_community_locations() from public;

commit;
