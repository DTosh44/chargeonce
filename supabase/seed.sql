-- DEVELOPMENT DEMO DATA ONLY. Network names do not imply affiliation or live data.
-- All locations, availability, prices and vehicle specifications are illustrative.
-- Idempotent: only these deterministic demo IDs are upserted; no users are created.
begin;

insert into public.vehicles(id, manufacturer, model, variant, model_year,
  usable_battery_kwh, gross_battery_kwh, max_ac_kw, max_dc_kw, connector_types,
  efficiency_miles_per_kwh, estimated_range_miles, charging_curve, source, is_demo)
values
 ('10000000-0000-4000-8000-000000000001', 'Tesla', 'Model 3', 'RWD', 2024, 60, 62, 11, 170, '{CCS,"Type 2"}', 4.5, 270, '[{"batteryPercent":20,"powerKw":170},{"batteryPercent":50,"powerKw":110},{"batteryPercent":80,"powerKw":50}]', 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000002', 'Volkswagen', 'ID.3', 'Pro', 2024, 58, 62, 11, 120, '{CCS,"Type 2"}', 4.569, 265, '[{"batteryPercent":20,"powerKw":120},{"batteryPercent":50,"powerKw":80},{"batteryPercent":80,"powerKw":45}]', 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000003', 'Hyundai', 'Kona Electric', '64 kWh', 2024, 64, 67, 11, 100, '{CCS,"Type 2"}', 4.531, 290, '[{"batteryPercent":20,"powerKw":100},{"batteryPercent":50,"powerKw":75},{"batteryPercent":80,"powerKw":35}]', 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000004', 'Kia', 'EV6', 'GT-Line S', 2024, 74, 77.4, 11, 240, '{CCS,"Type 2"}', 3.9, 288.6, '[{"batteryPercent":20,"powerKw":240},{"batteryPercent":50,"powerKw":210},{"batteryPercent":80,"powerKw":70}]', 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000005', 'Nissan', 'Leaf', 'Tekna 40 kWh', 2023, 39, 40, 6.6, 50, '{CHAdeMO,"Type 2"}', 3.85, 150.15, '[{"batteryPercent":20,"powerKw":50},{"batteryPercent":50,"powerKw":40},{"batteryPercent":80,"powerKw":22}]', 'chargeonce_demo', true)
on conflict(id) do update set manufacturer=excluded.manufacturer, model=excluded.model,
  variant=excluded.variant, model_year=excluded.model_year, usable_battery_kwh=excluded.usable_battery_kwh,
  gross_battery_kwh=excluded.gross_battery_kwh, max_ac_kw=excluded.max_ac_kw, max_dc_kw=excluded.max_dc_kw,
  connector_types=excluded.connector_types, efficiency_miles_per_kwh=excluded.efficiency_miles_per_kwh,
  estimated_range_miles=excluded.estimated_range_miles, charging_curve=excluded.charging_curve,
  source=excluded.source, is_demo=true;

-- Starter UK catalogue, not exhaustive or certified specifications.
insert into public.vehicles(id, manufacturer, model, variant, model_year,
  usable_battery_kwh, max_ac_kw, max_dc_kw, connector_types,
  efficiency_miles_per_kwh, estimated_range_miles, source, is_demo)
values
 ('10000000-0000-4000-8000-000000000006', 'BMW', 'i4', 'eDrive40', 2024, 81, 11, 205, '{CCS,"Type 2"}', 3.7, 299.7, 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000007', 'Audi', 'Q4 e-tron', '45', 2024, 77, 11, 175, '{CCS,"Type 2"}', 3.5, 269.5, 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000008', 'MG', 'MG4', 'SE Long Range', 2024, 61.7, 7, 135, '{CCS,"Type 2"}', 4, 246.8, 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000009', 'Polestar', '2', 'Long Range Single Motor', 2024, 79, 11, 205, '{CCS,"Type 2"}', 3.8, 300.2, 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000010', 'Volvo', 'EX30', 'Extended Range', 2024, 64, 11, 153, '{CCS,"Type 2"}', 3.8, 243.2, 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000011', 'Skoda', 'Enyaq', '85', 2024, 77, 11, 135, '{CCS,"Type 2"}', 3.7, 284.9, 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000012', 'Tesla', 'Model Y', 'Long Range AWD', 2024, 75, 11, 250, '{CCS,"Type 2"}', 3.6, 270, 'chargeonce_demo', true),
 ('10000000-0000-4000-8000-000000000013', 'MG', 'MG4', 'SE Standard Range', 2024, 50.8, 6.6, 117, '{CCS,"Type 2"}', 4, 203.2, 'chargeonce_demo', true)
on conflict(id) do update set manufacturer=excluded.manufacturer, model=excluded.model,
  variant=excluded.variant, model_year=excluded.model_year, usable_battery_kwh=excluded.usable_battery_kwh,
  max_ac_kw=excluded.max_ac_kw, max_dc_kw=excluded.max_dc_kw, connector_types=excluded.connector_types,
  efficiency_miles_per_kwh=excluded.efficiency_miles_per_kwh, estimated_range_miles=excluded.estimated_range_miles,
  source=excluded.source, is_demo=true;

insert into public.operators(id, name, slug, website) values
 ('20000000-0000-4000-8000-000000000001', 'GRIDSERVE', 'gridserve', 'https://www.gridserve.com'),
 ('20000000-0000-4000-8000-000000000002', 'bp pulse', 'bp-pulse', 'https://www.bppulse.co.uk'),
 ('20000000-0000-4000-8000-000000000003', 'Pod Point', 'pod-point', 'https://pod-point.com'),
 ('20000000-0000-4000-8000-000000000004', 'InstaVolt', 'instavolt', 'https://instavolt.co.uk'),
 ('20000000-0000-4000-8000-000000000005', 'Shell Recharge', 'shell-recharge', 'https://www.shell.co.uk')
on conflict(id) do update set name=excluded.name, slug=excluded.slug, website=excluded.website;

insert into public.charging_locations(id, external_id, provider, operator_id, name, address,
  postcode, latitude, longitude, opening_hours, is_demo, demo_metadata)
values
 ('30000000-0000-4000-8000-000000000001', 'alpha', 'chargeonce_demo', '20000000-0000-4000-8000-000000000001', 'DEMO — Marlow Riverside', 'Marlow, Buckinghamshire', 'SL7 1NZ', 51.5693, -0.7749, '{"description":"Illustrative 24-hour access"}', true, '{"distanceMiles":1.8,"reliabilityPercent":98,"x":25,"y":40}'),
 ('30000000-0000-4000-8000-000000000002', 'bravo', 'chargeonce_demo', '20000000-0000-4000-8000-000000000002', 'DEMO — Station Road Hub', 'Maidenhead, Berkshire', 'SL6 1DP', 51.5185, -0.7222, '{"description":"Illustrative 24-hour access"}', true, '{"distanceMiles":4.2,"reliabilityPercent":96,"x":56,"y":59}'),
 ('30000000-0000-4000-8000-000000000003', 'charlie', 'chargeonce_demo', '20000000-0000-4000-8000-000000000003', 'DEMO — High Street Car Park', 'Cookham, Berkshire', 'SL6 9SB', 51.5593, -0.7082, '{"description":"Illustrative 07:00–23:00 access"}', true, '{"distanceMiles":3.4,"reliabilityPercent":94,"x":43,"y":26}'),
 ('30000000-0000-4000-8000-000000000004', 'delta', 'chargeonce_demo', '20000000-0000-4000-8000-000000000004', 'DEMO — A404 Services', 'Bisham, Berkshire', 'SL7 1RR', 51.5576, -0.7763, '{"description":"Illustrative 24-hour access"}', true, '{"distanceMiles":5.7,"reliabilityPercent":99,"x":75,"y":34}'),
 ('30000000-0000-4000-8000-000000000005', 'echo', 'chargeonce_demo', '20000000-0000-4000-8000-000000000005', 'DEMO — Town Hall Lane', 'Henley-on-Thames, Oxfordshire', 'RG9 2AQ', 51.5375, -0.9050, '{"description":"Illustrative 24-hour access"}', true, '{"distanceMiles":8.6,"reliabilityPercent":91,"x":18,"y":73}')
on conflict(id) do update set name=excluded.name, address=excluded.address, postcode=excluded.postcode,
  latitude=excluded.latitude, longitude=excluded.longitude, opening_hours=excluded.opening_hours,
  operator_id=excluded.operator_id, is_public=true, is_community=false, access_type='public',
  is_demo=true, demo_metadata=excluded.demo_metadata, last_updated=now();

-- A stall is an EVSE; multiple connectors on one EVSE must not be double-counted.
insert into public.evses(id, location_id, external_id, status)
select md5('chargeonce-demo-evse-' || l.id::text || '-' || n)::uuid,
  l.id, 'demo-evse-' || n,
  case when l.external_id = 'echo' then 'unknown'
    when n <= case l.external_id when 'alpha' then 3 when 'bravo' then 2 when 'delta' then 5 else 0 end then 'available'
    else 'occupied' end::public.evse_status
from public.charging_locations l
cross join lateral generate_series(1, case l.external_id when 'alpha' then 6 when 'bravo' then 4 when 'charlie' then 4 when 'delta' then 8 else 2 end) as n
where l.provider='chargeonce_demo' and l.external_id in ('alpha', 'bravo', 'charlie', 'delta', 'echo')
on conflict(id) do update set status=excluded.status;

insert into public.connectors(id, evse_id, connector_type, max_power_kw, voltage, amperage)
select md5('chargeonce-demo-connector-' || e.id::text)::uuid, e.id,
  case when l.external_id='charlie' then 'Type 2' else 'CCS' end::public.connector_type,
  case l.external_id when 'alpha' then 150 when 'bravo' then 75 when 'charlie' then 22 when 'delta' then 300 else 50 end,
  case when l.external_id='charlie' then 400 else 800 end,
  case l.external_id when 'charlie' then 32 else null end
from public.evses e join public.charging_locations l on l.id=e.location_id
where l.provider='chargeonce_demo' and l.external_id in ('alpha', 'bravo', 'charlie', 'delta', 'echo')
on conflict(id) do update set connector_type=excluded.connector_type, max_power_kw=excluded.max_power_kw;

insert into public.tariffs(id, location_id, operator_id, price_per_kwh, connection_fee, currency, is_demo)
select md5('chargeonce-demo-tariff-' || id::text)::uuid, id, operator_id,
  case external_id when 'alpha' then 0.69 when 'bravo' then 0.55 when 'charlie' then 0.42 when 'delta' then 0.79 else 0.62 end,
  case when external_id='echo' then 0.50 else 0 end, 'GBP', true
from public.charging_locations where provider='chargeonce_demo' and external_id in ('alpha', 'bravo', 'charlie', 'delta', 'echo')
on conflict(id) do update set operator_id=excluded.operator_id, price_per_kwh=excluded.price_per_kwh, connection_fee=excluded.connection_fee,
  currency='GBP', valid_from=null, valid_to=null, parking_fee=null, is_demo=true;

insert into public.facilities(id, code, display_name) values
 ('50000000-0000-4000-8000-000000000001', 'toilets', 'Toilets'),
 ('50000000-0000-4000-8000-000000000002', 'cafe', 'Café'),
 ('50000000-0000-4000-8000-000000000003', 'restaurant', 'Restaurant'),
 ('50000000-0000-4000-8000-000000000004', 'shop', 'Shop'),
 ('50000000-0000-4000-8000-000000000005', 'wifi', 'Wi-Fi'),
 ('50000000-0000-4000-8000-000000000006', '24_hour', '24-hour access'),
 ('50000000-0000-4000-8000-000000000007', 'accessible_toilet', 'Accessible toilet'),
 ('50000000-0000-4000-8000-000000000008', 'lighting', 'Lighting')
on conflict(id) do update set code=excluded.code, display_name=excluded.display_name;
insert into public.location_facilities(location_id, facility_id)
select l.id, f.id from public.charging_locations l cross join public.facilities f
where l.provider='chargeonce_demo' and l.external_id in ('alpha', 'bravo', 'charlie', 'delta', 'echo') and f.code in ('toilets', 'cafe', 'lighting') on conflict do nothing;

commit;
