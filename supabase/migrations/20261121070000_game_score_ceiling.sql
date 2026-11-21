-- Chikoo Catcher scores can now go past 500: the game added golden chikoos,
-- top-ups and score milestones, and no longer ends at 500. The new ceiling
-- matches GAME_CONFIG.maxScore (src/app/play/game/config.ts), which the score
-- action also enforces; it is far beyond any real run, so a forged score still
-- cannot be absurd. Existing scores all satisfy the new check.
alter table public.game_scores drop constraint if exists game_scores_score_check;
alter table public.game_scores add constraint game_scores_score_check check (score >= 0 and score <= 9999);
