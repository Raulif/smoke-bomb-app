-- Run this in the Supabase SQL editor
-- Awards Ghost, Phantom, Sprinter, Bloodhound, and Detective badges
-- after a session ends. Safe to call multiple times (idempotent).

CREATE OR REPLACE FUNCTION award_session_badges(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bomb         RECORD;
  v_session      RECORD;
  v_streak_count INT;
  v_correct_count INT;
BEGIN
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Get the smoke bomb for this session (most recent if somehow multiple)
  SELECT * INTO v_bomb FROM smoke_bombs
  WHERE session_id = p_session_id
  ORDER BY activated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  -- ── GHOST ──────────────────────────────────────────────────────────────────
  -- Escaped at least once, ever.
  IF v_bomb.status = 'escaped' THEN
    INSERT INTO badges (user_id, badge_type)
    SELECT v_bomb.thrown_by, 'ghost'
    WHERE NOT EXISTS (
      SELECT 1 FROM badges
      WHERE user_id = v_bomb.thrown_by AND badge_type = 'ghost'
    );
  END IF;

  -- ── PHANTOM ────────────────────────────────────────────────────────────────
  -- Last 3 sessions where this user threw a smoke bomb all ended in escape.
  -- Sessions where they didn't throw are ignored.
  IF v_bomb.status = 'escaped' THEN
    SELECT COUNT(*) INTO v_streak_count
    FROM (
      SELECT status
      FROM smoke_bombs
      WHERE thrown_by = v_bomb.thrown_by
      ORDER BY activated_at DESC
      LIMIT 3
    ) last3
    WHERE status = 'escaped';

    IF v_streak_count = 3 THEN
      INSERT INTO badges (user_id, badge_type)
      SELECT v_bomb.thrown_by, 'phantom'
      WHERE NOT EXISTS (
        SELECT 1 FROM badges
        WHERE user_id = v_bomb.thrown_by AND badge_type = 'phantom'
      );
    END IF;
  END IF;

  -- ── SPRINTER ───────────────────────────────────────────────────────────────
  -- Fastest escape (arrived_home_at - activated_at) in this group's history.
  IF v_bomb.status = 'escaped' AND v_bomb.arrived_home_at IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM smoke_bombs sb
      JOIN sessions s ON s.id = sb.session_id
      WHERE s.group_id = v_session.group_id
        AND sb.status = 'escaped'
        AND sb.arrived_home_at IS NOT NULL
        AND sb.id <> v_bomb.id
        AND (sb.arrived_home_at - sb.activated_at) < (v_bomb.arrived_home_at - v_bomb.activated_at)
    ) THEN
      INSERT INTO badges (user_id, badge_type)
      SELECT v_bomb.thrown_by, 'sprinter'
      WHERE NOT EXISTS (
        SELECT 1 FROM badges
        WHERE user_id = v_bomb.thrown_by AND badge_type = 'sprinter'
      );
    END IF;
  END IF;

  -- ── BLOODHOUND ─────────────────────────────────────────────────────────────
  -- Made at least 1 correct accusation (lifetime).
  INSERT INTO badges (user_id, badge_type)
  SELECT DISTINCT a.accused_by, 'bloodhound'
  FROM accusations a
  WHERE a.smoke_bomb_id = v_bomb.id
    AND a.correct = true
    AND NOT EXISTS (
      SELECT 1 FROM badges
      WHERE user_id = a.accused_by AND badge_type = 'bloodhound'
    );

  -- ── DETECTIVE ──────────────────────────────────────────────────────────────
  -- 5 or more correct accusations lifetime.
  INSERT INTO badges (user_id, badge_type)
  SELECT DISTINCT a.accused_by, 'detective'
  FROM accusations a
  WHERE a.smoke_bomb_id = v_bomb.id
    AND a.correct = true
    AND (
      SELECT COUNT(*) FROM accusations a2
      WHERE a2.accused_by = a.accused_by AND a2.correct = true
    ) >= 5
    AND NOT EXISTS (
      SELECT 1 FROM badges
      WHERE user_id = a.accused_by AND badge_type = 'detective'
    );

END;
$$;
