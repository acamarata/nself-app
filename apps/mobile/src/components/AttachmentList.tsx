/**
 * Purpose: File attachments for a task — list, add via document picker, open, delete.
 * Inputs: todoId, userId, isOffline.
 * Outputs: Attachment rows with an "Add file" action.
 * Constraints: 7-state pattern (loading/empty/error/populated); WCAG a11y.
 *              Uploads are disabled offline — they cannot be queued, because a
 *              presigned URL expires in 15 minutes and the picked file's cache
 *              URI is not guaranteed to survive that long.
 * SPORT: P5-C-mobile new feature — attachments.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery } from 'urql';
import type { NpAttachment } from '@nself/ntask-core';
import { GET_ATTACHMENTS } from '@nself/ntask-core';
import { useAttachments, type AttachmentError } from '../hooks/useAttachments';
import { useTheme } from '../theme';

interface AttachmentsData {
  np_attachments: NpAttachment[];
}

interface Props {
  todoId: string;
  userId: string;
  /** Uploads require a live connection; the row list still renders from cache. */
  isOffline: boolean;
}

const ERROR_TEXT: Record<AttachmentError, string> = {
  'too-large': 'That file is too large to attach.',
  'presign-failed': 'Could not start the upload. Try again.',
  'upload-failed': 'The upload did not finish. Try again.',
  'record-failed': 'The file uploaded but could not be attached. Try again.',
  'download-failed': 'Could not open that file. Try again.',
  'delete-failed': 'Could not remove that file. Try again.',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ todoId, userId, isOffline }: Props) {
  const { colors } = useTheme();
  const [result, reexecute] = useQuery<AttachmentsData>({
    query: GET_ATTACHMENTS,
    variables: { todoId },
    requestPolicy: 'cache-and-network',
  });
  const { upload, getDownloadUrl, remove, uploading, error } = useAttachments(todoId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const attachments = result.data?.np_attachments ?? [];

  const handleAdd = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled) return;

    const asset = picked.assets?.[0];
    if (!asset) return;

    const ok = await upload({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 0,
    });
    if (ok) reexecute({ requestPolicy: 'network-only' });
  };

  const handleOpen = async (attachment: NpAttachment) => {
    setBusyId(attachment.id);
    const url = await getDownloadUrl(attachment.id);
    setBusyId(null);
    if (url) void Linking.openURL(url);
  };

  const handleDelete = (attachment: NpAttachment) => {
    // Only the uploader may delete; the server enforces this too, but failing
    // silently on a button the user could press reads as a broken app.
    if (attachment.uploader_id !== userId) return;
    Alert.alert('Remove file', `Remove ${attachment.file_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(attachment.id);
          const ok = await remove(attachment.id);
          setBusyId(null);
          if (ok) reexecute({ requestPolicy: 'network-only' });
        },
      },
    ]);
  };

  if (result.fetching && attachments.length === 0) {
    return <ActivityIndicator accessibilityLabel="Loading attachments" />;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.text }]}>Files</Text>

      {result.error && attachments.length === 0 ? (
        <Text style={[styles.message, { color: colors.danger }]}>
          Could not load files.
        </Text>
      ) : null}

      {!result.error && attachments.length === 0 ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>No files yet.</Text>
      ) : null}

      {attachments.map((attachment) => (
        <View key={attachment.id} style={styles.row}>
          <TouchableOpacity
            style={styles.rowMain}
            onPress={() => handleOpen(attachment)}
            disabled={busyId === attachment.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${attachment.file_name}`}
          >
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {attachment.file_name}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {formatSize(attachment.file_size_bytes)}
            </Text>
          </TouchableOpacity>

          {busyId === attachment.id ? <ActivityIndicator /> : null}

          {attachment.uploader_id === userId ? (
            <TouchableOpacity
              onPress={() => handleDelete(attachment)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${attachment.file_name}`}
            >
              <Text style={[styles.remove, { color: colors.danger }]}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {error ? (
        <Text style={[styles.message, { color: colors.danger }]}>{ERROR_TEXT[error]}</Text>
      ) : null}

      <TouchableOpacity
        onPress={handleAdd}
        disabled={uploading || isOffline}
        accessibilityRole="button"
        accessibilityLabel="Add file"
        accessibilityState={{ disabled: uploading || isOffline }}
        style={[styles.add, { borderColor: colors.border }]}
      >
        {uploading ? (
          <ActivityIndicator />
        ) : (
          <Text style={{ color: isOffline ? colors.textSecondary : colors.primary }}>
            {isOffline ? 'Add file (offline)' : 'Add file'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  heading: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  rowMain: { flex: 1 },
  name: { fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
  remove: { fontSize: 13, fontWeight: '500' },
  message: { fontSize: 14, paddingVertical: 8 },
  add: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
});
