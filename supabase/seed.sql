-- Sample data for a fresh local database, so the site has something to show.
--
-- `supabase db reset` runs this after the migrations. Everything here is
-- invented -- a made-up town, made-up businesses, phone numbers in a range
-- nobody owns -- so it is safe to publish and safe to delete. Nothing here
-- needs a signed-in user; sign in with Google locally to create one.

insert into public.listings
  (name, category, subdomain, tagline, description, phone, whatsapp, address, hours, approved, verified, plan)
values
  ('Seaside Thali House', 'Restaurants', 'seaside-thali', 'Home-style thalis by the beach',
   'A family kitchen serving vegetarian and fish thalis, made fresh every afternoon.',
   '9000000001', '9000000001', 'Beach Road, Sampletown', 'Daily 11:00–22:00', true, true, 'premium'),
  ('Morning Brew Cafe', 'Cafe', 'morning-brew', 'Filter coffee and fresh bakes',
   'Small cafe near the station. Filter coffee, cutting chai and bakes from the oven next door.',
   '9000000002', '9000000002', 'Station Road, Sampletown', 'Daily 07:00–20:00', true, false, 'basic'),
  ('Green Acre Organic Farm', 'Farms & Organic', 'green-acre', 'Seasonal fruit straight from the farm',
   'Chikoo, mango and coconut in season, sold at the farm gate and delivered in town on weekends.',
   '9000000003', '9000000003', 'Farm Lane, Sampletown', 'Sat–Sun 08:00–14:00', true, true, 'basic'),
  ('Harbour View Stay', 'Hotels & Stay', 'harbour-view', 'Six rooms, one sea view',
   'A quiet guesthouse with breakfast included, ten minutes'' walk from the beach.',
   '9000000004', '9000000004', 'Harbour Road, Sampletown', 'Check-in from 12:00', true, false, 'premium'),
  ('Sampletown Family Clinic', 'Healthcare & Clinics', 'family-clinic', 'General practice and child care',
   'Walk-in consultations, vaccinations and basic tests.',
   '9000000005', null, 'Market Square, Sampletown', 'Mon–Sat 09:00–13:00, 17:00–20:00', true, true, 'basic'),
  ('Bright Minds Coaching', 'Education & Coaching', 'bright-minds', 'Maths and science, classes 8–12',
   'Small batches, weekly tests, and doubt sessions every Saturday.',
   '9000000006', '9000000006', 'School Road, Sampletown', 'Mon–Sat 16:00–20:00', true, false, 'basic'),
  ('Unapproved Example Shop', 'Grocery & Shops', null, null,
   'Not approved, so it must not appear anywhere public. Useful for checking moderation.',
   '9000000007', null, 'Somewhere, Sampletown', null, false, false, 'basic');

insert into public.events (title, description, date, time_start, location, category, is_free, approved)
values
  ('Beach Clean-up Morning', 'Bring gloves; bags and breakfast provided.',
   current_date + 7, '07:00', 'Main Beach, Sampletown', 'Community', true, true),
  ('Farmers'' Market', 'Local growers, home bakers and a chikoo-eating contest.',
   current_date + 14, '09:00', 'Market Square, Sampletown', 'Market', true, true);

insert into public.find_professionals (name, phone, whatsapp, professions, locality, status)
values
  ('Ravi Electricals', '9000000101', true, array['Electrician'], 'Station Road', 'approved'),
  ('Asha Tailoring', '9000000102', true, array['Tailor'], 'Market Square', 'approved'),
  ('Pending Example Plumber', '9000000103', false, array['Plumber'], 'Beach Road', 'pending');
