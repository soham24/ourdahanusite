-- Low-risk indexes for the public listing hot path.
-- Run this in the Supabase SQL editor. Each statement is idempotent.

create index if not exists idx_reviews_listing_created
  on reviews (listing_id, created_at desc, id asc);

create index if not exists idx_listing_questions_listing_created
  on listing_questions (listing_id, created_at desc, id asc);

create index if not exists idx_listing_recommendations_listing
  on listing_recommendations (listing_id);

create index if not exists idx_listing_favourites_listing
  on listing_favourites (listing_id);

create index if not exists idx_listings_approved_category_rating
  on listings (category, rating desc, created_at desc, id asc)
  where approved;
