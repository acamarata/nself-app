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
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

const MIN_LENGTH = 8;

export function ChangePasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Change Password</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
            placeholder="Enter current password"
            accessibilityLabel="Current password"
            colors={colors}
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChangeText={(t) => { setNewPassword(t); setError(null); }}
            placeholder={`At least ${MIN_LENGTH} characters`}
            accessibilityLabel="New password"
            hint={newTooShort ? `Minimum ${MIN_LENGTH} characters` : undefined}
            hintError
            colors={colors}
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
            colors={colors}
          />
        </View>

        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel="Update password"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.submitBtnText, { color: colors.textOnPrimary }]}>Update password</Text>
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
  colors: ReturnType<typeof useTheme>['colors'];
}

function PasswordField({ label, value, onChangeText, placeholder, accessibilityLabel, hint, hintError, last, colors }: PasswordFieldProps) {
  return (
    <View style={[styles.fieldWrap, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel}
      />
      {hint ? <Text style={[styles.hintText, { color: hintError ? colors.danger : colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back:              { fontSize: 16, width: 60 },
  title:             { fontSize: 17, fontWeight: '700' },
  body:              { padding: 16, gap: 16 },
  card:              { borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  fieldWrap:         { paddingVertical: 14 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input:             { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  hintText:          { fontSize: 12, marginTop: 4 },
  errorText:         { fontSize: 13 },
  submitBtn:         { borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { fontSize: 16, fontWeight: '700' },
});
