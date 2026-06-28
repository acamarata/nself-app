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
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

const CONFIRM_PHRASE = 'DELETE';

export function DeleteAccountScreen({ navigation }: Props) {
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Delete Account</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Warning card */}
        <View style={[styles.warningCard, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }]}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={[styles.warningTitle, { color: colors.danger }]}>This cannot be undone</Text>
          <Text style={[styles.warningBody, { color: colors.danger }]}>
            Deleting your account will permanently remove all your lists, tasks, subtasks,
            comments, and attachments. This action is irreversible.
          </Text>
        </View>

        {/* Confirmation input */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Confirm deletion</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.promptLabel, { color: colors.textSecondary }]}>
            Type <Text style={[styles.promptKeyword, { color: colors.danger }]}>DELETE</Text> to enable the button
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="DELETE"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Type DELETE to confirm"
          />
        </View>

        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

        {/* Delete button */}
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.danger }, !confirmed && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={!confirmed || loading}
          accessibilityLabel="Delete my account"
          accessibilityRole="button"
          accessibilityState={{ disabled: !confirmed || loading }}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.deleteBtnText, { color: colors.textOnPrimary }]}>
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
          <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1 },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back:                { fontSize: 16, width: 60 },
  title:               { fontSize: 17, fontWeight: '700' },
  body:                { padding: 16, gap: 12 },
  warningCard:         { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8, marginBottom: 8 },
  warningIcon:         { fontSize: 32 },
  warningTitle:        { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  warningBody:         { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionHeader:       { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginStart: 4 },
  card:                { borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  promptLabel:         { fontSize: 14, marginBottom: 10 },
  promptKeyword:       { fontWeight: '700' },
  input:               { borderWidth: 1.5, borderRadius: 8, padding: 12, fontSize: 15, letterSpacing: 1 },
  errorText:           { fontSize: 13, textAlign: 'center', marginTop: 4 },
  deleteBtn:           { borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  deleteBtnDisabled:   { opacity: 0.5 },
  deleteBtnText:       { fontSize: 16, fontWeight: '700' },
  cancelBtn:           { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText:       { fontSize: 16, fontWeight: '500' },
});
