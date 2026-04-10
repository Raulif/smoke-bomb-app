import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

export const HOME_GEOFENCE_RADIUS_METERS = 100;
export const GEOFENCE_TASK_NAME = 'SMOKE_BOMB_HOME_GEOFENCE';

// ---------------------------------------------------------------------------
// Arrival handler registry
//
// TaskManager tasks run at module scope — they cannot close over React state.
// The hook registers a callback here when active; the background task calls it.
// When the app is killed and relaunched by the OS for a geofence event, this
// will be null (React hasn't mounted yet), so we fall back to a local
// notification prompting the user to open the app and confirm manually.
// ---------------------------------------------------------------------------
let _arrivalHandler: (() => void) | null = null;

export function registerArrivalHandler(fn: () => void): void {
  _arrivalHandler = fn;
}

export function unregisterArrivalHandler(): void {
  _arrivalHandler = null;
}

// ---------------------------------------------------------------------------
// Background geofence task — must be defined at module scope so it is
// registered on every JS bundle evaluation, including background OS wake-ups.
// ---------------------------------------------------------------------------
TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('[HomeGeofence] Task error:', error.message);
    return;
  }
  const { eventType } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  if (eventType !== Location.GeofencingEventType.Enter) return;

  if (_arrivalHandler) {
    _arrivalHandler();
  } else {
    // App was relaunched in background — handler not yet registered.
    // Notify the user so they can confirm manually.
    Notifications.scheduleNotificationAsync({
      content: {
        title: "Looks like you're home!",
        body: 'Open the app to confirm your arrival and end the session.',
      },
      trigger: null,
    }).catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/** Requests foreground then background location permission. Returns true only
 *  if both are granted (background is required for geofencing to fire when the
 *  app is minimised or the screen is off). */
export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  return bg === 'granted';
}

// ---------------------------------------------------------------------------
// Geofence start / stop
// ---------------------------------------------------------------------------

export async function startHomeGeofence(
  latitude: number,
  longitude: number,
): Promise<void> {
  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
    { latitude, longitude, radius: HOME_GEOFENCE_RADIUS_METERS },
  ]);
}

export async function stopHomeGeofence(): Promise<void> {
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
}

// ---------------------------------------------------------------------------
// Address geocoding + persistence
// ---------------------------------------------------------------------------

export async function geocodeAddress(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const results = await Location.geocodeAsync(address);
  if (!results.length) return null;
  const { latitude, longitude } = results[0];
  return { latitude, longitude };
}

export async function saveHomeLocation(
  userId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ home_latitude: latitude, home_longitude: longitude })
    .eq('id', userId);
  if (error) throw error;
}

/** Haversine distance in metres between two lat/lng points. */
export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
