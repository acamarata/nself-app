/**
 * Purpose: Modal for inviting a user to a shared list by email with role selection.
 * Inputs:  listId (uuid), visible (boolean), onClose callback, optional onInvited callback.
 * Outputs: Renders a slide-up Modal; calls createInvite mutation on submit; clears on success.
 * Constraints:
 *   - Roles: editor | viewer | admin (default: editor)
 *   - Disables submit while loading; shows inline error on failure
 *   - i18n: raw English strings; replace with t('screens.members.*') once useTranslation is wired
 *   - Free plugins only; no pro deps
 * SPORT: P5-L-collab-ops / InviteModal
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useCollabMutations } from '../../hooks/useCollab';
import { useTheme } from '../../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'editor' | 'viewer' | 'admin';

interface RoleOption {
  value: Role;
  label: string;
  description: string;
}

const ROLES: RoleOption[] = [
  { value: 'editor', label: 'Editor', description: 'Can add and edit tasks' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
  { value: 'admin', label: 'Admin', description: 'Full list management' },
];

interface Props {
  listId: string;
  visible: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteModal({ listId, visible, onClose, onInvited }: Props) {
  const { colors } = useTheme();
  const { createInvite } = useCollabMutations();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setEmail('');
    setRole('editor');
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email address is required.'); // i18n: screens.members.emailRequired
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createInvite(listId, trimmed, role);
      if (result.error) {
        setError(result.error.message ?? 'Failed to send invite. Try again.');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
      onInvited?.();
      // Auto-close after brief success acknowledgment
      setTimeout(() => {
        resetForm();
        onClose();
      }, 800);
    } catch {
      setError('Unexpected error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} accessibilityViewIsModal>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {/* i18n: screens.members.inviteByEmail */}
              Invite by email
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel invite" // i18n: screens.members.cancelInvite
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Email input */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Email address {/* i18n: screens.members.emailPlaceholder */}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: !!error && !success ? colors.danger : colors.border, color: colors.text }]}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            placeholder="name@example.com" // i18n: screens.members.emailPlaceholder
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            editable={!loading && !success}
            accessibilityLabel="Email address"
          />

          {/* Inline error */}
          {!!error && <Text style={[styles.errorText, { color: colors.danger }]} accessibilityRole="alert">{error}</Text>}

          {/* Success */}
          {success && (
            <Text style={[styles.successText, { color: colors.success }]} accessibilityRole="alert">
              Invite sent! {/* i18n: screens.members.inviteSent */}
            </Text>
          )}

          {/* Role selector */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Role {/* i18n: screens.members.roleLabel */}
          </Text>
          <View style={styles.roleGroup}>
            {ROLES.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.roleRow, { borderColor: role === opt.value ? colors.primary : colors.border }, role === opt.value && { backgroundColor: colors.primarySubtle }]}
                onPress={() => !loading && !success && setRole(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: role === opt.value }}
                accessibilityLabel={`${opt.label}: ${opt.description}`}
              >
                <View style={[styles.radio, { borderColor: role === opt.value ? colors.primary : colors.border }]}>
                  {role === opt.value && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
                <View style={styles.roleText}>
                  <Text style={[styles.roleLabel, { color: colors.text }]}>{opt.label}</Text>
                  <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>{opt.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }, (loading || success) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || success}
            accessibilityRole="button"
            accessibilityLabel="Send invite" // i18n: screens.members.sendInvite
            accessibilityState={{ disabled: loading || success }}
          >
            {loading
              ? <ActivityIndicator color={colors.textOnPrimary} />
              : <Text style={[styles.submitText, { color: colors.textOnPrimary }]}>Send invite</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 17, fontWeight: '700' },
  cancelText: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 6,
  },
  errorText: { fontSize: 12, marginBottom: 12 },
  successText: { fontSize: 12, marginBottom: 12 },
  roleGroup: { gap: 8, marginBottom: 24 },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  roleText: { flex: 1 },
  roleLabel: { fontSize: 14, fontWeight: '600' },
  roleDesc: { fontSize: 12, marginTop: 1 },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '700' },
});
