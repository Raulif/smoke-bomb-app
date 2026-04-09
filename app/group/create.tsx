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
import { createGroup } from '../../lib/groups';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';

export default function CreateGroupScreen() {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      Alert.alert('Invalid name', 'Group name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 30) {
      Alert.alert('Too long', 'Group name must be 30 characters or less.');
      return;
    }
    if (!profile) return;

    setLoading(true);
    try {
      const group = await createGroup(trimmed, profile.id);
      router.replace(`/group/${group.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <View style={styles.dragHandle} />

        <Text style={styles.title}>Create a group</Text>
        <Text style={styles.subtitle}>
          Your crew will join with an invite code you can share after.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Group name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Friday Night Crew"
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Text style={styles.hint}>{name.trim().length}/30 characters</Text>
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
            style={[styles.primaryButton, (loading || !name.trim()) && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Create</Text>
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
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
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
