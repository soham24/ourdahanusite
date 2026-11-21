-- The seven foreign keys Supabase's performance advisor still reports without
-- a covering index. None backs a hot read path; they matter on delete: removing
-- a profile or a catalog item makes Postgres check every referencing row, and
-- without an index that check scans the whole table. orders.product_id and
-- orders.product_option_id are the ones a seller hits, by deleting an item.
-- All tables are small, so building these is instant.
create index if not exists idx_orders_product_id on public.orders (product_id);
create index if not exists idx_orders_product_option_id on public.orders (product_option_id);
create index if not exists idx_emergency_alerts_created_by on public.emergency_alerts (created_by);
create index if not exists idx_events_organizer_id on public.events (organizer_id);
create index if not exists idx_polls_created_by on public.polls (created_by);
create index if not exists idx_job_posts_reviewed_by on public.job_posts (reviewed_by);
create index if not exists idx_job_post_reports_user_id on public.job_post_reports (user_id);
