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

type Props = NativeStackScreenProps<RootStackParamList, 'ChangeEmail'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ChangeEmailScreen({ navigation }: Props) {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Change Email</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Enter your new email address. A verification link will be sent before the change takes effect.
        </Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>New email address</Text>
          <TextInput
            style={styles.input}
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, !emailValid && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!emailValid || loading}
          accessibilityLabel="Send verification"
          accessibilityRole="button"
          accessibilityState={{ disabled: !emailValid || loading }}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Send verification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F9FAFB' },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back:              { fontSize: 16, color: '#6366F1', width: 60 },
  title:             { fontSize: 17, fontWeight: '700', color: '#111827' },
  body:              { padding: 16, gap: 16 },
  hint:              { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  card:              { backgroundColor: '#FFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input:             { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  errorText:         { fontSize: 13, color: '#DC2626' },
  submitBtn:         { backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#A5B4FC' },
  submitBtnText:     { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
