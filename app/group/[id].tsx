import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Share,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { getGroup, getGroupMembers, type MemberWithProfile } from '../../lib/groups';
import { getActiveSession, createSession } from '../../lib/sessions';
import { getBadgesForUsers, BADGE_META } from '../../lib/badges';
import { generateAvatarUrl } from '../../lib/auth';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';
import type { GroupRow, SessionRow, BadgeType } from '../../lib/types';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [badgesMap, setBadgesMap] = useState<Map<string, BadgeType[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, m, s] = await Promise.all([
        getGroup(id),
        getGroupMembers(id),
        getActiveSession(id),
      ]);
      setGroup(g);
      setMembers(m);
      setActiveSession(s);
      if (m.length > 0) {
        getBadgesForUsers(m.map(mem => mem.user_id)).then(setBadgesMap).catch(() => {});
      }
    } catch {
      Alert.alert('Error', 'Could not load group.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  async function handleShareInvite() {
    if (!group) return;
    try {
      await Share.share({
        message: `Join my Smoke Bomb group "${group.name}"!\nInvite code: ${group.invite_code}`,
      });
    } catch {
      // user cancelled share sheet
    }
  }

  async function handleStartSession() {
    if (!profile || !id) return;
    setStartingSession(true);
    try {
      const session = await createSession(id, profile.id);
      router.push(`/session/${session.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not start session.');
    } finally {
      setStartingSession(false);
    }
  }

  function handleJoinSession() {
    if (activeSession) router.push(`/session/${activeSession.id}`);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Group not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>{members.length} members</Text>
        </View>
        <TouchableOpacity style={styles.inviteButton} onPress={handleShareInvite}>
          <Text style={styles.inviteButtonText}>Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Invite code banner */}
      <View style={styles.inviteBanner}>
        <Text style={styles.inviteBannerLabel}>Invite code</Text>
        <Text style={styles.inviteCode}>{group.invite_code}</Text>
      </View>

      {/* Leaderboard */}
      <Text style={styles.sectionTitle}>Leaderboard</Text>
      <FlatList
        data={members}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        renderItem={({ item, index }) => {
          const isMe = item.user_id === profile?.id;
          const avatarUrl = item.users.avatar_url ?? generateAvatarUrl(item.user_id);
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

          return (
            <View style={[styles.memberRow, isMe && styles.memberRowHighlight]}>
              <Text style={styles.rank}>{medal ?? `#${index + 1}`}</Text>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, isMe && styles.memberNameMe]}>
                  {item.users.username ?? 'Unknown'}
                  {isMe ? ' (you)' : ''}
                </Text>
                {(badgesMap.get(item.user_id) ?? []).length > 0 && (
                  <Text style={styles.badgeEmojis}>
                    {(badgesMap.get(item.user_id) ?? []).map(b => BADGE_META[b].emoji).join(' ')}
                  </Text>
                )}
              </View>
              <Text style={styles.memberPoints}>{item.total_points} pts</Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.sessionSection}>
            {activeSession ? (
              <TouchableOpacity style={styles.joinSessionButton} onPress={handleJoinSession}>
                <View style={styles.liveDot} />
                <Text style={styles.joinSessionText}>Session in progress — join</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.startSessionButton, startingSession && styles.buttonDisabled]}
                onPress={handleStartSession}
                disabled={startingSession}
              >
                {startingSession ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.startSessionText}>💨 Start a session</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        }
      />
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
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  backLink: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
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
  groupName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  memberCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  inviteButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviteButtonText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviteBannerLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  inviteCode: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 4,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xs,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  memberRowHighlight: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  rank: {
    fontSize: FontSize.md,
    width: 32,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  memberNameMe: {
    color: Colors.primary,
  },
  badgeEmojis: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  memberPoints: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  sessionSection: {
    marginTop: Spacing.lg,
  },
  startSessionButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  startSessionText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  joinSessionButton: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text,
  },
  joinSessionText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
