import { supabase } from './supabase';
import type { SessionRow, SmokeBombRow, AccusationRow } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SessionWithSmokeBomb = SessionRow & {
  active_smoke_bomb: SmokeBombRow | null;
};

export async function throwSmokeBomb(
  sessionId: string,
  userId: string,
  victoryMessage: string | null,
  caughtMessage: string | null,
): Promise<SmokeBombRow> {
  const { data: existing } = await supabase
    .from('smoke_bombs')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .single();

  if (existing) throw new Error('A smoke bomb is already active in this session.');

  const { data, error } = await supabase
    .from('smoke_bombs')
    .insert({
      session_id: sessionId,
      thrown_by: userId,
      victory_message: victoryMessage || null,
      caught_message: caughtMessage || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelSmokeBomb(bombId: string): Promise<void> {
  const { count } = await supabase
    .from('accusations')
    .select('*', { count: 'exact', head: true })
    .eq('smoke_bomb_id', bombId);

  if (count && count > 0) {
    throw new Error('Cannot cancel — an accusation has already been made.');
  }

  const { error } = await supabase
    .from('smoke_bombs')
    .update({ status: 'cancelled' })
    .eq('id', bombId)
    .eq('status', 'active');

  if (error) throw error;
}

export async function arriveHome(smokeBombId: string, sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('smoke_bombs')
    .update({ status: 'escaped', arrived_home_at: new Date().toISOString() })
    .eq('id', smokeBombId);

  if (error) throw error;
  await closeSession(sessionId);
  // Best-effort — session close is the critical action; real-time delivers results to all players
  try {
    await calculateSessionPoints(sessionId);
  } catch (e) {
    console.error('Points calculation failed:', e);
  }
  try {
    await awardSessionBadges(sessionId);
  } catch (e) {
    console.error('Badge award failed:', e);
  }
}

// Calls the DB function that calculates and writes all points for a closed session.
// Idempotent — safe to call multiple times.
export async function calculateSessionPoints(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('calculate_session_points', {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function awardSessionBadges(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('award_session_badges', {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function getLatestSmokeBomb(sessionId: string): Promise<SmokeBombRow | null> {
  const { data } = await supabase
    .from('smoke_bombs')
    .select('*')
    .eq('session_id', sessionId)
    .neq('status', 'cancelled')
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();

  return data ?? null;
}

export async function createSession(groupId: string, userId: string): Promise<SessionRow> {
  // Ensure no active session already exists for this group
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .single();

  if (existing) throw new Error('A session is already active for this group.');

  const { data, error } = await supabase
    .from('sessions')
    .insert({ group_id: groupId, started_by: userId, status: 'active' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function closeSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function getActiveSession(groupId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .single();

  if (error) return null;
  return data;
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) return null;
  return data;
}

export async function getActiveSmokeBomb(sessionId: string): Promise<SmokeBombRow | null> {
  const { data, error } = await supabase
    .from('smoke_bombs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .single();

  if (error) return null;
  return data;
}

export async function getSessionHistory(groupId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

// Real-time subscription to a session and its smoke bombs
export function subscribeToSession(
  sessionId: string,
  onSessionChange: (session: SessionRow) => void,
  onSmokeBombChange: (smokeBomb: SmokeBombRow | null) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      payload => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          onSessionChange(payload.new as SessionRow);
        }
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'smoke_bombs', filter: `session_id=eq.${sessionId}` },
      async () => {
        // Fetch the latest bomb regardless of status so resolved state is preserved
        const bomb = await getLatestSmokeBomb(sessionId);
        onSmokeBombChange(bomb);
      },
    )
    .subscribe();

  return channel;
}

export function unsubscribe(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

/**
 * Submit an accusation. Correctness is resolved immediately by comparing
 * accused_user_id to the bomb's thrown_by. A correct accusation marks the bomb
 * as 'discovered', closes the session, and triggers points calculation.
 */
export async function makeAccusation(
  smokeBombId: string,
  sessionId: string,
  accusedBy: string,
  accusedUserId: string,
  thrownBy: string,
): Promise<{ isCorrect: boolean; caughtMessage: string | null }> {
  const isCorrect = accusedUserId === thrownBy;

  const { error } = await supabase
    .from('accusations')
    .insert({
      smoke_bomb_id: smokeBombId,
      accused_by: accusedBy,
      accused_user_id: accusedUserId,
      correct: isCorrect,
    });

  if (error) throw error;

  if (isCorrect) {
    const { data: bomb } = await supabase
      .from('smoke_bombs')
      .select('caught_message')
      .eq('id', smokeBombId)
      .single();

    const { error: bombErr } = await supabase
      .from('smoke_bombs')
      .update({ status: 'discovered' })
      .eq('id', smokeBombId);

    if (bombErr) throw bombErr;

    await closeSession(sessionId);

    try {
      await calculateSessionPoints(sessionId);
    } catch (e) {
      console.error('Points calculation failed:', e);
    }
    try {
      await awardSessionBadges(sessionId);
    } catch (e) {
      console.error('Badge award failed:', e);
    }

    // Best-effort — notify the thrower via push notification
    try {
      await supabase.functions.invoke('notify-caught', {
        body: { thrower_id: thrownBy, catcher_id: accusedBy },
      });
    } catch (e) {
      console.error('Caught notification failed:', e);
    }

    return { isCorrect: true, caughtMessage: bomb?.caught_message ?? null };
  }

  return { isCorrect: false, caughtMessage: null };
}

/** Fetch all accusations for a smoke bomb, ordered by time. */
export async function getAccusations(smokeBombId: string): Promise<AccusationRow[]> {
  const { data } = await supabase
    .from('accusations')
    .select('*')
    .eq('smoke_bomb_id', smokeBombId)
    .order('accused_at', { ascending: true });
  return data ?? [];
}

// Formats elapsed seconds into mm:ss
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Returns elapsed seconds since a given ISO timestamp (server-safe: uses Date.now())
export function elapsedSeconds(since: string): number {
  return Math.floor((Date.now() - new Date(since).getTime()) / 1000);
}
