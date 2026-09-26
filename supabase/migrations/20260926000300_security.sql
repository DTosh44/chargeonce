begin;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.user_vehicles enable row level security;
alter table public.operators enable row level security;
alter table public.charging_locations enable row level security;
alter table public.evses enable row level security;
alter table public.connectors enable row level security;
alter table public.tariffs enable row level security;
alter table public.facilities enable row level security;
alter table public.location_facilities enable row level security;
alter table public.charger_status_history enable row level security;
alter table public.favourites enable row level security;
alter table public.user_reports enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_stops enable row level security;
alter table public.community_chargers enable row level security;
alter table public.community_availability enable row level security;

-- Limit grants explicitly; never rely on RLS alone or change unrelated tables.
revoke all on public.profiles, public.vehicles, public.user_vehicles, public.operators,
  public.charging_locations, public.evses, public.connectors, public.tariffs,
  public.facilities, public.location_facilities, public.charger_status_history,
  public.favourites, public.user_reports, public.journeys, public.journey_stops,
  public.community_chargers, public.community_availability from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.vehicles, public.operators, public.charging_locations, public.evses,
  public.connectors, public.tariffs, public.facilities, public.location_facilities,
  public.charger_status_history to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.user_vehicles,
  public.favourites, public.journeys, public.journey_stops to authenticated;
-- Community provisioning is reserved for trusted backend work in a future release.
grant select on public.community_chargers, public.community_availability to authenticated;
grant select, insert, delete on public.user_reports to authenticated;

create policy vehicles_read on public.vehicles for select to anon, authenticated using (true);
create policy operators_read on public.operators for select to anon, authenticated using (true);
create policy facilities_read on public.facilities for select to anon, authenticated using (true);
create policy locations_public_read on public.charging_locations for select to anon, authenticated
  using (is_public and not is_community and access_type <> 'private');
create policy evses_public_read on public.evses for select to anon, authenticated
  using (exists(select 1 from public.charging_locations l where l.id = location_id));
create policy connectors_public_read on public.connectors for select to anon, authenticated
  using (exists(select 1 from public.evses e where e.id = evse_id));
create policy tariffs_public_read on public.tariffs for select to anon, authenticated
  using (exists(select 1 from public.charging_locations l where l.id = location_id));
create policy location_facilities_public_read on public.location_facilities for select to anon, authenticated
  using (exists(select 1 from public.charging_locations l where l.id = location_id));
create policy history_public_read on public.charger_status_history for select to anon, authenticated
  using (exists(select 1 from public.evses e where e.id = evse_id));

create policy profiles_owner on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy garage_owner on public.user_vehicles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy favourites_owner on public.favourites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.charging_locations l where l.id = location_id));
create policy reports_owner_read on public.user_reports for select to authenticated using (user_id = (select auth.uid()));
create policy reports_owner_delete on public.user_reports for delete to authenticated using (user_id = (select auth.uid()));
-- Null user IDs are reserved for trusted ingestion or account-deletion anonymisation.
-- Anonymous browser reports are intentionally not accepted (spam/identity spoofing).
create policy reports_owner_insert on public.user_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and exists(select 1 from public.charging_locations l where l.id = location_id));
create policy journeys_owner on public.journeys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy journey_stops_owner on public.journey_stops for all to authenticated
  using (exists(select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())))
  with check (exists(select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid()))
    and exists(select 1 from public.charging_locations l where l.id = location_id));
create policy community_chargers_owner on public.community_chargers for select to authenticated
  using (owner_id = (select auth.uid()));
create policy community_availability_owner on public.community_availability for select to authenticated
  using (exists(select 1 from public.community_chargers c where c.id = community_charger_id and c.owner_id = (select auth.uid())));

commit;
