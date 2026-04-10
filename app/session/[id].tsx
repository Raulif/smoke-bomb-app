import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../../lib/auth';
import { getGroup, getGroupMembers, type MemberWithProfile } from '../../lib/groups';
import { getBadgesForUsers, BADGE_META } from '../../lib/badges';
import {
  getSession,
  getLatestSmokeBomb,
  throwSmokeBomb,
  cancelSmokeBomb,
  arriveHome,
  closeSession,
  makeAccusation,
  getAccusations,
  subscribeToSession,
  unsubscribe,
  formatDuration,
  elapsedSeconds,
} from '../../lib/sessions';
import { generateAvatarUrl } from '../../lib/auth';
import { useHomeDetection } from '../../lib/useHomeDetection';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';
import type { SessionRow, SmokeBombRow, GroupRow, AccusationRow, BadgeType } from '../../lib/types';
import { LiveDot } from '../../components/LiveDot';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [session, setSession] = useState<SessionRow | null>(null);
  const [smokeBomb, setSmokeBomb] = useState<SmokeBombRow | null>(null);
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [closing, setClosing] = useState(false);
  const [showThrowModal, setShowThrowModal] = useState(false);
  const [victoryMsg, setVictoryMsg] = useState('');
  const [caughtMsg, setCaughtMsg] = useState('');
  const [throwing, setThrowing] = useState(false);
  const [arrivingHome, setArrivingHome] = useState(false);
  const [accusations, setAccusations] = useState<AccusationRow[]>([]);
  const [badgesMap, setBadgesMap] = useState<Map<string, BadgeType[]>>(new Map());
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [accusingUserId, setAccusingUserId] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  const caughtAlertShown = useRef(false);

  // ─── Animation values ─────────────────────────────────────────────────────
  const bombCardOpacity  = useRef(new Animated.Value(1)).current;
  const bombCardShake    = useRef(new Animated.Value(0)).current;
  const bombEmojiScale   = useRef(new Animated.Value(1)).current;
  const timerPulse       = useRef(new Animated.Value(0)).current;
  const resultCardAnim   = useRef(new Animated.Value(0)).current;
  const pointsBadgeScale = useRef(new Animated.Value(0)).current;
  const throwButtonPulse = useRef(new Animated.Value(0)).current;
  const throwButtonPress = useRef(new Animated.Value(1)).current;
  const homeButtonPulse  = useRef(new Animated.Value(0)).current;
  // Loop handles for cleanup
  const timerLoop   = useRef<Animated.CompositeAnimation | null>(null);
  const throwLoop   = useRef<Animated.CompositeAnimation | null>(null);
  const homeLoop    = useRef<Animated.CompositeAnimation | null>(null);
  // Track previous points value to detect async arrival
  const prevPointsRef = useRef<number | null | undefined>(undefined);

  // ─── Timer heartbeat (thrower only) ───────────────────────────────────────
  useEffect(() => {
    const on =
      smokeBomb?.status === 'active' &&
      smokeBomb?.thrown_by === profile?.id &&
      session?.status === 'active';

    if (on) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      timerLoop.current = loop;
      loop.start();
    } else {
      timerLoop.current?.stop();
      timerLoop.current = null;
      timerPulse.setValue(0);
    }
    return () => { timerLoop.current?.stop(); };
  }, [smokeBomb?.status, smokeBomb?.thrown_by, profile?.id, session?.status, timerPulse]);

  // ─── Throw button idle pulse ───────────────────────────────────────────────
  useEffect(() => {
    const on =
      session?.status !== 'closed' &&
      !(smokeBomb?.status === 'active' && smokeBomb?.thrown_by === profile?.id);

    if (on) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(throwButtonPulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(throwButtonPulse, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      throwLoop.current = loop;
      loop.start();
    } else {
      throwLoop.current?.stop();
      throwLoop.current = null;
      throwButtonPulse.setValue(0);
    }
    return () => { throwLoop.current?.stop(); };
  }, [session?.status, smokeBomb?.status, smokeBomb?.thrown_by, profile?.id, throwButtonPulse]);

  // ─── Home button pulse (thrower only) ─────────────────────────────────────
  useEffect(() => {
    const on =
      smokeBomb?.status === 'active' &&
      smokeBomb?.thrown_by === profile?.id &&
      session?.status === 'active';

    if (on) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(homeButtonPulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(homeButtonPulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      homeLoop.current = loop;
      loop.start();
    } else {
      homeLoop.current?.stop();
      homeLoop.current = null;
      homeButtonPulse.setValue(0);
    }
    return () => { homeLoop.current?.stop(); };
  }, [smokeBomb?.status, smokeBomb?.thrown_by, profile?.id, session?.status, homeButtonPulse]);

  // ─── Points badge pop (async edge-function delivery) ──────────────────────
  useEffect(() => {
    const pts = smokeBomb?.points_earned;
    if (prevPointsRef.current !== undefined && pts != null && prevPointsRef.current == null) {
      Animated.sequence([
        Animated.spring(pointsBadgeScale, { toValue: 1.2, tension: 200, friction: 8, useNativeDriver: true }),
        Animated.spring(pointsBadgeScale, { toValue: 1,   tension: 180, friction: 10, useNativeDriver: true }),
      ]).start();
    }
    prevPointsRef.current = pts;
  }, [smokeBomb?.points_earned, pointsBadgeScale]);

  const isActiveThrowee =
    smokeBomb?.status === 'active' && smokeBomb.thrown_by === profile?.id && session?.status === 'active';

  const { tracking: gpsTracking, permissionDenied: gpsPermissionDenied } = useHomeDetection({
    enabled: isActiveThrowee ?? false,
    smokeBombId: smokeBomb?.id ?? null,
    sessionId: session?.id ?? null,
    homeLatitude: profile?.home_latitude ?? null,
    homeLongitude: profile?.home_longitude ?? null,
    onArrived: async () => {
      if (smokeBomb && session) await arriveHome(smokeBomb.id, session.id);
    },
  });

  const startTimer = useCallback((since: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(elapsedSeconds(since));
    timerRef.current = setInterval(() => {
      setElapsed(elapsedSeconds(since));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, bomb] = await Promise.all([getSession(id), getLatestSmokeBomb(id)]);
      if (!s) { router.back(); return; }

      setSession(s);
      setSmokeBomb(bomb);

      const [g, m] = await Promise.all([
        getGroup(s.group_id),
        getGroupMembers(s.group_id),
      ]);
      setGroup(g);
      setMembers(m);
      if (m.length > 0) {
        getBadgesForUsers(m.map(mem => mem.user_id)).then(setBadgesMap).catch(() => {});
      }

      if (bomb?.status === 'active' && bomb.activated_at) startTimer(bomb.activated_at);

      // Already-closed session: skip animation, show results immediately
      if (s.status === 'closed') {
        resultCardAnim.setValue(1);
        if (bomb?.points_earned != null) pointsBadgeScale.setValue(1);
        setLoading(false);
        return;
      }

      channelRef.current = subscribeToSession(
        id,
        updatedSession => {
          setSession(updatedSession);
          if (updatedSession.status === 'closed') {
            stopTimer();
            resultCardAnim.setValue(0);
            Animated.spring(resultCardAnim, {
              toValue: 1,
              tension: 120,
              friction: 14,
              useNativeDriver: true,
            }).start();
          }
        },
        updatedBomb => {
          // Burst animation — thrower only, on the moment they throw
          if (updatedBomb?.status === 'active' && updatedBomb.thrown_by === profileRef.current?.id) {
            bombCardOpacity.setValue(0);
            bombEmojiScale.setValue(1);
            bombCardShake.setValue(0);
            Animated.parallel([
              Animated.timing(bombCardOpacity, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.spring(bombEmojiScale, { toValue: 1.8, tension: 200, friction: 5,  useNativeDriver: true }),
                Animated.spring(bombEmojiScale, { toValue: 1,   tension: 200, friction: 8,  useNativeDriver: true }),
              ]),
              Animated.sequence([
                Animated.timing(bombCardShake, { toValue:  8, duration: 60, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(bombCardShake, { toValue: -8, duration: 60, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(bombCardShake, { toValue:  5, duration: 60, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(bombCardShake, { toValue: -5, duration: 60, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(bombCardShake, { toValue:  0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
              ]),
            ]).start();
          }

          setSmokeBomb(updatedBomb);
          if (updatedBomb?.status === 'active' && updatedBomb.activated_at) {
            startTimer(updatedBomb.activated_at);
          } else {
            stopTimer();
            setElapsed(0);
            if (
              !caughtAlertShown.current &&
              updatedBomb?.status === 'discovered' &&
              updatedBomb?.status !== 'cancelled' &&
              updatedBomb.thrown_by === profileRef.current?.id
            ) {
              caughtAlertShown.current = true;
              Alert.alert("🕵️ You've been caught!", 'Someone figured you out. Check the Smoke Trail for the full story.');
            }
          }
        },
      );
    } catch {
      Alert.alert('Error', 'Could not load session.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, startTimer, stopTimer, resultCardAnim, pointsBadgeScale, bombCardOpacity, bombEmojiScale, bombCardShake]);

  useEffect(() => {
    load();
    return () => {
      stopTimer();
      if (channelRef.current) unsubscribe(channelRef.current);
    };
  }, [load, stopTimer]);

  useEffect(() => {
    if (smokeBomb?.id) {
      getAccusations(smokeBomb.id).then(setAccusations).catch(() => {});
    }
  }, [smokeBomb?.id]);

  async function handleThrowSmokeBomb() {
    if (!session || !profile) return;
    setThrowing(true);
    try {
      await throwSmokeBomb(session.id, profile.id, victoryMsg.trim() || null, caughtMsg.trim() || null);
      setShowThrowModal(false);
      setVictoryMsg('');
      setCaughtMsg('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not throw smoke bomb.');
    } finally {
      setThrowing(false);
    }
  }

  async function handleArriveHome() {
    if (!smokeBomb || !session) return;
    Alert.alert(
      "You're home! 🏠",
      'Confirm you made it back safely. This ends the session.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: "I'm home!",
          onPress: async () => {
            setArrivingHome(true);
            try {
              await arriveHome(smokeBomb.id, session.id);
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not mark arrival.');
            } finally {
              setArrivingHome(false);
            }
          },
        },
      ],
    );
  }

  async function handleCancelSmokeBomb() {
    if (!smokeBomb) return;
    Alert.alert(
      'Cancel smoke bomb?',
      "You'll return to the game as if nothing happened.",
      [
        { text: 'Keep running', style: 'cancel' },
        {
          text: 'Cancel bomb',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSmokeBomb(smokeBomb.id);
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not cancel smoke bomb.');
            }
          },
        },
      ],
    );
  }

  function handleAccuseTap(target: MemberWithProfile) {
    if (!smokeBomb || smokeBomb.status !== 'active') {
      Alert.alert('No active smoke bomb', "Nobody has snuck out yet. 🤫");
      return;
    }
    Alert.alert(
      `Accuse ${target.users.username}?`,
      "Wrong accusation costs you 5 points.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Point the finger!', style: 'destructive', onPress: () => submitAccusation(target) },
      ],
    );
  }

  async function submitAccusation(target: MemberWithProfile) {
    if (!smokeBomb || !session || !profile) return;
    setAccusingUserId(target.user_id);
    try {
      const { isCorrect, caughtMessage } = await makeAccusation(
        smokeBomb.id,
        session.id,
        profile.id,
        target.user_id,
        smokeBomb.thrown_by,
      );
      setShowAccuseModal(false);
      if (isCorrect) {
        const body = caughtMessage ? `They left you a message:\n\n"${caughtMessage}"` : 'You busted them!';
        Alert.alert(`🕵️ Caught! It was ${target.users.username}.`, body);
      } else {
        Alert.alert('Wrong! 🤦', `${target.users.username} didn't sneak out. -5 points.`);
        const updated = await getAccusations(smokeBomb.id);
        setAccusations(updated);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not submit accusation.');
    } finally {
      setAccusingUserId(null);
    }
  }

  async function handleCloseSession() {
    if (!session) return;
    Alert.alert(
      'Close session',
      'Are you sure you want to end the session for everyone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End session',
          style: 'destructive',
          onPress: async () => {
            setClosing(true);
            try {
              await closeSession(session.id);
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not close session.');
              setClosing(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const isClosed  = session?.status === 'closed';
  const hasBomb   = smokeBomb?.status === 'active';
  const isThrower = hasBomb && smokeBomb?.thrown_by === profile?.id;
  const bomber    = members.find(m => m.user_id === smokeBomb?.thrown_by);

  const timerOpacity     = timerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] });
  const timerScale       = timerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const throwIdleOpacity = throwButtonPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
  const throwIdleScale   = throwButtonPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const resultOpacity    = resultCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const resultTranslateY = resultCardAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const homeOpacity      = homeButtonPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });
  const homeScale        = homeButtonPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.groupName}>{group?.name ?? '…'}</Text>
          <View style={styles.statusRow}>
            {isClosed ? (
              <Text style={styles.statusClosed}>Session ended</Text>
            ) : (
              <>
                <LiveDot />
                <Text style={styles.statusLive}>Live</Text>
              </>
            )}
          </View>
        </View>
        {!isClosed && !isThrower && (
          <TouchableOpacity style={styles.closeButton} onPress={handleCloseSession} disabled={closing}>
            {closing
              ? <ActivityIndicator color={Colors.danger} size="small" />
              : <Text style={styles.closeButtonText}>End</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Bomb status card */}
        {!isClosed && (
          <Animated.View
            style={[
              styles.bombCard,
              isThrower && styles.bombCardActive,
              { opacity: bombCardOpacity, transform: [{ translateX: bombCardShake }] },
            ]}
          >
            {isThrower ? (
              <>
                <Animated.View style={{ transform: [{ scale: bombEmojiScale }] }}>
                  <Text style={styles.bombEmoji}>🏃</Text>
                </Animated.View>
                <Text style={styles.bombTitle}>You're on the run!</Text>
                <Animated.View style={{ opacity: timerOpacity, transform: [{ scale: timerScale }] }}>
                  <Text style={styles.bombTimer}>{formatDuration(elapsed)}</Text>
                </Animated.View>
                <Text style={styles.bombSubtitle}>
                  Don't get caught. Tap "I'm home" when you're safe.
                </Text>
              </>
            ) : (
              <>
                <Animated.View style={{ transform: [{ scale: bombEmojiScale }] }}>
                  <Text style={styles.bombEmoji}>🕺</Text>
                </Animated.View>
                <Text style={styles.bombTitle}>Everyone's still here</Text>
                <Text style={styles.bombSubtitle}>
                  Throw a smoke bomb to ghost your crew silently
                </Text>
              </>
            )}
          </Animated.View>
        )}

        {/* I'm home button */}
        {!isClosed && hasBomb && isThrower && (
          <>
            <Animated.View style={{ opacity: homeOpacity, transform: [{ scale: homeScale }] }}>
              <TouchableOpacity
                style={styles.homeButton}
                onPress={handleArriveHome}
                disabled={arrivingHome}
              >
                {arrivingHome
                  ? <ActivityIndicator color={Colors.background} />
                  : <Text style={styles.homeButtonText}>🏠  I'm home!</Text>}
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.gpsStatus}>
              {gpsTracking
                ? '📍 GPS auto-detection active'
                : gpsPermissionDenied || profile?.home_latitude == null
                ? 'Set a home address in your profile to enable GPS auto-detection'
                : 'Starting GPS detection…'}
            </Text>
            <TouchableOpacity style={styles.cancelBombButton} onPress={handleCancelSmokeBomb}>
              <Text style={styles.cancelBombText}>Cancel bomb</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Closed result card */}
        {isClosed && (
          <Animated.View
            style={[
              styles.closedCard,
              { opacity: resultOpacity, transform: [{ translateY: resultTranslateY }] },
            ]}
          >
            {smokeBomb?.status === 'escaped' ? (
              <>
                <Text style={styles.closedEmoji}>💨</Text>
                <Text style={styles.closedTitle}>
                  {bomber?.users.username ?? 'Someone'} escaped!
                </Text>
                {smokeBomb.victory_message ? (
                  <Text style={styles.victoryMessage}>"{smokeBomb.victory_message}"</Text>
                ) : null}
                {smokeBomb.points_earned !== null && smokeBomb.points_earned !== undefined ? (
                  <Animated.View style={{ transform: [{ scale: pointsBadgeScale }] }}>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsText}>
                        {smokeBomb.thrown_by === profile?.id ? 'You earned ' : ''}
                        +{smokeBomb.points_earned} pts
                      </Text>
                    </View>
                  </Animated.View>
                ) : (
                  <Text style={styles.pointsCalculating}>Calculating points…</Text>
                )}
                <TouchableOpacity onPress={() => router.push(`/session/trail/${id}`)}>
                  <Text style={styles.trailLink}>View Smoke Trail →</Text>
                </TouchableOpacity>
              </>
            ) : smokeBomb?.status === 'discovered' ? (
              <>
                <Text style={styles.closedEmoji}>🕵️</Text>
                <Text style={styles.closedTitle}>
                  {bomber?.users.username ?? 'Someone'} was caught!
                </Text>
                {(() => {
                  const hit = accusations.find(a => a.correct === true);
                  const catcher = hit ? members.find(m => m.user_id === hit.accused_by) : null;
                  const wasMe = hit?.accused_by === profile?.id;
                  return (
                    <>
                      {catcher && (
                        <Text style={styles.closedSubtitle}>
                          Busted by {wasMe ? 'you' : catcher.users.username}!
                        </Text>
                      )}
                      {wasMe && hit?.points_earned != null && (
                        <View style={styles.pointsBadge}>
                          <Text style={styles.pointsText}>+{hit.points_earned} pts</Text>
                        </View>
                      )}
                    </>
                  );
                })()}
                <TouchableOpacity onPress={() => router.push(`/session/trail/${id}`)}>
                  <Text style={styles.trailLink}>View Smoke Trail →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.closedEmoji}>🏁</Text>
                <Text style={styles.closedTitle}>Session over</Text>
                <TouchableOpacity onPress={() => router.push(`/session/trail/${id}`)}>
                  <Text style={styles.trailLink}>View Smoke Trail →</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        )}

        {/* Player list */}
        <Text style={styles.sectionTitle}>Players</Text>
        <View style={styles.playerList}>
          {members.map(member => {
            const isMe = member.user_id === profile?.id;
            const avatarUrl = member.users.avatar_url ?? generateAvatarUrl(member.user_id);
            const isBomber = smokeBomb?.thrown_by === member.user_id;
            return (
              <View key={member.id} style={[styles.playerRow, isMe && styles.playerRowMe]}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, isMe && styles.playerNameMe]}>
                    {member.users.username ?? 'Unknown'}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  {(badgesMap.get(member.user_id) ?? []).length > 0 && (
                    <Text style={styles.badgeEmojis}>
                      {(badgesMap.get(member.user_id) ?? []).map(b => BADGE_META[b].emoji).join(' ')}
                    </Text>
                  )}
                </View>
                {isClosed && isBomber && (
                  <Text style={styles.throwerTag}>💨 Bomber</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Accuse button */}
        {!isClosed && !isThrower && (
          <TouchableOpacity style={styles.accuseButton} onPress={() => setShowAccuseModal(true)}>
            <Text style={styles.accuseButtonText}>🫵 Point the finger</Text>
          </TouchableOpacity>
        )}

        {/* Throw smoke bomb button */}
        {!isClosed && !isThrower && (
          <Animated.View
            style={{
              opacity: throwIdleOpacity,
              transform: [{ scale: throwIdleScale }, { scale: throwButtonPress }],
            }}
          >
            <TouchableOpacity
              style={styles.throwButton}
              onPress={() => setShowThrowModal(true)}
              onPressIn={() =>
                Animated.spring(throwButtonPress, { toValue: 0.95, tension: 300, friction: 10, useNativeDriver: true }).start()
              }
              onPressOut={() =>
                Animated.spring(throwButtonPress, { toValue: 1, tension: 200, friction: 12, useNativeDriver: true }).start()
              }
            >
              <Text style={styles.throwButtonText}>💨 Throw smoke bomb</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* Accuse modal */}
      <Modal visible={showAccuseModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => !accusingUserId && setShowAccuseModal(false)}
          activeOpacity={1}
        />
        <View style={styles.modalKeyboard} pointerEvents="box-none">
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>👀 Who snuck out?</Text>
            <Text style={styles.modalSubtitle}>Wrong accusation costs 5 points. Choose wisely.</Text>
            {members
              .filter(m => m.user_id !== profile?.id)
              .map(member => {
                const alreadyAccused = accusations.some(
                  a => a.accused_by === profile?.id && a.accused_user_id === member.user_id,
                );
                const avatarUrl = member.users.avatar_url ?? generateAvatarUrl(member.user_id);
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.accusePlayerRow, alreadyAccused && styles.accusePlayerRowDim]}
                    onPress={() => { setShowAccuseModal(false); handleAccuseTap(member); }}
                    disabled={alreadyAccused || !!accusingUserId}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    <Text style={[styles.playerName, alreadyAccused && styles.playerNameDim]}>
                      {member.users.username ?? 'Unknown'}
                    </Text>
                    {accusingUserId === member.user_id ? (
                      <ActivityIndicator color={Colors.primary} size="small" />
                    ) : alreadyAccused ? (
                      <Text style={styles.accusedLabel}>Already accused</Text>
                    ) : (
                      <Text style={styles.accuseChevron}>›</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAccuseModal(false)}
              disabled={!!accusingUserId}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Throw modal */}
      <Modal visible={showThrowModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => !throwing && setShowThrowModal(false)}
          activeOpacity={1}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboard}
          pointerEvents="box-none"
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>💨 Throw a smoke bomb</Text>
            <Text style={styles.modalSubtitle}>
              Your crew won't get a notification — they'll only know when the timer starts.
            </Text>
            <Text style={styles.inputLabel}>Victory message</Text>
            <TextInput
              style={styles.textInput}
              placeholder="What you'd say if you escape undetected…"
              placeholderTextColor={Colors.textTertiary}
              value={victoryMsg}
              onChangeText={setVictoryMsg}
              multiline
              maxLength={200}
            />
            <Text style={styles.inputLabel}>Caught message</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Sent privately to whoever figures you out…"
              placeholderTextColor={Colors.textTertiary}
              value={caughtMsg}
              onChangeText={setCaughtMsg}
              multiline
              maxLength={200}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowThrowModal(false)}
                disabled={throwing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalThrowButton}
                onPress={handleThrowSmokeBomb}
                disabled={throwing}
              >
                {throwing
                  ? <ActivityIndicator color={Colors.background} />
                  : <Text style={styles.modalThrowText}>Throw it!</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: { padding: Spacing.xs },
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusLive: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusClosed: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  closeButton: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  closeButtonText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  bombCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bombCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAlt,
  },
  bombEmoji: {
    fontSize: 48,
    marginBottom: Spacing.xs,
  },
  bombTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  bombTimer: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  bombSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  closedCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closedEmoji: { fontSize: 48 },
  closedTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  closedSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playerList: {
    gap: Spacing.xs,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerRowMe: {
    borderColor: Colors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  playerNameMe: {
    color: Colors.primary,
  },
  badgeEmojis: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  throwerTag: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  throwButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  throwButtonText: {
    color: Colors.background,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  homeButton: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  homeButtonText: {
    color: Colors.background,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  gpsStatus: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -Spacing.xs,
  },
  cancelBombButton: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  cancelBombText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  victoryMessage: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  pointsBadge: {
    backgroundColor: Colors.success,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  pointsText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  pointsCalculating: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  trailLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  modalThrowButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  modalThrowText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  accuseButton: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
  },
  accuseButtonText: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  accusePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accusePlayerRowDim: {
    opacity: 0.45,
  },
  playerNameDim: {
    color: Colors.textTertiary,
  },
  accusedLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  accuseChevron: {
    fontSize: FontSize.xl,
    color: Colors.textSecondary,
    fontWeight: '300',
  },
});
