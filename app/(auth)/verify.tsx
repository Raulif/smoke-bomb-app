import { useState, useEffect, useRef } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';

const RESEND_COOLDOWN = 30;

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyOtp, signInWithPhone } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone, code);
      // onAuthStateChange in AuthProvider handles the redirect via app/index.tsx
    } catch (e: any) {
      Alert.alert('Incorrect code', e.message ?? 'The code is wrong or expired. Try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    try {
      await signInWithPhone(phone);
      setResendCooldown(RESEND_COOLDOWN);
      setCode('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to resend code.');
    }
  }

  const maskedPhone = phone
    ? `${phone.slice(0, -4).replace(/\d/g, '*')}${phone.slice(-4)}`
    : '';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Enter code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.codeInput}
          value={code}
          onChangeText={text => {
            const digits = text.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            if (digits.length === 6) setTimeout(() => handleVerify(), 100);
          }}
          placeholder="000000"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          autoComplete="one-time-code"
        />

        <TouchableOpacity
          style={[styles.primaryButton, (loading || code.length < 6) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || code.length < 6}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, resendCooldown > 0 && styles.buttonDisabled]}
          onPress={handleResend}
          disabled={resendCooldown > 0}
        >
          <Text style={styles.resendText}>
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  backButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    alignSelf: 'flex-start',
  },
  backText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  phoneHighlight: {
    color: Colors.text,
    fontWeight: '600',
  },
  codeInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    letterSpacing: 16,
    marginBottom: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  resendButton: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
  resendText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
});
