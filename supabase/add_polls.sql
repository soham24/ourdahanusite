-- ============================================================
-- Polls feature — community polls with time-limited voting
-- ============================================================

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- format: [{ "id": "opt_1", "label": "Option A" }, ...]
  ends_at timestamptz NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

-- Anyone can read active polls
CREATE POLICY "Active polls are public" ON polls
  FOR SELECT USING (active = true);

-- Index for homepage query: active + ordered by end time
CREATE INDEX idx_polls_active_ends ON polls (active, ends_at DESC)
  WHERE active = true;

-- Poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  option_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (poll_id, user_id)  -- one vote per user per poll
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Users can see their own votes
CREATE POLICY "Users can view own votes" ON poll_votes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own vote
CREATE POLICY "Authenticated users can vote" ON poll_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own vote (before end time — enforced in server action)
CREATE POLICY "Users can update own vote" ON poll_votes
  FOR UPDATE USING (auth.uid() = user_id);

-- Index for counting votes per option
CREATE INDEX idx_poll_votes_poll_option ON poll_votes (poll_id, option_id);
