ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_reminder_sent_at timestamptz;
