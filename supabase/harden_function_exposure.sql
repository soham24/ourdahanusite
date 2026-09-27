-- ============================================================
-- Function exposure hardening (Supabase advisor follow-up)
--
-- Two separate problems, both found by the database linter:
--
-- 1. Two functions are reachable over the public REST API by roles
--    that have no business calling them:
--      - accept_delivery_offer() is granted to `authenticated`, yet no
--        application code calls it and the delivery subsystem it drives
--        is dormant (delivery_orders and rider_assignments are both
--        empty). Any signed-in user could invoke it.
--      - get_admin_find_counts() is granted to PUBLIC, `anon` and
--        `authenticated`, and returns the FindDahanu moderation queue
--        sizes (pending / rejected / inactive). Its only caller is the
--        admin page, which uses the service role.
--    Both keep their service_role grant, so the application is
--    unaffected.
--
--    NOT revoked here: handle_new_user() and increment_reply_count().
--    The linter flags them too, but they are `RETURNS trigger`, and
--    PostgreSQL refuses a direct call with
--    'trigger functions can only be called as triggers' (SQLSTATE
--    0A000) before any of their code runs -- verified against this
--    database. Their EXECUTE comes from PUBLIC, and handle_new_user is
--    what creates a profile row for every new signup, so narrowing that
--    grant would risk the signup path to close an opening that cannot
--    be walked through.
--
-- 2. Nine of our own functions have a role-mutable search_path. For the
--    two SECURITY DEFINER ones this is the documented privilege-
--    escalation vector: the function runs as its owner, so whatever the
--    caller's search_path resolves an unqualified name to runs as the
--    owner too. Pinning it to `public` removes the caller's say.
--    The pg_trgm extension's own functions are left alone -- they belong
--    to the extension, not to us.
--
-- Idempotent: REVOKE of an absent privilege and re-pinning an already
-- pinned search_path are both no-ops, so this is safe to run again.
-- ============================================================

-- ---------- 1. Narrow what the API roles can call ----------

-- PUBLIC as well as the named roles: PostgreSQL's default for a new
-- function is EXECUTE TO PUBLIC, and on any database still carrying that
-- default, revoking from `authenticated` alone leaves it reachable
-- through PUBLIC -- which the verification block at the bottom would
-- then catch, rolling back every ALTER FUNCTION above it. Production has
-- no PUBLIC grant on this one, so there it is a no-op.
REVOKE EXECUTE ON FUNCTION public.accept_delivery_offer(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_delivery_offer(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_delivery_offer(uuid, uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_find_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_find_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_find_counts() FROM authenticated;

-- ---------- 2. Pin search_path on our own functions ----------
-- `public` rather than `''`: every body below reaches for unqualified
-- objects in public (forum_threads, listings, appointments), so an empty
-- search_path would break them. Pinning is the fix either way -- what
-- matters is that the caller no longer chooses.

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.increment_reply_count() SET search_path = public;
ALTER FUNCTION public.lowercase_subdomain() SET search_path = public;
ALTER FUNCTION public.touch_appointments_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_listing_payment_configs_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_listing_products_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_notif_prefs_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_payment_intents_updated_at() SET search_path = public;
ALTER FUNCTION public.create_appointment_booking(
  uuid, uuid, date, time without time zone, time without time zone,
  text, text, text, text, numeric, text, text, text, text
) SET search_path = public;

-- ---------- Verification ----------

DO $$
DECLARE
  v_unpinned int;
  v_still_public int;
BEGIN
  SELECT count(*) INTO v_unpinned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.proname IN (
      'handle_new_user', 'increment_reply_count', 'lowercase_subdomain',
      'touch_appointments_updated_at', 'touch_listing_payment_configs_updated_at',
      'touch_listing_products_updated_at', 'touch_notif_prefs_updated_at',
      'touch_payment_intents_updated_at', 'create_appointment_booking'
    )
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
    );

  IF v_unpinned <> 0 THEN
    RAISE EXCEPTION 'search_path still unpinned on % function(s)', v_unpinned;
  END IF;

  SELECT count(*) INTO v_still_public
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('accept_delivery_offer', 'get_admin_find_counts')
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  IF v_still_public <> 0 THEN
    RAISE EXCEPTION 'API roles can still execute % function(s)', v_still_public;
  END IF;

  -- The application reaches both of these as the service role; if that
  -- were revoked too, the admin FindDahanu page would silently show zeroes.
  IF NOT has_function_privilege('service_role', 'public.get_admin_find_counts()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role lost EXECUTE on get_admin_find_counts';
  END IF;

  RAISE NOTICE 'harden_function_exposure: verified';
END $$;
