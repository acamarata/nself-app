-- Migration 021: np_list_invites + np_list_shares share-link columns
--
-- L-S1-T1: np_list_invites — email-based list collaboration invitations
-- L-S1-T2: np_list_shares — add token + expires_at for public share links
--
-- np_list_invites lifecycle:
--   owner creates invite (status=pending, token=UUID, expires_at=+7d)
--   invitee accepts (status=accepted) or declines (status=declined)
--   owner can revoke at any time (status=revoked)
--
-- RLS: invitee sees by email match; owner/admin sees by list membership

-- ---------------------------------------------------------------------------
-- np_list_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.np_list_invites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id         UUID        NOT NULL REFERENCES public.np_lists(id) ON DELETE CASCADE,
  invited_email   TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('owner', 'editor', 'viewer')),
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  invited_by      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token           TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  source_account_id TEXT      NOT NULL DEFAULT 'primary',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, invited_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_np_list_invites_list_id
  ON public.np_list_invites(list_id);
CREATE INDEX IF NOT EXISTS idx_np_list_invites_invited_email
  ON public.np_list_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_np_list_invites_invited_by
  ON public.np_list_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_np_list_invites_token
  ON public.np_list_invites(token);
CREATE INDEX IF NOT EXISTS idx_np_list_invites_status
  ON public.np_list_invites(status);
CREATE INDEX IF NOT EXISTS idx_np_list_invites_expires_at
  ON public.np_list_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_np_list_invites_source_account
  ON public.np_list_invites(source_account_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_np_list_invites_updated_at ON public.np_list_invites;
CREATE TRIGGER set_np_list_invites_updated_at
  BEFORE UPDATE ON public.np_list_invites
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS for np_list_invites
-- ---------------------------------------------------------------------------
ALTER TABLE public.np_list_invites ENABLE ROW LEVEL SECURITY;

-- Invitee sees their own pending invites (by email)
DROP POLICY IF EXISTS "Invitees can view their own invites" ON public.np_list_invites;
CREATE POLICY "Invitees can view their own invites"
  ON public.np_list_invites FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- List owner/admin can see all invites for their list
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_list_invites.list_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Only list owners/admins can create invites (enforced also at action level)
DROP POLICY IF EXISTS "Owners and admins can create invites" ON public.np_list_invites;
CREATE POLICY "Owners and admins can create invites"
  ON public.np_list_invites FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = list_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Status updates: invitee can accept/decline; owner/admin can revoke
DROP POLICY IF EXISTS "Invitees and owners can update invite status" ON public.np_list_invites;
CREATE POLICY "Invitees and owners can update invite status"
  ON public.np_list_invites FOR UPDATE
  USING (
    -- Invitee: can accept or decline their own pending invite
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- Owner/admin: can revoke
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_list_invites.list_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Only the inviter or list owner can delete (hard-delete not used in normal flow — revoke instead)
DROP POLICY IF EXISTS "Owners can delete invites" ON public.np_list_invites;
CREATE POLICY "Owners can delete invites"
  ON public.np_list_invites FOR DELETE
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_list_invites.list_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- np_list_shares: add token + expires_at for share-link feature
-- ---------------------------------------------------------------------------
-- token: opaque link token for public share access (NULL = not a share link)
-- expires_at: optional expiry for the share link (NULL = never)
ALTER TABLE public.np_list_shares
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Index on token for fast share-link lookups
CREATE INDEX IF NOT EXISTS idx_np_list_shares_token
  ON public.np_list_shares(token)
  WHERE token IS NOT NULL;
