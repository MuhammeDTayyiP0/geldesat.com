import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { TURKEY_CITIES } from '@/data/locations';

const KEY = 'geldesat.nearbyCity.v1';

function matchCity(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLocaleLowerCase('tr').replace(/\s+(ili|province)$/i, '').trim();
  return TURKEY_CITIES.find((c) => c.name.toLocaleLowerCase('tr') === n)?.name ?? null;
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
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const found = places.map((p) => matchCity(p.region) ?? matchCity(p.city) ?? matchCity(p.subregion)).find(Boolean) ?? null;
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
