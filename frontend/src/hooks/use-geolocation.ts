import { useState, useEffect, useCallback } from 'react';
import { geolocationService } from '@/lib/services/geolocation';
import type { Coordinates, LocationPermissionStatus } from '@/lib/services/geolocation';
import type { List } from '@/lib/types/lists';
import type { Todo } from '@/lib/types/todos';
import { toast } from 'sonner';

export function useGeolocation(options?: { enableMonitoring?: boolean }) {
  const [permission, setPermission] = useState<LocationPermissionStatus>({
    granted: false,
    denied: false,
    prompt: true,
  });
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(null);
  const [nearbyLists, setNearbyLists] = useState<List[]>([]);
  const [nearbyTodos, setNearbyTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPermission = useCallback(async () => {
    try {
      const status = await geolocationService.checkPermission();
      setPermission(status);
      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check permission';
      setError(message);
      return permission;
    }
  }, [permission]);

  const requestPermission = useCallback(async () => {
    try {
      setLoading(true);
      const granted = await geolocationService.requestPermission();
      setPermission({
        granted,
        denied: !granted,
        prompt: false,
      });

      if (granted) {
        toast.success('Location access granted');
      } else {
        toast.error('Location access denied');
      }

      return granted;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request permission';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCurrentPosition = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const position = await geolocationService.getCurrentPosition();
      setCurrentPosition(position);
      return position;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get location';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkProximity = useCallback(async () => {
    try {
      const position = await geolocationService.getCurrentPosition();
      setCurrentPosition(position);

      const lists = await geolocationService.checkProximityToLists(
        position.latitude,
        position.longitude
      );
      setNearbyLists(lists);

      const todos = await geolocationService.checkProximityToTodos(
        position.latitude,
        position.longitude
      );
      setNearbyTodos(todos);

      return { lists, todos };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check proximity';
      setError(message);
      return { lists: [], todos: [] };
    }
  }, []);

  const startMonitoring = useCallback(() => {
    geolocationService.startMonitoring();
    toast.success('Location monitoring started');
  }, []);

  const stopMonitoring = useCallback(() => {
    geolocationService.stopMonitoring();
    toast.info('Location monitoring stopped');
  }, []);

  // Auto-start monitoring if enabled
  useEffect(() => {
    if (options?.enableMonitoring && permission.granted) {
      startMonitoring();

      return () => {
        stopMonitoring();
      };
    }
  }, [options?.enableMonitoring, permission.granted, startMonitoring, stopMonitoring]);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    permission,
    currentPosition,
    nearbyLists,
    nearbyTodos,
    loading,
    error,
    requestPermission,
    getCurrentPosition,
    checkProximity,
    startMonitoring,
    stopMonitoring,
    isMonitoring: geolocationService.isMonitoring(),
  };
}
