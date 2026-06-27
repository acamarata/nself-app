/**
 * Purpose: Server URL + credentials pairing screen for ɳTask TV.
 * Inputs: serverUrl (TextInput), email (TextInput), password (TextInput)
 * Outputs: Calls useTVAuth.signIn; on success TVNavigator transitions to DashboardScreen.
 * Constraints:
 *   - TV text input: React Native TextInput works on tvOS and Android TV — the system
 *     keyboard appears when a TextInput gains focus. No custom keyboard needed.
 *   - Form layout: centered card (800px wide) on dark background — matches 10-foot pairing UX.
 *   - D-pad order: URL field → Email field → Password field → Connect button.
 *   - No "Forgot password" or "Create account" — TV is read-only consumer device.
 *   - Error shown inline below the Connect button.
 *   - Loading: Connect button shows ActivityIndicator; all inputs disabled.
 * SPORT: Epic F — TV scaffold.
 */

import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FocusableButton } from '../components/FocusableButton';
import { tvTheme } from '../theme';
import { useTVAuth } from '../hooks/useTVAuth';

export function ConnectScreen() {
  const { signIn, loading, error } = useTVAuth();
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleConnect = async () => {
    if (!serverUrl.trim() || !email.trim() || !password) return;
    await signIn(serverUrl.trim(), email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.appName}>ɳTask TV</Text>
        <Text style={styles.subtitle}>Connect to your nSelf server</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://my.nself.server"
              placeholderTextColor={tvTheme.colors.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={tvTheme.colors.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={tvTheme.colors.textDisabled}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleConnect}
              editable={!loading}
            />
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={tvTheme.colors.brand} size="large" />
              <Text style={styles.loadingText}>Connecting…</Text>
            </View>
          ) : (
            <FocusableButton
              id="connect-btn"
              label="Connect"
              onSelect={handleConnect}
              disabled={!serverUrl.trim() || !email.trim() || !password}
              nextFocusUp="password-input"
            />
          )}

          {error && (
            <Text style={styles.error}>{error}</Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tvTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 800,
    backgroundColor: tvTheme.colors.surface,
    borderRadius: tvTheme.radius.xl,
    padding: tvTheme.spacing.xxl,
    gap: tvTheme.spacing.lg,
  },
  appName: {
    fontSize: tvTheme.typeScale.heading1,
    fontWeight: '800',
    color: tvTheme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tvTheme.spacing.sm,
  },
  form: {
    gap: tvTheme.spacing.lg,
  },
  field: {
    gap: tvTheme.spacing.xs,
  },
  label: {
    fontSize: tvTheme.typeScale.caption,
    color: tvTheme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 80,
    backgroundColor: tvTheme.colors.surfaceSecondary,
    borderRadius: tvTheme.radius.md,
    borderWidth: 2,
    borderColor: tvTheme.colors.border,
    paddingHorizontal: tvTheme.spacing.lg,
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textPrimary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tvTheme.spacing.md,
    height: 80,
  },
  loadingText: {
    fontSize: tvTheme.typeScale.body,
    color: tvTheme.colors.textSecondary,
  },
  error: {
    fontSize: tvTheme.typeScale.caption,
    color: tvTheme.colors.error,
    textAlign: 'center',
  },
});
