/**
 * Purpose: Barrel for the collaboration GraphQL data layer for ɳTask web.
 *          Typed fns for list sharing, membership, presence, and notifications —
 *          split by domain (members/invites/share-links/presence/notifications/
 *          assignees) per the ASI 300-line file cap; consumers keep importing
 *          from '@/lib/graphql-collab' unchanged.
 * Inputs:  listId, userId, shareId, email, role/permission strings.
 * Outputs: Typed domain objects (NpListMember, NpListShare, NpNotification …).
 * Constraints: gql() cookie-auth HTTP client; TS strict; no `any`.
 * SPORT:   D2-COLLAB-GQL
 */

export type { NpListMember, NpListShare, NpNotification } from '@nself/ntask-core';

export * from './members';
export * from './invites';
export * from './share-links';
export * from './presence';
export * from './notifications';
export * from './assignees';
