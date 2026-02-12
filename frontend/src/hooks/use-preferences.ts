import { useState, useEffect, useCallback } from 'react';
import { preferencesService } from '@/lib/services/preferences';
import type { UserPreferences, UpdatePreferencesInput, TimeFormat } from '@/lib/types/todos';
import { toast } from 'sonner';

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await preferencesService.getPreferences();
      setPreferences(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load preferences';
      setError(message);
      // Don't toast - preferences loading is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (input: UpdatePreferencesInput) => {
    try {
      const updated = await preferencesService.updatePreferences(input);
      setPreferences(updated);
      toast.success('Preferences updated');
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update preferences';
      toast.error(message);
      throw err;
    }
  }, []);

  const setTimeFormat = useCallback(
    async (format: TimeFormat) => {
      await updatePreferences({ time_format: format });
    },
    [updatePreferences]
  );

  const setAutoHideCompleted = useCallback(
    async (autoHide: boolean) => {
      await updatePreferences({ auto_hide_completed: autoHide });
    },
    [updatePreferences]
  );

  const setThemePreference = useCallback(
    async (theme: 'light' | 'dark' | 'system') => {
      await updatePreferences({ theme_preference: theme });
    },
    [updatePreferences]
  );

  const setDefaultList = useCallback(
    async (listId: string | null) => {
      await updatePreferences({ default_list_id: listId });
    },
    [updatePreferences]
  );

  // Subscribe to real-time updates
  useEffect(() => {
    fetchPreferences();

    const unsubscribe = preferencesService.subscribeToPreferences((updatedPreferences) => {
      setPreferences(updatedPreferences);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    setTimeFormat,
    setAutoHideCompleted,
    setThemePreference,
    setDefaultList,
    refetch: fetchPreferences,
  };
}
