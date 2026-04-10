-- ================================================================
-- Smoke Bomb App — Full Schema
-- Run in Supabase SQL editor for project vxqhcupyljtyjutqmtwj
--
-- Execute in two separate queries:
--   1. Tables (Query 1)
--   2. RLS + policies (Query 2)
--
-- Then run separately:
--   - supabase/schema_trigger.sql
--   - supabase/calculate_session_points.sql
--   - supabase/award_session_badges.sql
--   - supabase/award_legend_badges.sql
--
-- Finally, enable realtime via SQL:
--   ALTER PUBLICATION supabase_realtime
--     ADD TABLE public.sessions, public.smoke_bombs, public.accusations;
-- ================================================================

-- ── Query 1: TABLES ──────────────────────────────────────────────

CREATE TABLE public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        text,
  avatar_url      text,
  phone           text,
  lifetime_points integer NOT NULL DEFAULT 0,
  push_token      text,
  home_latitude   float8,
  home_longitude  float8,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_by  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES public.users(id),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz
);

CREATE TABLE public.smoke_bombs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  thrown_by       uuid NOT NULL REFERENCES public.users(id),
  activated_at    timestamptz NOT NULL DEFAULT now(),
  arrived_home_at timestamptz,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'discovered', 'escaped', 'cancelled')),
  victory_message text,
  caught_message  text,
  points_earned   integer
);

CREATE TABLE public.accusations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_bomb_id   uuid NOT NULL REFERENCES public.smoke_bombs(id) ON DELETE CASCADE,
  accused_by      uuid NOT NULL REFERENCES public.users(id),
  accused_user_id uuid NOT NULL REFERENCES public.users(id),
  correct         boolean,
  accused_at      timestamptz NOT NULL DEFAULT now(),
  points_earned   integer
);

CREATE TABLE public.badges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_type text NOT NULL CHECK (badge_type IN ('ghost', 'phantom', 'sprinter', 'bloodhound', 'detective', 'founder', 'legend')),
  earned_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Query 2: RLS + POLICIES ──────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_select" ON public.groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid()));
CREATE POLICY "groups_insert" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_members_select" ON public.group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_update" ON public.group_members FOR UPDATE TO authenticated USING (true);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_select" ON public.sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = sessions.group_id AND user_id = auth.uid()));
CREATE POLICY "sessions_insert" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = started_by AND EXISTS (SELECT 1 FROM public.group_members WHERE group_id = sessions.group_id AND user_id = auth.uid()));
CREATE POLICY "sessions_update" ON public.sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = sessions.group_id AND user_id = auth.uid()));

ALTER TABLE public.smoke_bombs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smoke_bombs_select" ON public.smoke_bombs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s JOIN public.group_members gm ON gm.group_id = s.group_id WHERE s.id = smoke_bombs.session_id AND gm.user_id = auth.uid()));
CREATE POLICY "smoke_bombs_insert" ON public.smoke_bombs FOR INSERT TO authenticated WITH CHECK (auth.uid() = thrown_by);
CREATE POLICY "smoke_bombs_update" ON public.smoke_bombs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s JOIN public.group_members gm ON gm.group_id = s.group_id WHERE s.id = smoke_bombs.session_id AND gm.user_id = auth.uid()));

ALTER TABLE public.accusations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accusations_select" ON public.accusations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.smoke_bombs sb JOIN public.sessions s ON s.id = sb.session_id JOIN public.group_members gm ON gm.group_id = s.group_id WHERE sb.id = accusations.smoke_bomb_id AND gm.user_id = auth.uid()));
CREATE POLICY "accusations_insert" ON public.accusations FOR INSERT TO authenticated WITH CHECK (auth.uid() = accused_by);
CREATE POLICY "accusations_update" ON public.accusations FOR UPDATE TO authenticated USING (true);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_select" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "badges_insert" ON public.badges FOR INSERT TO authenticated WITH CHECK (true);
