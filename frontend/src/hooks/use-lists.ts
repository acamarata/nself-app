import { useState, useEffect, useCallback } from 'react';
import { listService } from '@/lib/services/lists';
import type { List, CreateListInput, UpdateListInput } from '@/lib/types/lists';
import { toast } from 'sonner';

/**
 * Hook for managing all lists
 */
export function useLists() {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listService.getLists();
      setLists(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lists';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    fetchLists();

    const unsubscribe = listService.subscribeToLists((updatedLists) => {
      setLists(updatedLists);
    });

    return unsubscribe;
  }, [fetchLists]);

  const createList = useCallback(async (input: CreateListInput): Promise<List | null> => {
    try {
      const newList = await listService.createList(input);
      toast.success(`List "${newList.title}" created`);
      return newList;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create list';
      toast.error(message);
      return null;
    }
  }, []);

  const updateList = useCallback(async (id: string, input: UpdateListInput): Promise<List | null> => {
    try {
      const updatedList = await listService.updateList(id, input);
      toast.success('List updated');
      return updatedList;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update list';
      toast.error(message);
      return null;
    }
  }, []);

  const deleteList = useCallback(async (id: string): Promise<boolean> => {
    try {
      await listService.deleteList(id);
      toast.success('List deleted');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete list';
      toast.error(message);
      return false;
    }
  }, []);

  const refetch = useCallback(() => {
    fetchLists();
  }, [fetchLists]);

  return {
    lists,
    loading,
    error,
    createList,
    updateList,
    deleteList,
    refetch,
  };
}

/**
 * Hook for managing a single list
 */
export function useList(id: string | null) {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!id) {
      setList(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listService.getListById(id);
      setList(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load list';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const refetch = useCallback(() => {
    fetchList();
  }, [fetchList]);

  return {
    list,
    loading,
    error,
    refetch,
  };
}
