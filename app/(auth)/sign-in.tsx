import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../lib/auth';
import { Colors, Spacing, FontSize, Radius } from '../../lib/theme';

export default function SignInScreen() {
  const { signInWithPhone, signInWithGoogle, signInWithApple, devLogin } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const phoneRef = useRef<TextInput>(null);

  async function handlePhoneContinue() {
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned || cleaned.length < 8) {
      Alert.alert('Invalid number', 'Please enter a valid phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      await signInWithPhone(cleaned);
      router.push({ pathname: '/(auth)/verify', params: { phone: cleaned } });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setOauthLoading('google');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Google sign-in failed.');
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleDevLogin() {
    setLoading(true);
    try {
      await devLogin();
    } catch (e: any) {
      Alert.alert('Dev Login Error', e.message ?? 'Failed to sign in anonymously.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApple() {
    setOauthLoading('apple');
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e.code !== 'ERR_CANCELED') {
        Alert.alert('Error', e.message ?? 'Apple sign-in failed.');
      }
    } finally {
      setOauthLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.emoji}>💨</Text>
          <Text style={styles.title}>Smoke Bomb</Text>
          <Text style={styles.subtitle}>Ghost your friends. Earn points.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            ref={phoneRef}
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 000 0000"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="done"
            onSubmitEditing={handlePhoneContinue}
          />
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handlePhoneContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Send code</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.oauthButtons}>
          <TouchableOpacity
            style={[styles.oauthButton, oauthLoading === 'google' && styles.buttonDisabled]}
            onPress={handleGoogle}
            disabled={oauthLoading !== null}
          >
            {oauthLoading === 'google' ? (
              <ActivityIndicator color={Colors.text} size="small" />
            ) : (
              <Text style={styles.oauthButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={Radius.md}
              style={styles.appleButton}
              onPress={handleApple}
            />
          )}
        </View>
        {__DEV__ && (
          <View style={styles.devSection}>
            <Text style={styles.devLabel}>— DEV ONLY —</Text>
            <TouchableOpacity
              style={[styles.devButton, loading && styles.buttonDisabled]}
              onPress={handleDevLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.devButtonText}>Skip auth (dev login)</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  oauthButtons: {
    gap: Spacing.sm,
  },
  oauthButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  oauthButtonText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  appleButton: {
    height: 50,
    width: '100%',
  },
  devSection: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  devLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  devButton: {
    backgroundColor: '#f59e0b',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  devButtonText: {
    color: '#000',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
