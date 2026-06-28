/**
 * Purpose: Shows all members of a shared list; lets the owner manage roles,
 *          remove/transfer, view presence, and open invite/share flows.
 * Inputs:  Navigation params: listId, listTitle, currentUserId, isOwner.
 * Outputs: SectionList of members + pending invites; 7-state rendering.
 * Constraints:
 *   - 7 states: loading | empty | error | populated | offline | permission-denied | rate-limited
 *   - Owner-only: Change Role, Remove, Transfer Ownership (guarded by isOwner)
 *   - Non-owner: Leave List button at bottom
 *   - Sub-components (MemberRow, InviteRow) extracted to components/collab/
 * SPORT: P5-L-collab-ops
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, SectionList,
  type SectionListData,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import type { ListMember, ListInvite } from '../lib/collabOps';

type CollabItem = ListMember | ListInvite;
type CollabSection = SectionListData<CollabItem, { title: string; data: CollabItem[] }>;
import {
  useListMembers, useListInvites, useListPresence, useCollabMutations,
} from '../hooks/useCollab';
import {
  EmptyState, ErrorCard, OfflineBanner, PermissionDenied,
  RateLimitedCard, SkeletonList,
} from '../components/seven-states';
import { useNetworkState } from '../hooks/useNetworkState';
import { MemberRow } from '../components/collab/MemberRow';
import { InviteRow } from '../components/collab/InviteRow';
import { PresenceAvatars } from '../components/collab/PresenceAvatars';
// InviteModal and ShareLinkSheet are Epic L wave 2 components
import { InviteModal } from '../components/collab/InviteModal';
import { ShareLinkSheet } from '../components/collab/ShareLinkSheet';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListMembers'>;

export function ListMembersScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { listId, listTitle, currentUserId, isOwner } = route.params;

  const { members, fetching: membersFetching, error: membersError, refetch: refetchMembers } = useListMembers(listId);
  const { invites, fetching: invitesFetching, refetch: refetchInvites } = useListInvites(listId);
  const { presenceUsers } = useListPresence(listId);
  const mutations = useCollabMutations();
  const { isConnected } = useNetworkState({
    onReconnect: () => {
      refetchMembers({ requestPolicy: 'network-only' });
      refetchInvites({ requestPolicy: 'network-only' });
    },
  });

  const [inviteVisible, setInviteVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const refetch = useCallback(() => {
    refetchMembers({ requestPolicy: 'network-only' });
    refetchInvites({ requestPolicy: 'network-only' });
  }, [refetchMembers, refetchInvites]);

  const presenceMap = new Map(presenceUsers.map((p) => [p.user_id, p]));

  // ---------------------------------------------------------------------------
  // Member action sheet (owner only)
  // ---------------------------------------------------------------------------

  const handleMemberLongPress = useCallback((member: ListMember) => {
    Alert.alert(member.profile?.display_name ?? member.user_id, undefined, [
      { text: 'Change Role', onPress: () => setExpandedMemberId(member.id) },
      {
        text: 'Remove Member', style: 'destructive',
        onPress: () => Alert.alert(
          'Remove member',
          `Remove ${member.profile?.display_name ?? member.user_id} from "${listTitle}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove', style: 'destructive',
              onPress: async () => {
                const res = await mutations.removeMember(listId, member.user_id);
                if (res.error) Alert.alert('Error', res.error.message);
                else refetch();
              },
            },
          ],
        ),
      },
      {
        text: 'Transfer Ownership',
        onPress: () => Alert.alert(
          'Transfer ownership',
          `Make ${member.profile?.display_name ?? member.user_id} the owner? You become an admin.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Transfer', style: 'destructive',
              onPress: async () => {
                const res = await mutations.transferOwnership(listId, member.user_id);
                if (res.error) Alert.alert('Error', res.error.message);
                else { refetch(); navigation.goBack(); }
              },
            },
          ],
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [listId, listTitle, mutations, navigation, refetch]);

  const handleRoleSelect = useCallback(async (member: ListMember, role: string) => {
    setExpandedMemberId(null);
    const res = await mutations.updateRole(listId, member.user_id, role);
    if (res.error) Alert.alert('Error', res.error.message);
    else refetch();
  }, [listId, mutations, refetch]);

  const handleLeave = useCallback(() => {
    Alert.alert('Leave list', `Leave "${listTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          const res = await mutations.leaveList(listId);
          if (res.error) Alert.alert('Error', res.error.message);
          else navigation.goBack();
        },
      },
    ]);
  }, [listId, listTitle, mutations, navigation]);

  // ---------------------------------------------------------------------------
  // 7-state body
  // ---------------------------------------------------------------------------

  const loading = membersFetching && members.length === 0;

  const renderBody = () => {
    if (loading) return <SkeletonList rows={5} rowHeight={64} />;

    if (membersError) {
      const msg = membersError.message ?? '';
      if (msg.includes('401') || msg.includes('403') || msg.includes('forbidden'))
        return <PermissionDenied />;
      if (msg.includes('429') || msg.includes('rate'))
        return <RateLimitedCard retryAfter={30} onRetry={refetch} />;
      return <ErrorCard message="Could not load members." onRetry={refetch} />;
    }

    if (members.length === 0) {
      return (
        <EmptyState
          icon="👥"
          title="No members yet"
          hint="Invite someone to collaborate on this list"
          actionLabel="Invite"
          onAction={() => setInviteVisible(true)}
        />
      );
    }

    const pendingInvites = invites.filter((i) => i.status === 'pending');

    const sections: CollabSection[] = [
      { title: 'Members', data: members as CollabItem[] },
      ...(pendingInvites.length > 0 ? [{ title: 'Pending invites', data: pendingInvites as CollabItem[] }] : []),
    ];

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => (item as CollabItem).id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={membersFetching || invitesFetching} onRefresh={refetch} tintColor={colors.primary} />}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          if (section.title === 'Members') {
            const m = item as unknown as ListMember;
            const pres = presenceMap.get(m.user_id);
            return (
              <MemberRow
                member={m}
                isPresent={!!pres}
                presenceStatus={pres?.status as 'viewing' | 'editing' | undefined}
                isOwner={isOwner}
                currentUserId={currentUserId}
                onLongPress={handleMemberLongPress}
                onRoleSelect={handleRoleSelect}
                expandedId={expandedMemberId}
              />
            );
          }
          const inv = item as unknown as ListInvite;
          return (
            <InviteRow
              invite={inv}
              isOwner={isOwner}
              onAccept={async (id) => { await mutations.acceptInvite(id); refetch(); }}
              onDecline={async (id) => { await mutations.declineInvite(id); refetch(); }}
              onRevoke={async (id) => { await mutations.revokeInvite(id); refetch(); }}
            />
          );
        }}
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button" style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Members</Text>
        <TouchableOpacity onPress={() => setInviteVisible(true)} accessibilityLabel="Invite member" accessibilityRole="button">
          <Text style={[styles.inviteBtn, { color: colors.primary }]}>Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.subHeader, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <PresenceAvatars
          presenceUsers={presenceUsers.map((p) => ({
            userId: p.user_id,
            displayName: p.profile?.display_name,
            avatarUrl: p.profile?.avatar_url,
            status: p.status as 'viewing' | 'editing',
          }))}
          maxVisible={4}
        />
        <TouchableOpacity onPress={() => setShareVisible(true)} accessibilityLabel="Share list link" accessibilityRole="button">
          <Text style={[styles.shareLinkText, { color: colors.primary }]}>🔗 Share link</Text>
        </TouchableOpacity>
      </View>

      <OfflineBanner visible={!isConnected} />

      <View style={styles.body}>{renderBody()}</View>

      {!isOwner && (
        <TouchableOpacity
          style={[styles.leaveBtn, { borderColor: colors.danger, backgroundColor: colors.surfaceElevated }]}
          onPress={handleLeave}
          accessibilityLabel="Leave this list"
          accessibilityRole="button"
        >
          <Text style={[styles.leaveBtnText, { color: colors.danger }]}>Leave list</Text>
        </TouchableOpacity>
      )}

      <InviteModal visible={inviteVisible} listId={listId} onClose={() => { setInviteVisible(false); refetch(); }} />
      <ShareLinkSheet visible={shareVisible} listId={listId} onClose={() => setShareVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  inviteBtn: { fontSize: 15, fontWeight: '600', minWidth: 60, textAlign: 'right' },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  shareLinkText: { fontSize: 14, fontWeight: '500' },
  body: { flex: 1 },
  listContent: { paddingBottom: 32 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  leaveBtn: { margin: 16, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  leaveBtnText: { fontSize: 15, fontWeight: '600' },
});
