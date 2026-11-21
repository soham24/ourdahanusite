-- The month (YYYY-MM) of the last monthly summary sent for a listing. The
-- cron claims a listing by setting it before sending, so a repeated or late
-- run never sends the same month twice. reminders_sent could not hold it: it
-- is an integer[] of expiry milestones.
alter table public.listings add column if not exists last_summary_month text;
