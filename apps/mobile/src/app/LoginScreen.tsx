/**
 * Purpose: Sign-in screen — collects server URL, email, password; calls useAuth.signIn
 * Inputs: user form input; navigation to Home on success
 * Outputs: Renders auth form; writes token to SecureStore on success
 * Constraints: Server URL saved across sessions; same flow as Flutter LoginScreen
 * SPORT: Port of app/lib/screens/login_screen.dart
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Linking,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAuth } from '../hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn, loading, error } = useAuth();
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);

  const handleSignIn = async () => {
    if (!serverUrl.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    await signIn(serverUrl.trim(), email.trim(), password);
    navigation.replace('Home');
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>ɳTask</Text>
        <Text style={styles.subtitle}>Self-hosted task management</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="https://api.yourserver.dev"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Server URL"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            accessibilityLabel="Email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            accessibilityLabel="Password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          {/* ToS acceptance */}
          <View style={styles.tosRow}>
            <TouchableOpacity
              style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}
              onPress={() => setTosAccepted((v) => !v)}
              accessibilityLabel="Accept Terms of Service"
              accessibilityRole="checkbox"
            >
              {tosAccepted && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.tosText}>
              {'By signing in, you agree to our '}
              <Text
                style={styles.tosLink}
                onPress={() => void Linking.openURL('https://nself.org/terms')}
                accessibilityRole="link"
              >
                Terms of Service
              </Text>
              {' and '}
              <Text
                style={styles.tosLink}
                onPress={() => void Linking.openURL('https://nself.org/privacy')}
                accessibilityRole="link"
              >
                Privacy Policy
              </Text>
              {'.'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || !tosAccepted) && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading || !tosAccepted}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f9fafb' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '800', color: '#6366f1', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 40 },
  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  error: { color: '#ef4444', fontSize: 13, marginTop: 8 },
  tosRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, gap: 10 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: '#6366f1', borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxChecked: { backgroundColor: '#6366f1' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  tosText: { flex: 1, fontSize: 13, color: '#6b7280', lineHeight: 18 },
  tosLink: { color: '#6366f1', textDecorationLine: 'underline' },
  button: { backgroundColor: '#6366f1', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
