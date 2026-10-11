-- Associate a find professional with an OurDahanu business listing.
-- Nullable; ON DELETE SET NULL so removing a listing reverts the professional
-- to a basic card with no dangling reference.
alter table find_professionals
  add column if not exists business_listing_id uuid
    references listings(id) on delete set null;

create index if not exists find_professionals_business_idx
  on find_professionals (business_listing_id);
