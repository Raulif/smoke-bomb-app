import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { joinGroup } from '../../lib/groups';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';

export default function JoinGroupScreen() {
  const { profile } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('Invalid code', 'Invite codes are 6 characters long.');
      return;
    }
    if (!profile) return;

    setLoading(true);
    try {
      const group = await joinGroup(trimmed, profile.id);
      router.replace(`/group/${group.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to join group. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <View style={styles.dragHandle} />

        <Text style={styles.title}>Join a group</Text>
        <Text style={styles.subtitle}>
          Ask someone in the group for their 6-character invite code.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={text => setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABC123"
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            textAlign="center"
            returnKeyType="done"
            onSubmitEditing={handleJoin}
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, (loading || code.trim().length !== 6) && styles.buttonDisabled]}
            onPress={handleJoin}
            disabled={loading || code.trim().length !== 6}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Join</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  container: {
    flex: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  form: {
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  codeInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    letterSpacing: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
