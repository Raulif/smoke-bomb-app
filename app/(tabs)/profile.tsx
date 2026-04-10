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
  TextInput,
} from 'react-native';
import { useAuth, generateAvatarUrl } from '../../lib/auth';
import { getUserBadges, BADGE_META } from '../../lib/badges';
import { geocodeAddress, saveHomeLocation } from '../../lib/location';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';
import type { BadgeType } from '../../lib/types';
import { BadgeItem } from '../../components/BadgeItem';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Set<BadgeType>>(new Set());
  const [homeAddress, setHomeAddress] = useState('');
  const [savingHome, setSavingHome] = useState(false);

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

  async function handleSaveHome() {
    if (!profile || !homeAddress.trim()) return;
    setSavingHome(true);
    try {
      const coords = await geocodeAddress(homeAddress.trim());
      if (!coords) {
        Alert.alert('Address not found', 'Could not find that address. Try being more specific.');
        return;
      }
      await saveHomeLocation(profile.id, coords.latitude, coords.longitude);
      await refreshProfile();
      setHomeAddress('');
      Alert.alert('Home saved', 'GPS auto-detection is now active when you throw a smoke bomb.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save home address.');
    } finally {
      setSavingHome(false);
    }
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
          {(Object.keys(BADGE_META) as BadgeType[]).map((type, index) => {
            const meta = BADGE_META[type];
            const earned = earnedBadges.has(type);
            return (
              <BadgeItem
                key={type}
                emoji={meta.emoji}
                label={meta.label}
                earned={earned}
                index={index}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Home address</Text>
        <Text style={styles.sectionSubtitle}>
          {profile?.home_latitude != null
            ? 'Home is set — GPS auto-detection active'
            : 'Set your home address to enable GPS auto-detection'}
        </Text>
        {profile?.home_latitude != null && (
          <Text style={styles.homeSetLabel}>Home set</Text>
        )}
        <TextInput
          style={styles.addressInput}
          placeholder="Enter your home address"
          placeholderTextColor={Colors.textSecondary}
          value={homeAddress}
          onChangeText={setHomeAddress}
          returnKeyType="done"
          onSubmitEditing={handleSaveHome}
        />
        <TouchableOpacity
          style={[styles.saveHomeButton, savingHome && styles.buttonDisabled]}
          onPress={handleSaveHome}
          disabled={savingHome || !homeAddress.trim()}
        >
          {savingHome ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Text style={styles.saveHomeText}>Save home</Text>
          )}
        </TouchableOpacity>
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
  homeSetLabel: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  addressInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveHomeButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  saveHomeText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
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
