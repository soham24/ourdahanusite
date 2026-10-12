-- Three indexes that another index already covers, so every write to these
-- tables maintained them for nothing (checked against production first):
--   listings_subdomain_idx          = listings_subdomain_key (unique, same column)
--   idx_appt_overrides_listing_date = appointment_date_overrides_unique_day
--                                     (unique, same two columns)
--   idx_listings_approved_category  is the leading column of
--                                     idx_listings_approved_category_rating,
--                                     under the same `where approved`
drop index if exists public.listings_subdomain_idx;
drop index if exists public.idx_appt_overrides_listing_date;
drop index if exists public.idx_listings_approved_category;
