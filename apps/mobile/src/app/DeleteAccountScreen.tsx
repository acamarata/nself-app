/**
 * Purpose: Destructive account deletion screen — required by Apple/Google store guidelines.
 * Inputs: Confirmation text ("DELETE") typed by user; useAccountMutations for deleteAccount.
 * Outputs: On success, resets navigation stack to Login. On error, shows inline message.
 * Constraints: ≤200L. Button locked until exact "DELETE" typed. No accidental invocation.
 * SPORT: P5-J-delete-account-screen
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAccountMutations } from '../hooks/useAccount';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

const CONFIRM_PHRASE = 'DELETE';

export function DeleteAccountScreen({ navigation }: Props) {
  const { deleteAccount } = useAccountMutations();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirmText === CONFIRM_PHRASE;

  const handleDelete = useCallback(async () => {
    if (!confirmed || loading) return;

    Alert.alert(
      'Final confirmation',
      'This will permanently delete your account, all lists, and all tasks. There is no recovery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              const result = await deleteAccount();
              if (result.success) {
                Alert.alert(
                  'Account deleted',
                  result.message ?? 'Your account has been permanently deleted.',
                  [{
                    text: 'OK',
                    onPress: () =>
                      navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
                  }],
                );
              } else {
                setError('Account deletion was not completed. Please try again.');
                setLoading(false);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Deletion failed. Please try again.');
              setLoading(false);
            }
          },
        },
      ],
    );
  }, [confirmed, loading, deleteAccount, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Delete Account</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Warning card */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>This cannot be undone</Text>
          <Text style={styles.warningBody}>
            Deleting your account will permanently remove all your lists, tasks, subtasks,
            comments, and attachments. This action is irreversible.
          </Text>
        </View>

        {/* Confirmation input */}
        <Text style={styles.sectionHeader}>Confirm deletion</Text>
        <View style={styles.card}>
          <Text style={styles.promptLabel}>
            Type <Text style={styles.promptKeyword}>DELETE</Text> to enable the button
          </Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="DELETE"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Type DELETE to confirm"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Delete button */}
        <TouchableOpacity
          style={[styles.deleteBtn, !confirmed && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={!confirmed || loading}
          accessibilityLabel="Delete my account"
          accessibilityRole="button"
          accessibilityState={{ disabled: !confirmed || loading }}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.deleteBtnText, !confirmed && styles.deleteBtnTextDisabled]}>
              Delete my account
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#F9FAFB' },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back:                { fontSize: 16, color: '#6366F1', width: 60 },
  title:               { fontSize: 17, fontWeight: '700', color: '#111827' },
  body:                { padding: 16, gap: 12 },
  warningCard:         { backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', padding: 20, alignItems: 'center', gap: 8, marginBottom: 8 },
  warningIcon:         { fontSize: 32 },
  warningTitle:        { fontSize: 16, fontWeight: '700', color: '#991B1B', textAlign: 'center' },
  warningBody:         { fontSize: 14, color: '#7F1D1D', textAlign: 'center', lineHeight: 20 },
  sectionHeader:       { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginStart: 4 },
  card:                { backgroundColor: '#FFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  promptLabel:         { fontSize: 14, color: '#374151', marginBottom: 10 },
  promptKeyword:       { fontWeight: '700', color: '#DC2626' },
  input:               { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827', letterSpacing: 1 },
  errorText:           { fontSize: 13, color: '#DC2626', textAlign: 'center', marginTop: 4 },
  deleteBtn:           { backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  deleteBtnDisabled:   { backgroundColor: '#FCA5A5' },
  deleteBtnText:       { color: '#FFF', fontSize: 16, fontWeight: '700' },
  deleteBtnTextDisabled: { color: '#FFF' },
  cancelBtn:           { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText:       { fontSize: 16, color: '#6B7280', fontWeight: '500' },
});
