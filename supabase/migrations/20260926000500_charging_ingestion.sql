begin;

-- Normalised snapshots preserve unknown tariffs and aggregate connections without
-- fabricating individual EVSEs, available stalls, or zero-price tariff records.
create table public.charging_source_snapshots (
  location_id uuid primary key references public.charging_locations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(provider, external_id),
  check (snapshot->>'provider' = provider),
  check (snapshot->>'externalId' = external_id)
);
create index charging_source_snapshots_region_idx on public.charging_source_snapshots(provider, latitude, longitude);
create index charging_source_snapshots_fetched_idx on public.charging_source_snapshots(provider, fetched_at);
create trigger charging_source_snapshots_updated_at before update on public.charging_source_snapshots
  for each row execute function public.set_updated_at();
alter table public.charging_source_snapshots enable row level security;
revoke all on public.charging_source_snapshots from anon, authenticated;
grant select on public.charging_source_snapshots to anon, authenticated;
create policy snapshots_public_read on public.charging_source_snapshots for select to anon, authenticated
  using (exists(select 1 from public.charging_locations l where l.id=location_id and l.is_public and not l.is_community and l.access_type <> 'private'));

-- One bounded batch is atomic. No deletions: truncated/empty pages cannot erase data.
-- Serialize a provider's imports so concurrent workers cannot regress snapshots.
create function public.import_charging_sites(p_provider text, p_sites jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  site jsonb;
  operator_data jsonb;
  operator_uuid uuid;
  location_uuid uuid;
  fetched timestamptz;
  affected integer := 0;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9-]{1,49}$' or p_provider in ('mock', 'chargeonce-demo', 'chargeonce_demo') then
    raise exception 'Invalid external provider';
  end if;
  if jsonb_typeof(p_sites) is distinct from 'array' or jsonb_array_length(p_sites)>200 or octet_length(p_sites::text)>4000000 then
    raise exception 'Invalid import batch';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_provider));
  for site in select value from jsonb_array_elements(p_sites) loop
    if site->>'provider' is distinct from p_provider or site#>>'{provenance,kind}' not in ('external','live')
       or site#>>'{provenance,kind}' is null or coalesce(length(site->>'id'),0) not between 1 and 100
       or coalesce(length(site->>'externalId'),0) not between 1 and 100
       or site->>'isPublic' is distinct from 'true' or site->>'accessType' is distinct from 'public'
       or site->>'canImport' is distinct from 'true'
       or jsonb_typeof(site->'connectors') is distinct from 'array'
       or coalesce(length(site#>>'{operator,id}'),0) not between 1 and 100 then
      raise exception 'Invalid normalised public location';
    end if;
    fetched := (site#>>'{provenance,fetchedAt}')::timestamptz;
    if fetched is null or fetched > now() + interval '5 minutes' then raise exception 'Invalid fetch timestamp'; end if;
    -- Do not regress a newer fetched snapshot on retries or concurrent jobs.
    if exists(select 1 from public.charging_source_snapshots s where s.provider=p_provider and s.external_id=site->>'externalId' and s.fetched_at>fetched) then continue; end if;
    operator_data := site->'operator';
    operator_uuid := md5(p_provider || ':operator:' || (operator_data->>'id'))::uuid;
    insert into public.operators(id,name,slug,website,logo_url)
      values(operator_uuid,operator_data->>'name',p_provider || '-' || md5(operator_data->>'id'),operator_data->>'website',operator_data->>'logoUrl')
      on conflict(id) do update set name=excluded.name, website=excluded.website, logo_url=excluded.logo_url;
    location_uuid := md5(p_provider || ':location:' || (site->>'externalId'))::uuid;
    insert into public.charging_locations(id,external_id,provider,operator_id,name,address,postcode,latitude,longitude,access_type,is_public,is_demo,last_updated)
      values(location_uuid,site->>'externalId',p_provider,operator_uuid,site->>'name',site->>'address',site->>'postcode',
        (site->>'latitude')::double precision,(site->>'longitude')::double precision,'public',true,false,
        coalesce((site#>>'{provenance,observedAt}')::timestamptz,fetched))
      on conflict(provider,external_id) do update set operator_id=excluded.operator_id,name=excluded.name,address=excluded.address,postcode=excluded.postcode,
        latitude=excluded.latitude,longitude=excluded.longitude,last_updated=excluded.last_updated
        where not charging_locations.is_demo and not charging_locations.is_community
      returning id into location_uuid;
    if location_uuid is null then raise exception 'Cannot overwrite protected location'; end if;
    insert into public.charging_source_snapshots(location_id,provider,external_id,latitude,longitude,snapshot,fetched_at)
      values(location_uuid,p_provider,site->>'externalId',(site->>'latitude')::double precision,(site->>'longitude')::double precision,site,fetched)
      on conflict(location_id) do update set snapshot=excluded.snapshot,fetched_at=excluded.fetched_at,latitude=excluded.latitude,longitude=excluded.longitude;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;
revoke all on function public.import_charging_sites(text,jsonb) from public, anon, authenticated;
grant execute on function public.import_charging_sites(text,jsonb) to service_role;

commit;
