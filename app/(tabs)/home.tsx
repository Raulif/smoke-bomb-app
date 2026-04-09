import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { getUserGroups, type GroupWithMeta } from '../../lib/groups';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';

export default function HomeScreen() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await getUserGroups(profile.id);
      setGroups(data);
    } catch {
      // silently fail — user sees empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

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
        <View>
          <Text style={styles.greeting}>Hey, {profile?.username} 👋</Text>
          <Text style={styles.title}>Your Groups</Text>
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        contentContainerStyle={groups.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💨</Text>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a group or join one with an invite code to start throwing smoke bombs.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupCard}
            onPress={() => router.push(`/group/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.groupCardLeft}>
              <View style={styles.groupNameRow}>
                <Text style={styles.groupName}>{item.name}</Text>
                {item.has_active_session && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>LIVE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.groupMeta}>
                {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <View style={styles.groupCardRight}>
              <Text style={styles.groupPoints}>{item.my_points}</Text>
              <Text style={styles.groupPointsLabel}>pts</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/group/create')}
        >
          <Text style={styles.primaryButtonText}>Create a group</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/group/join')}
        >
          <Text style={styles.secondaryButtonText}>Join with invite code</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupCardLeft: {
    flex: 1,
    gap: 4,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  groupName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  activePill: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  groupMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  groupCardRight: {
    alignItems: 'flex-end',
  },
  groupPoints: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  groupPointsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  actions: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
