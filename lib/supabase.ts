import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import type { Database } from './types';

// SecureStore has a 2048-char key limit — encode long keys to stay safe
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(encodeKey(key)),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(encodeKey(key), value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(encodeKey(key)),
};

function encodeKey(key: string): string {
  // Replace characters that SecureStore doesn't allow and keep under 255 chars
  return key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
