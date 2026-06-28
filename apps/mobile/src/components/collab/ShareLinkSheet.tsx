/**
 * Purpose: Bottom sheet for generating and revoking a public share link for a list.
 * Inputs:  listId (uuid), visible (boolean), onClose callback.
 * Outputs: Renders a slide-up sheet; calls createShareLink / revokeShareLink mutations.
 * Constraints:
 *   - No Clipboard API dep — shows link in read-only TextInput; "Copy" button uses React state
 *   - "Copied!" feedback resets after 2 s
 *   - Revoke requires Alert confirmation before executing
 *   - Max 60% screen height via maxHeight
 *   - Free plugins only; no pro deps
 * SPORT: P5-L-collab-ops / ShareLinkSheet
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
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useCollabMutations } from '../../hooks/useCollab';
import { useTheme } from '../../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareLinkResult {
  share_url: string;
  share_id: string;
}

interface CreateShareLinkData {
  createShareLink?: ShareLinkResult;
}

interface Props {
  listId: string;
  visible: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function ShareLinkSheet({ listId, visible, onClose }: Props) {
  const { colors } = useTheme();
  const { createShareLink, revokeShareLink } = useCollabMutations();

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = () => {
    // Keep link state so reopening shows it again; clear errors only
    setError(null);
    onClose();
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createShareLink(listId);
      if (result.error) {
        setError(result.error.message ?? 'Failed to create share link.');
        setCreating(false);
        return;
      }
      const data = result.data as CreateShareLinkData | undefined;
      const link = data?.createShareLink;
      if (link?.share_url) {
        setShareUrl(link.share_url);
        setShareId(link.share_id);
      } else {
        setError('No link returned — please try again.');
      }
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    // Clipboard dep avoided per spec: simulate copy via state feedback
    // To wire real clipboard: import Clipboard from '@react-native-clipboard/clipboard'
    // then Clipboard.setString(shareUrl ?? '')
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmRevoke = () => {
    Alert.alert(
      'Revoke share link',
      'Anyone with the current link will lose access immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: handleRevoke,
        },
      ],
    );
  };

  const handleRevoke = async () => {
    if (!shareId) return;
    setRevoking(true);
    setError(null);
    try {
      const result = await revokeShareLink(listId, shareId);
      if (result.error) {
        setError(result.error.message ?? 'Failed to revoke link.');
        setRevoking(false);
        return;
      }
      setShareUrl(null);
      setShareId(null);
      setCopied(false);
    } catch {
      setError('Unexpected error revoking link.');
    } finally {
      setRevoking(false);
    }
  };

  const busy = creating || revoking;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={resetAndClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated, maxHeight: SCREEN_HEIGHT * 0.6 }]}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Share link</Text>
              <TouchableOpacity
                onPress={resetAndClose}
                accessibilityRole="button"
                accessibilityLabel="Close share link sheet"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.closeText, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Inline error */}
            {!!error && (
              <Text style={[styles.errorText, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            )}

            {/* No link yet */}
            {!shareUrl && (
              <>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Create a link so anyone can view this list — no account needed.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }, busy && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Create share link"
                  accessibilityState={{ disabled: busy }}
                >
                  {creating
                    ? <ActivityIndicator color={colors.textOnPrimary} />
                    : <Text style={[styles.primaryBtnText, { color: colors.textOnPrimary }]}>Create share link</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Link exists */}
            {!!shareUrl && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Share link</Text>
                <View style={styles.linkRow}>
                  <TextInput
                    style={[styles.linkInput, { borderColor: colors.border, color: colors.textSecondary, backgroundColor: colors.background }]}
                    value={shareUrl}
                    editable={false}
                    selectTextOnFocus
                    accessibilityLabel="Share link URL"
                  />
                  <TouchableOpacity
                    style={[styles.copyBtn, { backgroundColor: colors.primary }]}
                    onPress={handleCopy}
                    accessibilityRole="button"
                    accessibilityLabel={copied ? 'Link copied' : 'Copy link'}
                  >
                    <Text style={[styles.copyBtnText, { color: colors.textOnPrimary }]}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.revokeBtn, { borderColor: colors.danger }, busy && styles.btnDisabled]}
                  onPress={confirmRevoke}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Revoke share link"
                  accessibilityState={{ disabled: busy }}
                >
                  {revoking
                    ? <ActivityIndicator color={colors.danger} />
                    : <Text style={[styles.revokeBtnText, { color: colors.danger }]}>Revoke link</Text>}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
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
  },
  scrollContent: {
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
  closeText: { fontSize: 15, fontWeight: '600' },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: { fontSize: 12, marginBottom: 12 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  linkInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
  },
  copyBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  copyBtnText: { fontSize: 14, fontWeight: '700' },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  revokeBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  revokeBtnText: { fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.55 },
});
