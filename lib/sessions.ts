import { supabase } from './supabase';
import type { SessionRow, SmokeBombRow } from './types';
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

export async function arriveHome(smokeBombId: string, sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('smoke_bombs')
    .update({ status: 'escaped', arrived_home_at: new Date().toISOString() })
    .eq('id', smokeBombId);

  if (error) throw error;
  await closeSession(sessionId);
}

export async function getLatestSmokeBomb(sessionId: string): Promise<SmokeBombRow | null> {
  const { data } = await supabase
    .from('smoke_bombs')
    .select('*')
    .eq('session_id', sessionId)
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
