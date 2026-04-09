-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/vxqhcupyljtyjutqmtwj/sql/new
--
-- Points formula (per CLAUDE.md):
--   Thrower (escaped) : 10 base + 3 per minute, capped at 100
--   Thrower (caught)  : 0
--   Correct accuser   : max(5, 100 − minutes since bomb activated)
--   Wrong accuser     : −5 (group total floored at 0)
--   Wrongly accused   : +3 compensation per wrong accusation

CREATE OR REPLACE FUNCTION calculate_session_points(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session        RECORD;
  v_bomb           RECORD;
  v_accuser        RECORD;
  v_elapsed_sec    integer := 0;
  v_thrower_pts    integer := 0;
  v_accuse_elapsed integer;
  v_accuse_pts     integer;
BEGIN
  -- 1. Validate session is closed
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;
  IF v_session.status <> 'closed' THEN
    RAISE EXCEPTION 'Session is not closed';
  END IF;

  -- 2. Caller must be a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = v_session.group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 3. Fetch most recent smoke bomb for this session
  SELECT * INTO v_bomb
  FROM smoke_bombs
  WHERE session_id = p_session_id
  ORDER BY activated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('thrower_points', 0, 'message', 'no smoke bomb');
  END IF;

  -- 4. Idempotency: return early if already calculated
  IF v_bomb.points_earned IS NOT NULL THEN
    RETURN jsonb_build_object(
      'thrower_points', v_bomb.points_earned,
      'message', 'already calculated'
    );
  END IF;

  -- 5. Thrower points
  IF v_bomb.status = 'escaped' AND v_bomb.arrived_home_at IS NOT NULL THEN
    v_elapsed_sec := EXTRACT(EPOCH FROM (
      v_bomb.arrived_home_at::timestamptz - v_bomb.activated_at::timestamptz
    ))::integer;
    -- 10 base + 3 per minute, capped at 100
    v_thrower_pts := LEAST(100, 10 + (v_elapsed_sec / 60) * 3);

    UPDATE smoke_bombs SET points_earned = v_thrower_pts WHERE id = v_bomb.id;

    UPDATE group_members
    SET total_points = total_points + v_thrower_pts
    WHERE user_id = v_bomb.thrown_by AND group_id = v_session.group_id;

    UPDATE users
    SET lifetime_points = lifetime_points + v_thrower_pts
    WHERE id = v_bomb.thrown_by;

  ELSIF v_bomb.status = 'discovered' THEN
    -- Thrower caught: 0 points — mark so idempotency guard fires next time
    UPDATE smoke_bombs SET points_earned = 0 WHERE id = v_bomb.id;

  ELSE
    -- Bomb still active when session was force-closed: 0 points
    UPDATE smoke_bombs SET points_earned = 0 WHERE id = v_bomb.id;
  END IF;

  -- 6. Accusation points (Step 6 — runs automatically once accusations exist)
  FOR v_accuser IN
    SELECT * FROM accusations WHERE smoke_bomb_id = v_bomb.id
  LOOP
    IF v_accuser.correct = true THEN
      v_accuse_elapsed := EXTRACT(EPOCH FROM (
        v_accuser.accused_at::timestamptz - v_bomb.activated_at::timestamptz
      ))::integer;
      -- Speed bonus: 100 base − 1 per minute, floor at 5
      v_accuse_pts := GREATEST(5, 100 - (v_accuse_elapsed / 60));

      UPDATE accusations SET points_earned = v_accuse_pts WHERE id = v_accuser.id;

      UPDATE group_members
      SET total_points = total_points + v_accuse_pts
      WHERE user_id = v_accuser.accused_by AND group_id = v_session.group_id;

      UPDATE users SET lifetime_points = lifetime_points + v_accuse_pts
      WHERE id = v_accuser.accused_by;

    ELSIF v_accuser.correct = false THEN
      -- Wrong guess: -5 to accuser (group total floored at 0)
      UPDATE accusations SET points_earned = -5 WHERE id = v_accuser.id;

      UPDATE group_members
      SET total_points = GREATEST(0, total_points - 5)
      WHERE user_id = v_accuser.accused_by AND group_id = v_session.group_id;

      UPDATE users SET lifetime_points = GREATEST(0, lifetime_points - 5)
      WHERE id = v_accuser.accused_by;

      -- +3 compensation to wrongly accused player
      UPDATE group_members
      SET total_points = total_points + 3
      WHERE user_id = v_accuser.accused_user_id AND group_id = v_session.group_id;

      UPDATE users SET lifetime_points = lifetime_points + 3
      WHERE id = v_accuser.accused_user_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'thrower_points',  v_thrower_pts,
    'thrower_id',      v_bomb.thrown_by,
    'elapsed_seconds', v_elapsed_sec
  );
END;
$$;

-- Restrict to authenticated users only
REVOKE ALL ON FUNCTION calculate_session_points(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_session_points(uuid) TO authenticated;
