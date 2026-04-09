import { supabase } from './supabase';
import type { BadgeRow, BadgeType } from './types';

export const BADGE_META: Record<BadgeType, { emoji: string; label: string; description: string }> = {
  ghost:      { emoji: '👻', label: 'Ghost',      description: 'Escaped without being caught' },
  phantom:    { emoji: '🌫️', label: 'Phantom',    description: 'Escaped 3 sessions in a row' },
  sprinter:   { emoji: '⚡', label: 'Sprinter',   description: 'Fastest time home in group history' },
  bloodhound: { emoji: '🐕', label: 'Bloodhound', description: 'Made your first correct accusation' },
  detective:  { emoji: '🔍', label: 'Detective',  description: '5 correct accusations' },
  founder:    { emoji: '🏛️', label: 'Founder',    description: 'Created a group' },
  legend:     { emoji: '👑', label: 'Legend',     description: 'Top of the leaderboard for a full month' },
};

export async function getUserBadges(userId: string): Promise<BadgeRow[]> {
  const { data } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true });
  return data ?? [];
}

/** Fetch badges for a list of users in one query. Returns a map of userId → badge types. */
export async function getBadgesForUsers(userIds: string[]): Promise<Map<string, BadgeType[]>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from('badges')
    .select('user_id, badge_type')
    .in('user_id', userIds);

  const map = new Map<string, BadgeType[]>();
  for (const row of data ?? []) {
    const existing = map.get(row.user_id) ?? [];
    existing.push(row.badge_type as BadgeType);
    map.set(row.user_id, existing);
  }
  return map;
}
