-- Run this in the Supabase SQL editor
-- Awards the Legend badge to the current points leader of each group.
-- Scheduled to run on the first of every month via pg_cron.

CREATE OR REPLACE FUNCTION award_legend_badges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id    UUID;
  v_top_user_id UUID;
BEGIN
  FOR v_group_id IN SELECT id FROM groups LOOP
    -- Find the member with the most points in this group
    SELECT user_id INTO v_top_user_id
    FROM group_members
    WHERE group_id = v_group_id
      AND total_points > 0
    ORDER BY total_points DESC
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO badges (user_id, badge_type)
      SELECT v_top_user_id, 'legend'
      WHERE NOT EXISTS (
        SELECT 1 FROM badges
        WHERE user_id = v_top_user_id AND badge_type = 'legend'
      );
    END IF;
  END LOOP;
END;
$$;

-- Schedule: runs at midnight UTC on the 1st of every month.
-- pg_cron is enabled by default on Supabase projects.
-- If the job already exists, drop it first: SELECT cron.unschedule('award-legend-badges-monthly');
SELECT cron.schedule(
  'award-legend-badges-monthly',
  '0 0 1 * *',
  'SELECT award_legend_badges()'
);
