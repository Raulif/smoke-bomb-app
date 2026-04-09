import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth, generateAvatarUrl } from '../../lib/auth';
import { getUserBadges, BADGE_META } from '../../lib/badges';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';
import type { BadgeType } from '../../lib/types';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Set<BadgeType>>(new Set());

  useEffect(() => {
    if (profile?.id) {
      getUserBadges(profile.id).then(rows => {
        setEarnedBadges(new Set(rows.map(r => r.badge_type)));
      }).catch(() => {});
    }
  }, [profile?.id]);

  const avatarUrl = profile?.avatar_url ?? generateAvatarUrl(profile?.id ?? 'default');

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Failed to sign out.');
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        <Text style={styles.username}>{profile?.username ?? '—'}</Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsValue}>{profile?.lifetime_points ?? 0}</Text>
          <Text style={styles.pointsLabel}>lifetime pts</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <Text style={styles.sectionSubtitle}>Earn badges by playing</Text>
        <View style={styles.badgesGrid}>
          {(Object.keys(BADGE_META) as BadgeType[]).map(type => {
            const meta = BADGE_META[type];
            const earned = earnedBadges.has(type);
            return (
              <View key={type} style={[styles.badgeItem, !earned && styles.badgeLocked]}>
                <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
                  {meta.emoji}
                </Text>
                <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>
                  {meta.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, signingOut && styles.buttonDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color={Colors.danger} size="small" />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.xs,
  },
  username: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  pointsBadge: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pointsValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  pointsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: -Spacing.xs,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  badgeItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    width: '30%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeLocked: {
    opacity: 0.3,
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeEmojiLocked: {
    // grayscale handled by opacity on parent
  },
  badgeLabel: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeLabelLocked: {
    color: Colors.textSecondary,
  },
  signOutButton: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  signOutText: {
    color: Colors.danger,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
