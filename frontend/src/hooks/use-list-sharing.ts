import { useState, useEffect, useCallback } from 'react';
import { listService } from '@/lib/services/lists';
import type { ListShare, ShareListInput } from '@/lib/types/lists';
import { toast } from 'sonner';

/**
 * Hook for managing list sharing
 */
export function useListSharing(listId: string | null) {
  const [shares, setShares] = useState<ListShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    if (!listId) {
      setShares([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listService.getListShares(listId);
      setShares(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load shares';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const shareList = useCallback(async (input: ShareListInput): Promise<ListShare | null> => {
    try {
      const newShare = await listService.shareList(input);
      toast.success(`Invite sent to ${newShare.shared_with_email}`);
      await fetchShares(); // Refresh the list
      return newShare;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to share list';
      toast.error(message);
      return null;
    }
  }, [fetchShares]);

  const updatePermission = useCallback(
    async (shareId: string, permission: 'owner' | 'editor' | 'viewer'): Promise<ListShare | null> => {
      try {
        const updatedShare = await listService.updateSharePermission(shareId, permission);
        toast.success('Permission updated');
        await fetchShares(); // Refresh the list
        return updatedShare;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update permission';
        toast.error(message);
        return null;
      }
    },
    [fetchShares]
  );

  const removeShare = useCallback(
    async (shareId: string): Promise<boolean> => {
      try {
        await listService.removeShare(shareId);
        toast.success('Access removed');
        await fetchShares(); // Refresh the list
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove share';
        toast.error(message);
        return false;
      }
    },
    [fetchShares]
  );

  const acceptInvite = useCallback(
    async (shareId: string): Promise<ListShare | null> => {
      try {
        const acceptedShare = await listService.acceptInvite(shareId);
        toast.success('Invite accepted');
        await fetchShares(); // Refresh the list
        return acceptedShare;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to accept invite';
        toast.error(message);
        return null;
      }
    },
    [fetchShares]
  );

  const refetch = useCallback(() => {
    fetchShares();
  }, [fetchShares]);

  return {
    shares,
    loading,
    error,
    shareList,
    updatePermission,
    removeShare,
    acceptInvite,
    refetch,
  };
}
