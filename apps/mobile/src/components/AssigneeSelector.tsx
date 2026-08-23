/**
 * Purpose: Assign and unassign list members on a task.
 * Inputs: todoId, listId.
 * Outputs: Assigned-member chips plus a toggle list of the list's members.
 * Constraints:
 *   - np_todo_assignees is many-to-many; a task has zero or more assignees.
 *     The previous version took a single `assigneeId` and was mounted with a
 *     hardcoded `null` + `readonly`, so it could never show or change anything.
 *   - Hidden entirely for a personal (unshared) list: there is nobody to assign
 *     to, and an empty picker reads as broken. Matches the web behaviour.
 *   - Assign/unassign require editor or owner on the share; the server enforces
 *     it, and a failure reverts the optimistic row rather than lying.
 * SPORT: P5-C-mobile — assignees parity with web.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation } from 'urql';
import { ASSIGN_TODO, UNASSIGN_TODO, GET_TODO_ASSIGNEES } from '@nself/ntask-core';
import { GET_LIST_MEMBERS } from '../lib/collabOps';
import { useTheme } from '../theme';

interface ListMember {
  id: string;
  user_id: string;
  role: string;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
}

interface MembersData {
  np_list_members: ListMember[];
}

interface AssigneesData {
  np_todo_assignees: Array<{ id: string; assignee_id: string }>;
}

interface Props {
  todoId: string;
  listId: string | null | undefined;
}

function label(member: ListMember): string {
  return member.profile?.display_name?.trim() || `User …${member.user_id.slice(-6)}`;
}

export function AssigneeSelector({ todoId, listId }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const [membersResult] = useQuery<MembersData>({
    query: GET_LIST_MEMBERS,
    variables: { listId: listId ?? '' },
    pause: !listId,
    requestPolicy: 'cache-and-network',
  });
  const [assigneesResult, refetchAssignees] = useQuery<AssigneesData>({
    query: GET_TODO_ASSIGNEES,
    variables: { todoId },
    requestPolicy: 'cache-and-network',
  });

  const [, execAssign] = useMutation(ASSIGN_TODO);
  const [, execUnassign] = useMutation(UNASSIGN_TODO);

  const members = membersResult.data?.np_list_members ?? [];
  const assigneeIds = (assigneesResult.data?.np_todo_assignees ?? []).map((a) => a.assignee_id);

  // A personal list has no member rows to assign to — render nothing at all
  // rather than an empty control.
  if (!listId || members.length === 0) return null;

  const toggle = async (userId: string) => {
    setWorking(userId);
    const assigned = assigneeIds.includes(userId);
    const res = assigned
      ? await execUnassign({ todoId, assigneeId: userId })
      : await execAssign({ todoId, assigneeId: userId });
    setWorking(null);
    // Refetch rather than patch local state: the server may reject for
    // insufficient share permission, and the list must reflect what it stored.
    if (!res.error) refetchAssignees({ requestPolicy: 'network-only' });
  };

  const assigned = members.filter((m) => assigneeIds.includes(m.user_id));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Assignees</Text>
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close assignee picker' : 'Assign a member'}
          accessibilityState={{ expanded: open }}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500' }}>
            {open ? 'Done' : 'Assign'}
          </Text>
        </TouchableOpacity>
      </View>

      {assigned.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>Unassigned</Text>
      ) : (
        <View style={styles.chips}>
          {assigned.map((m) => (
            <View
              key={m.user_id}
              style={[styles.chip, { backgroundColor: colors.primarySubtle }]}
              accessibilityLabel={`Assigned: ${label(m)}`}
            >
              <Text style={{ color: colors.primary, fontSize: 13 }}>{label(m)}</Text>
            </View>
          ))}
        </View>
      )}

      {open ? (
        <View style={styles.picker}>
          {members.map((m) => {
            const isAssigned = assigneeIds.includes(m.user_id);
            return (
              <TouchableOpacity
                key={m.user_id}
                onPress={() => toggle(m.user_id)}
                disabled={working === m.user_id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAssigned, disabled: working === m.user_id }}
                accessibilityLabel={label(m)}
                style={[styles.pickerRow, { borderBottomColor: colors.borderSubtle }]}
              >
                <Text style={{ color: colors.text, fontSize: 14 }}>{label(m)}</Text>
                {working === m.user_id ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={{ color: isAssigned ? colors.primary : colors.textTertiary }}>
                    {isAssigned ? '✓' : '+'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '500' },
  empty: { fontSize: 14, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  picker: { marginTop: 10 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1,
  },
});
