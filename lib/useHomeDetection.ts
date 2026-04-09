import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getDistanceMeters, HOME_GEOFENCE_RADIUS_METERS } from './location';

const POLL_INTERVAL_MS = 30_000;

interface UseHomeDetectionOptions {
  enabled: boolean;
  smokeBombId: string | null;
  sessionId: string | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  onArrived: () => Promise<void>;
}

interface UseHomeDetectionResult {
  tracking: boolean;
  permissionDenied: boolean;
}

export function useHomeDetection({
  enabled,
  smokeBombId,
  sessionId,
  homeLatitude,
  homeLongitude,
  onArrived,
}: UseHomeDetectionOptions): UseHomeDetectionResult {
  const [tracking, setTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Stable refs so the interval closure always sees the latest values
  const arrivedRef = useRef(false);
  const onArrivedRef = useRef(onArrived);
  useEffect(() => { onArrivedRef.current = onArrived; }, [onArrived]);

  useEffect(() => {
    if (!enabled || homeLatitude == null || homeLongitude == null || !smokeBombId || !sessionId) {
      setTracking(false);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      arrivedRef.current = false;

      async function checkLocation() {
        if (arrivedRef.current) return;
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const dist = getDistanceMeters(
            pos.coords.latitude,
            pos.coords.longitude,
            homeLatitude!,
            homeLongitude!,
          );
          if (dist <= HOME_GEOFENCE_RADIUS_METERS) {
            arrivedRef.current = true;
            if (intervalId) clearInterval(intervalId);
            setTracking(false);
            await onArrivedRef.current();
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'You made it home!',
                body: 'Session ended — your escape is complete.',
              },
              trigger: null,
            });
          }
        } catch {
          // Location read failed — will retry on next tick
        }
      }

      setTracking(true);
      // Check immediately, then on interval
      checkLocation();
      intervalId = setInterval(checkLocation, POLL_INTERVAL_MS);
    }

    startTracking();

    return () => {
      if (intervalId) clearInterval(intervalId);
      setTracking(false);
    };
  }, [enabled, smokeBombId, sessionId, homeLatitude, homeLongitude]);

  return { tracking, permissionDenied };
}
