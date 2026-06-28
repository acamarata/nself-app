/**
 * Purpose: Change email form — initiates backend email-change flow.
 * Inputs: newEmail (TextInput); useAccountMutations.changeEmail Hasura action.
 * Outputs: On success, shows confirmation alert and navigates back.
 *   Backend sends a verification link to newEmail before the change takes effect.
 * Constraints: ≤150L. Basic email regex validation before submit. No direct table write.
 * SPORT: P5-J-change-email-screen
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

type Props = NativeStackScreenProps<RootStackParamList, 'ChangeEmail'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ChangeEmailScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { changeEmail } = useAccountMutations();
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(newEmail.trim());

  const handleSubmit = useCallback(async () => {
    if (!emailValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      await changeEmail(newEmail.trim());
      Alert.alert(
        'Verification sent',
        `A verification link has been sent to ${newEmail.trim()}. Follow the link to confirm your new email.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request email change');
      setLoading(false);
    }
  }, [emailValid, loading, changeEmail, newEmail, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Change Email</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Enter your new email address. A verification link will be sent before the change takes effect.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>New email address</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            value={newEmail}
            onChangeText={(t) => { setNewEmail(t); setError(null); }}
            placeholder="new@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            accessibilityLabel="New email address"
          />
        </View>

        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }, !emailValid && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!emailValid || loading}
          accessibilityLabel="Send verification"
          accessibilityRole="button"
          accessibilityState={{ disabled: !emailValid || loading }}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.submitBtnText, { color: colors.textOnPrimary }]}>Send verification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back:              { fontSize: 16, width: 60 },
  title:             { fontSize: 17, fontWeight: '700' },
  body:              { padding: 16, gap: 16 },
  hint:              { fontSize: 14, lineHeight: 20 },
  card:              { borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input:             { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  errorText:         { fontSize: 13 },
  submitBtn:         { borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { fontSize: 16, fontWeight: '700' },
});
