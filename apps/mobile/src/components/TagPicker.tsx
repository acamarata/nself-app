/**
 * Purpose: Tag picker for a task — list user's tags, toggle tag on/off for the task.
 * Inputs: todoId, userId strings.
 * Outputs: Horizontal chip row of tags; tap to add/remove; create-new inline.
 * Constraints: WCAG a11y; i18n-neutral (no hardcoded English in chips).
 * SPORT: P5-C-mobile new feature — tags.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation } from 'urql';
import type { NpTag } from '../types';
import { GET_TAGS, ADD_TODO_TAG, REMOVE_TODO_TAG, CREATE_TAG } from '../lib/hasura';
import { useTagMutations } from '../hooks/useTaskMutations';
import { useTheme } from '../theme';

interface TagsData {
  np_tags: NpTag[];
}

interface TodoTagsData {
  np_todo_tags: { tag_id: string }[];
}

const GET_TODO_TAGS = /* GraphQL */`
  query GetTodoTags($todoId: uuid!) {
    np_todo_tags(where: { todo_id: { _eq: $todoId } }) {
      tag_id
    }
  }
`;

interface Props {
  todoId: string;
  userId: string;
}

const TAG_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function TagPicker({ todoId, userId }: Props) {
  const { colors } = useTheme();
  const [tagsResult] = useQuery<TagsData>({
    query: GET_TAGS,
    variables: { userId },
    requestPolicy: 'cache-and-network',
  });
  const [todoTagsResult, reexecuteTodoTags] = useQuery<TodoTagsData>({
    query: GET_TODO_TAGS,
    variables: { todoId },
    requestPolicy: 'cache-and-network',
  });

  const { createTag, addTodoTag, removeTodoTag } = useTagMutations();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0] ?? '#6366f1');

  const allTags = tagsResult.data?.np_tags ?? [];
  const activeTags = new Set(todoTagsResult.data?.np_todo_tags.map((t) => t.tag_id) ?? []);

  const handleToggleTag = async (tag: NpTag) => {
    if (activeTags.has(tag.id)) {
      await removeTodoTag(todoId, tag.id);
    } else {
      await addTodoTag(todoId, tag.id);
    }
    reexecuteTodoTags({ requestPolicy: 'network-only' });
  };

  const handleCreateTag = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    setShowCreate(false);
    const result = await createTag(name, selectedColor);
    if (!result.error && result.data) {
      const newTagId = (result.data as { insert_np_tags_one: { id: string } }).insert_np_tags_one.id;
      await addTodoTag(todoId, newTagId);
      reexecuteTodoTags({ requestPolicy: 'network-only' });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TAGS</Text>
        <TouchableOpacity
          onPress={() => setShowCreate((v) => !v)}
          accessibilityLabel={showCreate ? 'Cancel' : 'Create new tag'}
          accessibilityRole="button"
        >
          <Text style={[styles.addBtn, { color: colors.primary }]}>{showCreate ? 'Cancel' : '+ New tag'}</Text>
        </TouchableOpacity>
      </View>

      {(tagsResult.fetching && allTags.length === 0) && (
        <ActivityIndicator size="small" color={colors.primary} />
      )}

      {allTags.length === 0 && !tagsResult.fetching && !showCreate && (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>No tags yet.</Text>
      )}

      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {allTags.map((tag) => {
              const active = activeTags.has(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.chip,
                    { borderColor: tag.color, backgroundColor: active ? tag.color : colors.surfaceElevated },
                  ]}
                  onPress={() => handleToggleTag(tag)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Tag: ${tag.name}`}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : tag.color }]}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {showCreate && (
        <View style={[styles.createBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            style={[styles.createInput, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            value={newName}
            onChangeText={setNewName}
            placeholder="Tag name"
            autoFocus
            maxLength={50}
            accessibilityLabel="New tag name"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TAG_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    selectedColor === c && { borderColor: colors.text, transform: [{ scale: 1.2 }] },
                  ]}
                  onPress={() => setSelectedColor(c)}
                  accessibilityLabel={`Color ${c}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedColor === c }}
                />
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }, !newName.trim() && styles.createBtnDisabled]}
            onPress={handleCreateTag}
            disabled={!newName.trim()}
            accessibilityRole="button"
            accessibilityLabel="Save tag"
          >
            <Text style={[styles.createBtnText, { color: colors.textOnPrimary }]}>Create tag</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  chipScroll: { marginBottom: 4 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  createBox: { borderRadius: 10, padding: 12, borderWidth: 1 },
  createInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  createBtn: { marginTop: 10, borderRadius: 8, padding: 10, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { fontWeight: '700', fontSize: 14 },
});
