-- ChargeOnce catalogue. All monetary amounts are major currency units (GBP pounds).
-- This migration is intended for a dedicated Supabase project, not the VisitMade DB.
begin;

create type public.connector_type as enum ('CCS', 'Type 2', 'CHAdeMO');
create type public.evse_status as enum ('available', 'charging', 'occupied', 'unavailable', 'faulted', 'unknown');
create type public.access_type as enum ('public', 'customers', 'restricted', 'private');
create type public.parking_fee_unit as enum ('per_hour', 'per_session');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null check (length(trim(manufacturer)) between 1 and 100),
  model text not null check (length(trim(model)) between 1 and 100),
  variant text not null default '',
  model_year smallint check (model_year between 1990 and 2100),
  usable_battery_kwh numeric(7,2) not null check (usable_battery_kwh > 0),
  gross_battery_kwh numeric(7,2) check (gross_battery_kwh >= usable_battery_kwh),
  max_ac_kw numeric(7,2) not null check (max_ac_kw > 0),
  max_dc_kw numeric(7,2) not null check (max_dc_kw >= 0),
  connector_types public.connector_type[] not null check (cardinality(connector_types) > 0 and array_position(connector_types, null) is null),
  efficiency_miles_per_kwh numeric(7,3) not null check (efficiency_miles_per_kwh > 0),
  estimated_range_miles numeric(7,2) not null check (estimated_range_miles > 0),
  charging_curve jsonb not null default '[]'::jsonb check (jsonb_typeof(charging_curve) = 'array'),
  source text not null check (length(trim(source)) > 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_manufacturer_model_idx on public.vehicles(manufacturer, model);
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();

create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  website text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger operators_updated_at before update on public.operators for each row execute function public.set_updated_at();

create table public.charging_locations (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  provider text not null,
  operator_id uuid not null references public.operators(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  address text not null,
  postcode text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  access_type public.access_type not null default 'public',
  opening_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(opening_hours) = 'object'),
  is_public boolean not null default true,
  is_community boolean not null default false,
  is_demo boolean not null default false,
  -- Presentational coordinates/distance are only allowed for the illustrative demo map.
  demo_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(demo_metadata) = 'object'),
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_id),
  unique(id, operator_id),
  unique(id, is_demo)
);
create index charging_locations_operator_idx on public.charging_locations(operator_id);
create index charging_locations_postcode_idx on public.charging_locations(postcode);
create index charging_locations_coordinates_idx on public.charging_locations(latitude, longitude);
create index charging_locations_catalogue_idx on public.charging_locations(is_public, is_community, is_demo);
create trigger charging_locations_updated_at before update on public.charging_locations for each row execute function public.set_updated_at();

create table public.evses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.charging_locations(id) on delete cascade,
  external_id text not null,
  status public.evse_status not null default 'unknown',
  last_status_update timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(location_id, external_id),
  unique(id, location_id)
);
create index evses_location_status_idx on public.evses(location_id, status);
create trigger evses_updated_at before update on public.evses for each row execute function public.set_updated_at();
create function public.touch_evse_status_time() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status is distinct from new.status and old.last_status_update is not distinct from new.last_status_update then
    new.last_status_update := now();
  end if;
  return new;
end;
$$;
create trigger evses_status_time before update on public.evses for each row execute function public.touch_evse_status_time();

create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  evse_id uuid not null references public.evses(id) on delete cascade,
  connector_type public.connector_type not null,
  max_power_kw numeric(7,2) not null check (max_power_kw > 0),
  voltage numeric(7,2) check (voltage > 0),
  amperage numeric(7,2) check (amperage > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index connectors_evse_idx on public.connectors(evse_id);
create index connectors_type_power_idx on public.connectors(connector_type, max_power_kw);
create trigger connectors_updated_at before update on public.connectors for each row execute function public.set_updated_at();

create table public.tariffs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  operator_id uuid not null,
  price_per_kwh numeric(10,4) not null check (price_per_kwh >= 0),
  connection_fee numeric(10,2) check (connection_fee >= 0),
  parking_fee numeric(10,2) check (parking_fee >= 0),
  parking_fee_unit public.parking_fee_unit not null default 'per_hour',
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  valid_from timestamptz,
  valid_to timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to > valid_from),
  foreign key (location_id, operator_id) references public.charging_locations(id, operator_id) on delete cascade,
  foreign key (location_id, is_demo) references public.charging_locations(id, is_demo) on delete cascade
);
comment on column public.tariffs.price_per_kwh is 'Major currency units per kWh, e.g. 0.69 GBP. NOT pence.';
comment on column public.tariffs.is_demo is 'Must match the location demo flag. Never present these prices as live.';
create index tariffs_location_validity_idx on public.tariffs(location_id, valid_from desc, valid_to);
create index tariffs_operator_idx on public.tariffs(operator_id);
create trigger tariffs_updated_at before update on public.tariffs for each row execute function public.set_updated_at();

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null
);
create table public.location_facilities (
  location_id uuid not null references public.charging_locations(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  primary key(location_id, facility_id)
);
create index location_facilities_facility_idx on public.location_facilities(facility_id);

create table public.charger_status_history (
  id uuid primary key default gen_random_uuid(),
  evse_id uuid not null references public.evses(id) on delete cascade,
  status public.evse_status not null,
  recorded_at timestamptz not null default now()
);
create index charger_status_history_evse_time_idx on public.charger_status_history(evse_id, recorded_at desc);

-- Ingestion updates an EVSE once; history is recorded automatically.
create function public.record_evse_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.charger_status_history(evse_id, status, recorded_at)
  values (new.id, new.status, new.last_status_update);
  return new;
end;
$$;
create trigger evse_initial_status after insert on public.evses for each row execute function public.record_evse_status();
create trigger evse_changed_status after update of status, last_status_update on public.evses
for each row when (old.status is distinct from new.status or old.last_status_update is distinct from new.last_status_update)
execute function public.record_evse_status();
revoke all on function public.record_evse_status() from public;

commit;
