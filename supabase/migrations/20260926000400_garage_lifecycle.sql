-- Serialize garage changes per owner. The first saved car becomes current.
create function public.initial_user_vehicle_default() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  if not exists (select 1 from public.user_vehicles where user_id = new.user_id and is_default) then
    new.is_default := true;
  end if;
  return new;
end;
$$;
create trigger user_vehicle_initial_default before insert on public.user_vehicles
for each row execute function public.initial_user_vehicle_default();

-- Repair garages created before automatic first/current selection was available.
update public.user_vehicles v set is_default = true
where v.id in (select distinct on (user_id) id from public.user_vehicles
where user_id not in (select user_id from public.user_vehicles where is_default)
order by user_id, created_at, id);

create function public.remove_user_vehicle(p_user_vehicle_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare current_user_id uuid := auth.uid(); replacement_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));
  delete from public.user_vehicles where id = p_user_vehicle_id and user_id = current_user_id;
  if not found then raise exception 'Vehicle not found in your garage'; end if;
  if not exists (select 1 from public.user_vehicles where user_id = current_user_id and is_default) then
    select id into replacement_id from public.user_vehicles where user_id = current_user_id order by created_at, id limit 1;
    if replacement_id is not null then update public.user_vehicles set is_default = true where id = replacement_id and user_id = current_user_id; end if;
  end if;
end;
$$;
revoke all on function public.initial_user_vehicle_default() from public, anon, authenticated;
revoke all on function public.remove_user_vehicle(uuid) from public, anon;
grant execute on function public.remove_user_vehicle(uuid) to authenticated;

-- Bound an explicit user efficiency override while keeping catalogue estimates separate.
alter table public.user_vehicles add constraint user_vehicle_efficiency_range
check (efficiency_override is null or efficiency_override between 0.5 and 10) not valid;
