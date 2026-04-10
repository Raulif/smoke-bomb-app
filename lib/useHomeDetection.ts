import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  registerArrivalHandler,
  unregisterArrivalHandler,
  requestLocationPermissions,
  startHomeGeofence,
  stopHomeGeofence,
} from './location';

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

  // Guard against double-firing if the OS delivers the event more than once
  const arrivedRef = useRef(false);
  // Always call the latest version of onArrived without re-running the effect
  const onArrivedRef = useRef(onArrived);
  useEffect(() => { onArrivedRef.current = onArrived; }, [onArrived]);

  useEffect(() => {
    if (!enabled || homeLatitude == null || homeLongitude == null || !smokeBombId || !sessionId) {
      setTracking(false);
      return;
    }

    let active = true;

    async function start() {
      const granted = await requestLocationPermissions();
      if (!active) return;

      if (!granted) {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      arrivedRef.current = false;

      registerArrivalHandler(async () => {
        if (arrivedRef.current) return;
        arrivedRef.current = true;
        setTracking(false);
        try {
          await onArrivedRef.current();
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'You made it home!',
              body: 'Session ended — your escape is complete.',
            },
            trigger: null,
          });
        } catch (e) {
          console.error('[HomeGeofence] Arrival handler error:', e);
        }
      });

      try {
        await startHomeGeofence(homeLatitude!, homeLongitude!);
        if (active) setTracking(true);
      } catch (e) {
        console.error('[HomeGeofence] Could not start geofencing:', e);
        unregisterArrivalHandler();
      }
    }

    start();

    return () => {
      active = false;
      unregisterArrivalHandler();
      stopHomeGeofence().catch(() => {});
      setTracking(false);
    };
  }, [enabled, smokeBombId, sessionId, homeLatitude, homeLongitude]);

  return { tracking, permissionDenied };
}
