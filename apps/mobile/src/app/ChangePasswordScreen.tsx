/**
 * Purpose: Change password form — re-authenticates with current password then sets a new one.
 * Inputs: currentPassword, newPassword, confirmPassword (all secureTextEntry).
 * Outputs: On success, shows confirmation alert and navigates back.
 * Constraints: ≤180L. newPassword min 8 chars; must match confirmPassword. No direct table write.
 * SPORT: P5-J-change-password-screen
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAccountMutations } from '../hooks/useAccount';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

const MIN_LENGTH = 8;

export function ChangePasswordScreen({ navigation }: Props) {
  const { changePassword } = useAccountMutations();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived validation
  const newTooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_LENGTH &&
    newPassword === confirmPassword &&
    !loading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert(
        'Password changed',
        'Your password has been updated successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
      setLoading(false);
    }
  }, [canSubmit, changePassword, currentPassword, newPassword, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Change Password</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
            placeholder="Enter current password"
            accessibilityLabel="Current password"
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChangeText={(t) => { setNewPassword(t); setError(null); }}
            placeholder={`At least ${MIN_LENGTH} characters`}
            accessibilityLabel="New password"
            hint={newTooShort ? `Minimum ${MIN_LENGTH} characters` : undefined}
            hintError
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
            placeholder="Repeat new password"
            accessibilityLabel="Confirm new password"
            hint={mismatch ? 'Passwords do not match' : undefined}
            hintError
            last
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel="Update password"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Update password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  hint?: string;
  hintError?: boolean;
  last?: boolean;
}

function PasswordField({ label, value, onChangeText, placeholder, accessibilityLabel, hint, hintError, last }: PasswordFieldProps) {
  return (
    <View style={[styles.fieldWrap, !last && styles.fieldBorder]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel}
      />
      {hint ? <Text style={[styles.hintText, hintError && styles.hintError]}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F9FAFB' },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back:              { fontSize: 16, color: '#6366F1', width: 60 },
  title:             { fontSize: 17, fontWeight: '700', color: '#111827' },
  body:              { padding: 16, gap: 16 },
  card:              { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  fieldWrap:         { paddingVertical: 14 },
  fieldBorder:       { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  fieldLabel:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input:             { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  hintText:          { fontSize: 12, color: '#6B7280', marginTop: 4 },
  hintError:         { color: '#DC2626' },
  errorText:         { fontSize: 13, color: '#DC2626' },
  submitBtn:         { backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#A5B4FC' },
  submitBtnText:     { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
