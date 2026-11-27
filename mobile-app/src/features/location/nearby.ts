import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { geo } from '@/api/endpoints';
import { TURKEY_CITIES } from '@/data/locations';

const KEY = 'geldesat.nearbyCity.v1';

/** Turkish letters folded, so "Istanbul" or "Izmir" from the device's geocoder match too. */
const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/i̇/g, 'i')
    .replace(/[ıi]/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

function matchCity(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = fold(name.replace(/\s+(ili|province)$/i, '').trim());
  return TURKEY_CITIES.find((c) => fold(c.name) === n)?.name ?? null;
}

let cached: string | null | undefined;
const listeners = new Set<(city: string | null) => void>();

async function setCity(city: string | null) {
  cached = city;
  for (const fn of listeners) fn(city);
  try {
    if (city) await AsyncStorage.setItem(KEY, city);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** The person's city for "near you" rails: chosen once (GPS or manually) and kept on the device. */
export function useNearbyCity() {
  const [city, setLocal] = useState<string | null>(cached ?? null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    listeners.add(setLocal);
    if (cached === undefined) {
      void AsyncStorage.getItem(KEY)
        .then((v) => {
          cached = v;
          setLocal(v);
        })
        .catch(() => undefined);
    }
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  /** Ask for location, reverse-geocode to a province. Resolves the city or an error message. */
  const locate = useCallback(async (): Promise<{ city?: string; error?: string }> => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return { error: 'Konum izni verilmedi. Şehrinizi listeden seçebilirsiniz.' };
      let pos = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
      if (!pos) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), 10_000);
          }),
        ]).finally(() => {
          if (timer !== undefined) clearTimeout(timer);
        });
      }
      const rev = await geo.reverseFull(pos.coords.latitude, pos.coords.longitude);
      const found = matchCity(rev.city) ?? null;
      if (!found) return { error: 'Konumunuz bir ile eşleştirilemedi. Şehrinizi listeden seçin.' };
      await setCity(found);
      return { city: found };
    } catch {
      return { error: 'Konum alınamadı. Şehrinizi listeden seçebilirsiniz.' };
    } finally {
      setLocating(false);
    }
  }, []);

  return { city, setCity, locate, locating };
}
