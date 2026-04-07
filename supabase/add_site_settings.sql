-- Site-wide key/value settings (admin-managed)
CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- Public read; writes handled via service-role client (server-side only)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON site_settings FOR SELECT USING (true);

-- Seed the featured listing
INSERT INTO site_settings (key, value)
VALUES ('featured_listing_subdomain', 'nisargfarm')
ON CONFLICT (key) DO NOTHING;
