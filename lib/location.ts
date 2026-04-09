import * as Location from 'expo-location';
import { supabase } from './supabase';

export const HOME_GEOFENCE_RADIUS_METERS = 100;

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
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
