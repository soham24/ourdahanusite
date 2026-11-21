-- One search across the directory: businesses by name, category, tagline,
-- description, tags and area; their products and services by name and
-- description; and the professionals in Find by name, profession and area. Typo-tolerant through pg_trgm's word_similarity, so "bakry"
-- still finds a bakery and "cake" finds the shop that sells cakes even when
-- the word is not in its name.
--
-- SECURITY INVOKER: it runs as the caller, so row level security decides what
-- comes back -- approved listings and the visible items of approved listings,
-- exactly what the directory already shows. Professionals are filtered to
-- approved ones explicitly, because the policy also shows submitters their own
-- pending entries.
--
-- kind is listing, item or professional. For a professional, listing_id and
-- listing_name are the professional's id and name, category their
-- professions, and address their locality. The data set is a few hundred
-- rows, so no index is needed; add trigram GIN indexes if it grows into the
-- thousands.
--
-- pg_trgm lives in `extensions` on new installs and in `public` on the
-- original project, so both are on the search path.
create or replace function public.search_directory(p_query text, p_limit integer default 30)
returns table (
  kind text,
  listing_id uuid,
  listing_name text,
  category text,
  address text,
  rating numeric,
  subdomain text,
  item_id uuid,
  item_name text,
  price_paise integer,
  score real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select lower(left(trim(coalesce(p_query, '')), 100)) as t
  ),
  listing_hits as (
    select
      'listing'::text as kind,
      l.id as listing_id,
      l.name as listing_name,
      l.category,
      l.address,
      l.rating,
      l.subdomain,
      null::uuid as item_id,
      null::text as item_name,
      null::integer as price_paise,
      greatest(
        word_similarity(q.t, lower(l.name)),
        word_similarity(q.t, lower(coalesce(l.category, ''))),
        word_similarity(q.t, lower(coalesce(l.tagline, ''))) * 0.9,
        word_similarity(q.t, lower(coalesce(l.tags::text, ''))) * 0.85,
        word_similarity(q.t, lower(coalesce(l.address, ''))) * 0.8,
        word_similarity(q.t, lower(coalesce(l.description, ''))) * 0.75
      )::real as score
    from public.listings l, q
    where l.approved = true and q.t <> ''
  ),
  item_hits as (
    select
      'item'::text as kind,
      l.id,
      l.name,
      l.category,
      l.address,
      l.rating,
      l.subdomain,
      p.id,
      p.name,
      p.price_paise,
      greatest(
        word_similarity(q.t, lower(p.name)),
        word_similarity(q.t, lower(coalesce(p.description, ''))) * 0.75
      )::real
    from public.listing_products p
    join public.listings l on l.id = p.listing_id and l.approved = true
    cross join q
    where p.is_active = true and q.t <> ''
  ),
  professional_hits as (
    select
      'professional'::text,
      f.id,
      f.name,
      array_to_string(f.professions, ', ') || coalesce(', ' || f.profession_other, ''),
      f.locality,
      null::numeric,
      null::text,
      null::uuid,
      null::text,
      null::integer,
      greatest(
        word_similarity(q.t, lower(f.name)),
        word_similarity(q.t, lower(array_to_string(f.professions, ' '))),
        word_similarity(q.t, lower(coalesce(f.profession_other, ''))),
        word_similarity(q.t, lower(coalesce(f.locality, ''))) * 0.8
      )::real
    from public.find_professionals f, q
    where f.status = 'approved' and f.is_active = true and q.t <> ''
  )
  select * from (
    select * from listing_hits
    union all
    select * from item_hits
    union all
    select * from professional_hits
  ) hits
  -- 0.5 keeps one-letter typos ("bakry", "plumbr") and drops noise.
  where score >= 0.5
  order by score desc, listing_name
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.search_directory(text, integer) from public;
grant execute on function public.search_directory(text, integer) to anon, authenticated, service_role;
