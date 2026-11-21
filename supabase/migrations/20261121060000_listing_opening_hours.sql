-- Structured opening hours, { "mon": [{ "start": "09:00", "end": "18:00" }], ... },
-- so the site can say "Open now" and filter by it. The free-text `hours`
-- column stays for notes such as "Closed on holidays". A window whose end is
-- not after its start runs past midnight. Null means not set.
alter table public.listings add column if not exists opening_hours jsonb;
