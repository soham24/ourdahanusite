-- Jobs board for jobs.ourdahanu.in.
-- Spec: docs/superpowers/specs/2026-09-14-jobs-board-design.md
--
-- Additive and safe to re-run. Every write goes through server actions using
-- the service role; the only public access is reading live posts.

CREATE TABLE IF NOT EXISTS public.job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('hiring', 'seeking')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'closed', 'removed')),
  posted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  collected_source text,
  title text NOT NULL,
  category text NOT NULL,
  work_types text[] NOT NULL,
  area text NOT NULL,
  description text,
  employer_name text,
  openings int CHECK (openings BETWEEN 1 AND 500),
  pay_min int CHECK (pay_min >= 0),
  pay_max int CHECK (pay_max >= 0),
  pay_period text CHECK (pay_period IN ('month', 'day', 'hour')),
  timings text,
  display_name text,
  experience_years int CHECK (experience_years BETWEEN 0 AND 60),
  review_flags text[] NOT NULL DEFAULT '{}',
  reject_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Each kind carries only its own fields.
  CONSTRAINT job_posts_kind_fields CHECK (
    (kind = 'hiring'
      AND employer_name IS NOT NULL
      AND display_name IS NULL
      AND experience_years IS NULL)
    OR
    (kind = 'seeking'
      AND display_name IS NOT NULL
      AND employer_name IS NULL
      AND listing_id IS NULL
      AND collected_source IS NULL
      AND openings IS NULL
      AND pay_min IS NULL
      AND pay_max IS NULL
      AND pay_period IS NULL)
  ),
  CONSTRAINT job_posts_pay_order CHECK (pay_min IS NULL OR pay_max IS NULL OR pay_max >= pay_min),
  -- An approved post always knows when it went live and when it expires.
  CONSTRAINT job_posts_approved_dated CHECK (
    status <> 'approved' OR (published_at IS NOT NULL AND expires_at IS NOT NULL)
  )
);

-- The board.
CREATE INDEX IF NOT EXISTS idx_job_posts_board
  ON public.job_posts (kind, published_at DESC) WHERE status = 'approved';
-- Category pages.
CREATE INDEX IF NOT EXISTS idx_job_posts_category
  ON public.job_posts (category) WHERE status = 'approved';
-- My posts, and the daily post limit.
CREATE INDEX IF NOT EXISTS idx_job_posts_posted_by
  ON public.job_posts (posted_by, created_at DESC);
-- The review queue.
CREATE INDEX IF NOT EXISTS idx_job_posts_pending
  ON public.job_posts (created_at) WHERE status = 'pending';
-- The reminder cron.
CREATE INDEX IF NOT EXISTS idx_job_posts_reminders
  ON public.job_posts (expires_at) WHERE status = 'approved' AND reminder_sent_at IS NULL;
-- One live "looking for work" profile per person. A lapsed profile is renewed,
-- not duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_posts_one_seeking_profile
  ON public.job_posts (posted_by) WHERE kind = 'seeking' AND status IN ('pending', 'approved');

-- Phone numbers live apart from posts. job_posts has a public read policy and
-- the anon key ships in every browser, so a number stored there could be
-- downloaded by anyone in one request, whatever the pages hide. Here the table
-- has no policies at all: "contact after login" is a database guarantee.
CREATE TABLE IF NOT EXISTS public.job_post_contacts (
  post_id uuid PRIMARY KEY REFERENCES public.job_posts(id) ON DELETE CASCADE,
  -- Normalised 10-digit Indian number. Mobiles start 6-9; landlines with
  -- their STD code start 1-5.
  phone text NOT NULL CHECK (phone ~ '^[1-9][0-9]{9}$'),
  whatsapp boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_post_contacts_whatsapp_mobile CHECK (NOT whatsapp OR phone ~ '^[6-9]')
);

-- One row per user per post, written the first time that user reveals the
-- number. Gives posters "N people viewed your number" and backs the daily
-- reveal limit.
CREATE TABLE IF NOT EXISTS public.job_contact_reveals (
  post_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_contact_reveals_user
  ON public.job_contact_reveals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.job_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL
    CHECK (reason IN ('asks_for_money', 'fake', 'filled', 'offensive', 'my_number', 'other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_post_reports_once UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_post_reports_post
  ON public.job_post_reports (post_id, created_at DESC);

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_post_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_contact_reveals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_post_reports ENABLE ROW LEVEL SECURITY;

-- DROP ... IF EXISTS only makes a re-run safe: both policies are created by
-- this file, nowhere else.
DROP POLICY IF EXISTS "Live job posts are public" ON public.job_posts;
CREATE POLICY "Live job posts are public" ON public.job_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'approved' AND expires_at > now());

DROP POLICY IF EXISTS "Posters can read their own job posts" ON public.job_posts;
CREATE POLICY "Posters can read their own job posts" ON public.job_posts
  FOR SELECT TO authenticated
  USING (posted_by = auth.uid());

-- No insert, update or delete policies anywhere. Defence in depth on top of
-- RLS: the public API roles hold no write privileges on job_posts and no
-- privileges at all on the other three tables.
REVOKE INSERT, UPDATE, DELETE ON public.job_posts FROM anon, authenticated;
REVOKE ALL ON public.job_post_contacts FROM anon, authenticated;
REVOKE ALL ON public.job_contact_reveals FROM anon, authenticated;
REVOKE ALL ON public.job_post_reports FROM anon, authenticated;
