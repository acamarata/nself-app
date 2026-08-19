/**
 * collaboration/index.ts — Barrel export for collaboration UI components
 *
 * Purpose:    Single import surface for all list-sharing / presence / member
 *             management components used in ListDetailPage and AppShell.
 * Constraints: All components are client-side only; no SSR.
 */
export { RoleSelector } from './RoleSelector'
export { ShareListDialog } from './ShareListDialog'
export { ListMembersPanel } from './ListMembersPanel'
export { PresenceAvatarStack } from './PresenceAvatarStack'
export { InviteBanner } from './InviteBanner'
