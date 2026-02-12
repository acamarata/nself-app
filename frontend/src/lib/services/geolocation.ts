import { notificationService } from './notifications';
import { listService } from './lists';
import { todoService } from './todos';
import type { List } from '../types/lists';
import type { Todo } from '../types/todos';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface LocationPermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

export class GeolocationService {
  private watchId: number | null = null;
  private lastPosition: Coordinates | null = null;
  private notifiedLocations: Set<string> = new Set();

  // --- Permission Management ---

  async checkPermission(): Promise<LocationPermissionStatus> {
    if (!('geolocation' in navigator)) {
      return { granted: false, denied: true, prompt: false };
    }

    if (!('permissions' in navigator)) {
      // Fallback: try to get position to check permission
      try {
        await this.getCurrentPosition();
        return { granted: true, denied: false, prompt: false };
      } catch {
        return { granted: false, denied: false, prompt: true };
      }
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return {
        granted: result.state === 'granted',
        denied: result.state === 'denied',
        prompt: result.state === 'prompt',
      };
    } catch {
      return { granted: false, denied: false, prompt: true };
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      await this.getCurrentPosition();
      return true;
    } catch (error) {
      console.error('Geolocation permission denied:', error);
      return false;
    }
  }

  // --- Position ---

  async getCurrentPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          this.lastPosition = coords;
          resolve(coords);
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // 1 minute cache
        }
      );
    });
  }

  // --- Distance Calculation ---

  /**
   * Calculate distance between two points using Haversine formula
   * @returns Distance in meters
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  isWithinRadius(
    userLat: number,
    userLng: number,
    targetLat: number,
    targetLng: number,
    radiusMeters: number
  ): boolean {
    const distance = this.calculateDistance(userLat, userLng, targetLat, targetLng);
    return distance <= radiusMeters;
  }

  // --- Proximity Monitoring ---

  async checkProximityToLists(userLat: number, userLng: number): Promise<List[]> {
    const lists = await listService.getLists();
    const nearbyLists: List[] = [];

    for (const list of lists) {
      if (
        list.location_lat &&
        list.location_lng &&
        list.location_radius &&
        list.reminder_on_arrival
      ) {
        const isNearby = this.isWithinRadius(
          userLat,
          userLng,
          list.location_lat,
          list.location_lng,
          list.location_radius
        );

        if (isNearby) {
          nearbyLists.push(list);

          // Send notification if not already notified
          const notificationKey = `list-${list.id}`;
          if (!this.notifiedLocations.has(notificationKey)) {
            await notificationService.notifyLocationReminder(
              list.title,
              list.location_name || 'this location',
              list.id
            );
            this.notifiedLocations.add(notificationKey);
          }
        } else {
          // Remove from notified set if user left the area
          this.notifiedLocations.delete(`list-${list.id}`);
        }
      }
    }

    return nearbyLists;
  }

  async checkProximityToTodos(userLat: number, userLng: number): Promise<Todo[]> {
    // Get all todos with location (across all lists)
    const allTodos: Todo[] = [];
    const lists = await listService.getLists();

    for (const list of lists) {
      const todos = await todoService.getTodos(list.id);
      allTodos.push(...todos);
    }

    const nearbyTodos: Todo[] = [];

    for (const todo of allTodos) {
      if (
        todo.location_lat &&
        todo.location_lng &&
        todo.location_radius &&
        !todo.completed
      ) {
        const isNearby = this.isWithinRadius(
          userLat,
          userLng,
          todo.location_lat,
          todo.location_lng,
          todo.location_radius
        );

        if (isNearby) {
          nearbyTodos.push(todo);

          // Send notification if not already notified
          const notificationKey = `todo-${todo.id}`;
          if (!this.notifiedLocations.has(notificationKey)) {
            await notificationService.notifyLocationReminder(
              todo.title,
              todo.location_name || 'this location',
              todo.list_id
            );
            this.notifiedLocations.add(notificationKey);
          }
        } else {
          // Remove from notified set if user left the area
          this.notifiedLocations.delete(`todo-${todo.id}`);
        }
      }
    }

    return nearbyTodos;
  }

  // --- Background Monitoring ---

  startMonitoring(intervalMs = 60000): void {
    if (this.watchId !== null) {
      console.warn('Monitoring is already active');
      return;
    }

    if (!('geolocation' in navigator)) {
      console.error('Geolocation is not supported');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        this.lastPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        // Check proximity to lists and todos
        await this.checkProximityToLists(this.lastPosition.latitude, this.lastPosition.longitude);
        await this.checkProximityToTodos(this.lastPosition.latitude, this.lastPosition.longitude);
      },
      (error) => {
        console.error('Geolocation watch error:', error);
      },
      {
        enableHighAccuracy: false, // Lower accuracy for background monitoring
        timeout: 30000,
        maximumAge: 60000,
      }
    );

    console.log('Location monitoring started');
  }

  stopMonitoring(): void {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.notifiedLocations.clear();
      console.log('Location monitoring stopped');
    }
  }

  isMonitoring(): boolean {
    return this.watchId !== null;
  }

  getLastPosition(): Coordinates | null {
    return this.lastPosition;
  }

  // --- Geocoding Helpers ---

  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    // Note: This requires a geocoding API like Google Maps, Mapbox, or Nominatim
    // For now, this is a placeholder. Implement with your preferred geocoding service.
    console.warn('Geocoding not implemented. Use a geocoding API like Google Maps or Mapbox.');
    return null;
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    // Note: This requires a reverse geocoding API
    // For now, this is a placeholder.
    console.warn('Reverse geocoding not implemented. Use a geocoding API like Google Maps or Mapbox.');
    return null;
  }

  // --- Testing Helpers ---

  async simulateLocationChange(lat: number, lng: number): Promise<void> {
    this.lastPosition = {
      latitude: lat,
      longitude: lng,
      accuracy: 10,
    };

    await this.checkProximityToLists(lat, lng);
    await this.checkProximityToTodos(lat, lng);
  }
}

export const geolocationService = new GeolocationService();
