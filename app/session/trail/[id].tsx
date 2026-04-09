import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getGroup, getGroupMembers, type MemberWithProfile } from '../../../lib/groups';
import { getSession, getLatestSmokeBomb, getAccusations } from '../../../lib/sessions';
import { generateAvatarUrl } from '../../../lib/auth';
import { Colors, Spacing, FontSize, Radius } from '../../../lib/theme';
import type { SessionRow, SmokeBombRow, AccusationRow } from '../../../lib/types';

type TrailEventType =
  | 'session_start'
  | 'bomb_thrown'
  | 'accusation_wrong'
  | 'accusation_correct'
  | 'home'
  | 'session_end';

type TrailEvent = {
  id: string;
  timestamp: string;
  type: TrailEventType;
  actorName: string | null;
  actorAvatar: string | null;
  targetName: string | null;
  pointsEarned: number | null;
  victoryMessage: string | null;
  // Only set on accusation_correct — the private message from the thrower to their catcher
  caughtMessage: string | null;
  accusedById: string | null;
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

function buildTimeline(
  session: SessionRow,
  smokeBomb: SmokeBombRow | null,
  accusations: AccusationRow[],
  members: MemberWithProfile[],
): TrailEvent[] {
  const events: TrailEvent[] = [];

  const findMember = (userId: string) => members.find(m => m.user_id === userId);

  events.push({
    id: 'session_start',
    timestamp: session.created_at,
    type: 'session_start',
    actorName: null,
    actorAvatar: null,
    targetName: null,
    pointsEarned: null,
    victoryMessage: null,
    caughtMessage: null,
    accusedById: null,
  });

  if (smokeBomb) {
    const thrower = findMember(smokeBomb.thrown_by);

    events.push({
      id: `bomb_${smokeBomb.id}`,
      timestamp: smokeBomb.activated_at,
      type: 'bomb_thrown',
      actorName: thrower?.users.username ?? 'Unknown',
      actorAvatar: thrower?.users.avatar_url ?? generateAvatarUrl(smokeBomb.thrown_by),
      targetName: null,
      pointsEarned: null,
      victoryMessage: null,
      caughtMessage: null,
      accusedById: null,
    });

    for (const acc of accusations) {
      const accuser = findMember(acc.accused_by);
      const accused = findMember(acc.accused_user_id);
      events.push({
        id: acc.id,
        timestamp: acc.accused_at,
        type: acc.correct ? 'accusation_correct' : 'accusation_wrong',
        actorName: accuser?.users.username ?? 'Unknown',
        actorAvatar: accuser?.users.avatar_url ?? generateAvatarUrl(acc.accused_by),
        targetName: accused?.users.username ?? 'Unknown',
        pointsEarned: acc.points_earned ?? null,
        victoryMessage: null,
        caughtMessage: acc.correct ? (smokeBomb.caught_message ?? null) : null,
        accusedById: acc.correct ? acc.accused_by : null,
      });
    }

    if (smokeBomb.status === 'escaped' && smokeBomb.arrived_home_at) {
      events.push({
        id: 'home',
        timestamp: smokeBomb.arrived_home_at,
        type: 'home',
        actorName: thrower?.users.username ?? 'Unknown',
        actorAvatar: thrower?.users.avatar_url ?? generateAvatarUrl(smokeBomb.thrown_by),
        targetName: null,
        pointsEarned: smokeBomb.points_earned ?? null,
        victoryMessage: smokeBomb.victory_message,
        caughtMessage: null,
        accusedById: null,
      });
    }
  }

  if (session.closed_at) {
    events.push({
      id: 'session_end',
      timestamp: session.closed_at,
      type: 'session_end',
      actorName: null,
      actorAvatar: null,
      targetName: null,
      pointsEarned: null,
      victoryMessage: null,
      caughtMessage: null,
      accusedById: null,
    });
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return events;
}

const EVENT_CONFIG: Record<
  TrailEventType,
  { emoji: string; dotColor: string; label: (e: TrailEvent) => string }
> = {
  session_start: {
    emoji: '🌃',
    dotColor: Colors.textSecondary,
    label: () => 'Session started',
  },
  bomb_thrown: {
    emoji: '💨',
    dotColor: Colors.primary,
    label: e => `${e.actorName} threw a smoke bomb`,
  },
  accusation_wrong: {
    emoji: '❌',
    dotColor: Colors.danger,
    label: e => `${e.actorName} accused ${e.targetName} — wrong!`,
  },
  accusation_correct: {
    emoji: '🕵️',
    dotColor: Colors.success,
    label: e => `${e.actorName} caught ${e.targetName}!`,
  },
  home: {
    emoji: '🏠',
    dotColor: Colors.success,
    label: e => `${e.actorName} made it home!`,
  },
  session_end: {
    emoji: '🏁',
    dotColor: Colors.textSecondary,
    label: () => 'Session ended',
  },
};

export default function SmokeTrailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TrailEvent[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const session = await getSession(id);
      if (!session) { router.back(); return; }
      if (session.status !== 'closed') { router.back(); return; }

      const [smokeBomb, group, members] = await Promise.all([
        getLatestSmokeBomb(id),
        getGroup(session.group_id),
        getGroupMembers(session.group_id),
      ]);

      const accusations = smokeBomb ? await getAccusations(smokeBomb.id) : [];

      setGroupName(group?.name ?? null);
      setTimeline(buildTimeline(session, smokeBomb, accusations, members));
    } catch {
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Smoke Trail</Text>
          {groupName ? <Text style={styles.subtitle}>{groupName}</Text> : null}
        </View>
        {/* spacer to balance back button */}
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {timeline.map((event, index) => {
          const config = EVENT_CONFIG[event.type];
          const isLast = index === timeline.length - 1;
          const isMe = profile && (
            (event.type === 'bomb_thrown' || event.type === 'home') &&
            event.actorName === profile.username
          );

          return (
            <View key={event.id} style={styles.eventRow}>
              {/* Timeline spine */}
              <View style={styles.spine}>
                <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
                {!isLast && <View style={styles.line} />}
              </View>

              {/* Event content */}
              <View style={[styles.eventCard, isLast && styles.eventCardLast]}>
                <View style={styles.eventTop}>
                  <Text style={styles.eventEmoji}>{config.emoji}</Text>
                  <View style={styles.eventMeta}>
                    <Text style={styles.eventLabel}>{config.label(event)}</Text>
                    <Text style={styles.eventTime}>{formatTime(event.timestamp)}</Text>
                  </View>
                  {event.actorAvatar && (event.type === 'bomb_thrown' || event.type === 'home' || event.type === 'accusation_correct' || event.type === 'accusation_wrong') && (
                    <Image
                      source={{ uri: event.actorAvatar }}
                      style={[styles.avatar, isMe && styles.avatarMe]}
                    />
                  )}
                </View>

                {/* Victory message — only shown on 'home' events */}
                {event.type === 'home' && event.victoryMessage ? (
                  <Text style={styles.victoryMessage}>"{event.victoryMessage}"</Text>
                ) : null}

                {/* Caught message — only shown to the correct accuser */}
                {event.type === 'accusation_correct' &&
                  event.caughtMessage &&
                  profile?.id === event.accusedById ? (
                  <View style={styles.caughtMessageBox}>
                    <Text style={styles.caughtMessageLabel}>Their message to you</Text>
                    <Text style={styles.caughtMessageText}>"{event.caughtMessage}"</Text>
                  </View>
                ) : null}

                {/* Points badge */}
                {event.pointsEarned != null && (
                  <View style={[
                    styles.pointsBadge,
                    event.type === 'accusation_wrong' && styles.pointsBadgeNegative,
                  ]}>
                    <Text style={styles.pointsText}>
                      {event.type === 'accusation_wrong' ? '−' : '+'}
                      {Math.abs(event.pointsEarned)} pts
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.xs,
    width: 40,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: FontSize.xl,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  spine: {
    alignItems: 'center',
    width: 16,
    paddingTop: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  eventCard: {
    flex: 1,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  eventCardLast: {
    paddingBottom: 0,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  eventEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  eventMeta: {
    flex: 1,
    gap: 2,
  },
  eventLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 22,
  },
  eventTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
  },
  avatarMe: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  victoryMessage: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontStyle: 'italic',
    marginLeft: 28,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  pointsBadge: {
    alignSelf: 'flex-start',
    marginLeft: 28,
    backgroundColor: Colors.success,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  pointsBadgeNegative: {
    backgroundColor: Colors.danger,
  },
  pointsText: {
    color: Colors.background,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  caughtMessageBox: {
    marginLeft: 28,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    gap: 4,
  },
  caughtMessageLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  caughtMessageText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
