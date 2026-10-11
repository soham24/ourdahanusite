-- ============================================================
-- OurDahanu — Re-categorize "Other" listings
-- Run this in Supabase SQL Editor
--
-- Context: The `listings.category` column is free-form text — no
-- schema change is needed to introduce new category names. This
-- patch just reassigns 8 listings currently tagged "Other" to
-- either brand-new categories (Fashion & Clothing, Interior
-- Design, etc.) or existing ones that always fit better.
--
-- New categories introduced (code-side too):
--   - Fashion & Clothing         👗
--   - Skincare & Cosmetics       🧴
--   - Interior Design            🛋️
--   - Internet & Telecom         📡
--   - NGOs & Social Causes       🌍
-- ============================================================

begin;

-- 1. Swapnanadhaga — custom/handcrafted fashion
update listings set category = 'Fashion & Clothing'
 where id = '522fc75b-ac28-4062-acf2-a7fd79f24a92';

-- 2. Ohh Girl - Lingerie Store
update listings set category = 'Fashion & Clothing'
 where id = '401fa6cc-1b9b-4de7-80a3-d59c24baa53f';

-- 3. Profiber Broadband — fiber ISP
update listings set category = 'Internet & Telecom'
 where id = '9aaddb4d-dd5c-4c03-9c9c-5ff442bd74d4';

-- 4. Mitali Saraf Spaces — interior design
update listings set category = 'Interior Design'
 where id = '34848c26-82d4-429d-bda9-a530f4e69a56';

-- 5. मूर्तिकार कला मंदिर — idol/sculpture making → existing Arts & Crafts
update listings set category = 'Arts & Crafts'
 where id = '3685d031-1286-42e9-8c87-61eafccca407';

-- 6. For Ocean Foundation — environmental NGO
update listings set category = 'NGOs & Social Causes'
 where id = 'cb458632-6373-4e6d-b0ed-7fd1076072ea';

-- 7. Aairaavat Foods — cold-pressed groundnut oil → existing Farms & Organic
update listings set category = 'Farms & Organic'
 where id = 'f262dbfe-322f-4fa0-b931-2bd9e182c40c';

-- 8. Little Earth Skincare — natural skincare
update listings set category = 'Skincare & Cosmetics'
 where id = '19577568-62b9-4840-b2ff-26e2a0474174';

-- Sanity check — none of the 8 should be "Other" anymore.
-- (Run this SELECT separately after commit to verify.)
-- select id, name, category from listings
--  where id in (
--    '522fc75b-ac28-4062-acf2-a7fd79f24a92',
--    '401fa6cc-1b9b-4de7-80a3-d59c24baa53f',
--    '9aaddb4d-dd5c-4c03-9c9c-5ff442bd74d4',
--    '34848c26-82d4-429d-bda9-a530f4e69a56',
--    '3685d031-1286-42e9-8c87-61eafccca407',
--    'cb458632-6373-4e6d-b0ed-7fd1076072ea',
--    'f262dbfe-322f-4fa0-b931-2bd9e182c40c',
--    '19577568-62b9-4840-b2ff-26e2a0474174'
--  );

commit;
