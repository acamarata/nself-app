/**
 * Purpose: Comment thread for a task — list, add, soft-delete comments.
 * Inputs: todoId, userId strings.
 * Outputs: Scrollable list of comment rows + add-comment input at bottom.
 * Constraints: 7-state (loading/empty/error/populated); a11y; i18n keys.
 * SPORT: P5-C-mobile new feature — comments.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery } from 'urql';
import type { NpComment } from '../types';
import { GET_COMMENTS } from '../lib/hasura';
import { useCommentMutations } from '../hooks/useTaskMutations';
import { generateIdempotencyKey } from '../lib/idempotency';
import { useTheme } from '../theme';

interface CommentsData {
  np_comments: NpComment[];
}

interface Props {
  todoId: string;
  userId: string;
}

export function CommentThread({ todoId, userId }: Props) {
  const { colors } = useTheme();
  const [result, reexecute] = useQuery<CommentsData>({
    query: GET_COMMENTS,
    variables: { todoId },
    requestPolicy: 'cache-and-network',
  });
  const { createComment, deleteComment, creating } = useCommentMutations();
  const [body, setBody] = useState('');

  const comments = result.data?.np_comments ?? [];

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const key = generateIdempotencyKey('create_comment', `${todoId}:${trimmed}:${Date.now()}`);
    setBody('');
    await createComment(todoId, trimmed, key);
    reexecute({ requestPolicy: 'network-only' });
  };

  const handleDelete = (comment: NpComment) => {
    if (comment.author_id !== userId) return;
    Alert.alert('Delete comment', 'This comment will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteComment(comment.id);
          reexecute({ requestPolicy: 'network-only' });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        COMMENTS {comments.length > 0 ? `(${comments.length})` : ''}
      </Text>

      {result.fetching && comments.length === 0 && (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
      )}

      {comments.length === 0 && !result.fetching && (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>No comments yet.</Text>
      )}

      {comments.map((comment) => (
        <TouchableOpacity
          key={comment.id}
          style={[styles.commentRow, { borderBottomColor: colors.borderSubtle }]}
          onLongPress={() => handleDelete(comment)}
          accessibilityLabel={`Comment: ${comment.body}`}
          accessibilityHint={comment.author_id === userId ? 'Long press to delete' : undefined}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primarySubtle }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {comment.author_id.slice(-2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.commentContent}>
            <Text style={[styles.commentBody, { color: colors.text }]}>{comment.body}</Text>
            <Text style={[styles.commentMeta, { color: colors.textTertiary }]}>
              {comment.edited_at ? 'edited · ' : ''}
              {new Date(comment.created_at).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.composeRow}>
        <TextInput
          style={[styles.composeInput, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
          value={body}
          onChangeText={setBody}
          placeholder="Add a comment…"
          multiline
          maxLength={2000}
          accessibilityLabel="Comment text"
        />
        <TouchableOpacity
          onPress={handleSend}
          style={[styles.sendBtn, { backgroundColor: colors.primary }, (!body.trim() || creating) && styles.sendBtnDisabled]}
          disabled={!body.trim() || creating}
          accessibilityLabel="Send comment"
          accessibilityRole="button"
        >
          {creating ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.sendBtnText, { color: colors.textOnPrimary }]}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  commentRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 11, fontWeight: '700' },
  commentContent: { flex: 1 },
  commentBody: { fontSize: 14, lineHeight: 20 },
  commentMeta: { fontSize: 11, marginTop: 2 },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  composeInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, maxHeight: 100, minHeight: 44 },
  sendBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontWeight: '700', fontSize: 14 },
});
