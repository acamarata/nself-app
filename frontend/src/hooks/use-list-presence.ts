import { useState, useEffect, useCallback, useRef } from 'react';
import { listService } from '@/lib/services/lists';
import type { ListPresence } from '@/lib/types/lists';
import { toast } from 'sonner';
import { useAuth } from '@/lib/providers/auth-provider';

/**
 * Hook for managing real-time presence in a list
 * Automatically joins/leaves and sends heartbeats
 */
export function useListPresence(listId: string | null) {
  const { user } = useAuth();
  const [presence, setPresence] = useState<ListPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch initial presence
  const fetchPresence = useCallback(async () => {
    if (!listId) {
      setPresence([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listService.getListPresence(listId);

      // Filter out stale presence (>1 minute old)
      const now = Date.now();
      const activePresence = data.filter((p) => {
        const lastSeen = new Date(p.last_seen_at).getTime();
        return now - lastSeen < 60000; // 1 minute
      });

      setPresence(activePresence);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load presence';
      setError(message);
      // Don't toast for presence errors - they're not critical
    } finally {
      setLoading(false);
    }
  }, [listId]);

  // Join list (send initial presence)
  const joinList = useCallback(async () => {
    if (!listId || !user) return;

    try {
      await listService.updatePresence({
        list_id: listId,
        status: 'viewing',
      });
      await fetchPresence();
    } catch (err) {
      // Silent fail - presence is non-critical
      console.error('Failed to join list:', err);
    }
  }, [listId, user, fetchPresence]);

  // Leave list (cleanup presence)
  const leaveList = useCallback(async () => {
    if (!listId || !user) return;

    try {
      await listService.leaveList(listId);
    } catch (err) {
      // Silent fail - cleanup is best-effort
      console.error('Failed to leave list:', err);
    }
  }, [listId, user]);

  // Update presence status (viewing/editing)
  const updateStatus = useCallback(
    async (status: 'viewing' | 'editing', editingTodoId?: string | null) => {
      if (!listId || !user) return;

      try {
        await listService.updatePresence({
          list_id: listId,
          status,
          editing_todo_id: editingTodoId || null,
        });
      } catch (err) {
        // Silent fail
        console.error('Failed to update presence:', err);
      }
    },
    [listId, user]
  );

  // Setup heartbeat to keep presence alive
  useEffect(() => {
    if (!listId || !user) return;

    // Join on mount
    joinList();

    // Send heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(() => {
      listService
        .updatePresence({
          list_id: listId,
          status: 'viewing',
        })
        .catch((err) => {
          console.error('Heartbeat failed:', err);
        });
    }, 30000); // 30 seconds

    // Cleanup on unmount
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      leaveList();
    };
  }, [listId, user, joinList, leaveList]);

  // Subscribe to presence updates
  useEffect(() => {
    if (!listId) {
      setPresence([]);
      setLoading(false);
      return;
    }

    fetchPresence();

    // Subscribe to real-time updates
    unsubscribeRef.current = listService.subscribeToListPresence(listId, (updatedPresence) => {
      // Filter stale presence
      const now = Date.now();
      const activePresence = updatedPresence.filter((p) => {
        const lastSeen = new Date(p.last_seen_at).getTime();
        return now - lastSeen < 60000;
      });
      setPresence(activePresence);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [listId, fetchPresence]);

  return {
    presence,
    loading,
    error,
    updateStatus,
    refetch: fetchPresence,
  };
}
