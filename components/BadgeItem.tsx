import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../lib/theme';

type Props = {
  emoji: string;
  label: string;
  earned: boolean;
  /** Used to stagger the entrance animation for earned badges. */
  index: number;
};

/**
 * A badge grid cell that springs in on mount if earned,
 * or renders statically at low opacity if locked.
 */
export function BadgeItem({ emoji, label, earned, index }: Props) {
  const scale = useRef(new Animated.Value(earned ? 0 : 1)).current;
  const opacity = useRef(new Animated.Value(earned ? 0 : 1)).current;

  useEffect(() => {
    if (!earned) return;

    const delay = index * 50;
    Animated.parallel([
      Animated.sequence([
        Animated.delay(delay),
        Animated.spring(scale, {
          toValue: 1.15,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 180,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [earned, index, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.badgeItem,
        !earned && styles.badgeLocked,
        earned && { transform: [{ scale }], opacity },
      ]}
    >
      <Text style={styles.badgeEmoji}>{emoji}</Text>
      <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  badgeLabel: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeLabelLocked: {
    color: Colors.textSecondary,
  },
});
