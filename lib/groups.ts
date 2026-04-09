import { supabase } from './supabase';
import type { GroupRow, GroupMemberRow, UserRow } from './types';

export type GroupWithMeta = GroupRow & {
  member_count: number;
  my_points: number;
  has_active_session: boolean;
};

export type MemberWithProfile = GroupMemberRow & {
  users: Pick<UserRow, 'id' | 'username' | 'avatar_url'>;
};

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, I/1 to avoid confusion
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createGroup(name: string, userId: string): Promise<GroupRow> {
  const inviteCode = generateInviteCode();

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: name.trim(), invite_code: inviteCode, created_by: userId })
    .select()
    .single();

  if (groupError) throw groupError;

  // Add creator as member
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, total_points: 0 });

  if (memberError) throw memberError;

  // Best-effort — award Founder badge on first group creation
  try {
    await supabase.from('badges').insert({ user_id: userId, badge_type: 'founder' });
  } catch {
    // Already has the badge or insert failed — not critical
  }

  return group;
}

export async function joinGroup(inviteCode: string, userId: string): Promise<GroupRow> {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .single();

  if (groupError || !group) throw new Error('Group not found. Check the invite code and try again.');

  // Check if already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .single();

  if (existing) throw new Error("You're already a member of this group.");

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, total_points: 0 });

  if (memberError) throw memberError;

  return group;
}

export async function getUserGroups(userId: string): Promise<GroupWithMeta[]> {
  // Get all groups the user belongs to
  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('total_points, group_id')
    .eq('user_id', userId);

  if (error) throw error;
  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);

  // Get group details + member counts + active session flag in parallel
  const [groupsResult, countsResult, sessionsResult] = await Promise.all([
    supabase.from('groups').select('*').in('id', groupIds),
    supabase.from('group_members').select('group_id').in('group_id', groupIds),
    supabase.from('sessions').select('group_id').in('group_id', groupIds).eq('status', 'active'),
  ]);

  if (groupsResult.error) throw groupsResult.error;

  const countMap: Record<string, number> = {};
  for (const m of countsResult.data ?? []) {
    countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1;
  }

  const activeSessionSet = new Set((sessionsResult.data ?? []).map(s => s.group_id));

  const pointsMap: Record<string, number> = {};
  for (const m of memberships) {
    pointsMap[m.group_id] = m.total_points;
  }

  return (groupsResult.data ?? []).map(group => ({
    ...group,
    member_count: countMap[group.id] ?? 0,
    my_points: pointsMap[group.id] ?? 0,
    has_active_session: activeSessionSet.has(group.id),
  }));
}

export async function getGroupMembers(groupId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, users(id, username, avatar_url)')
    .eq('group_id', groupId)
    .order('total_points', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MemberWithProfile[];
}

export async function getGroup(groupId: string): Promise<GroupRow | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) return null;
  return data;
}
