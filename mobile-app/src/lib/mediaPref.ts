import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type PhotoQuality = 'low' | 'standard' | 'high';

const KEY = 'gds:photo-quality';

export const PHOTO_QUALITY_LABELS: Record<PhotoQuality, { label: string; detail: string }> = {
  low: { label: 'Veri tasarrufu', detail: 'Daha küçük boyut, hızlı yükleme' },
  standard: { label: 'Standart', detail: 'Dengeli kalite ve hız (önerilen)' },
  high: { label: 'Yüksek kalite', detail: 'En net fotoğraf, daha fazla veri' },
};

export function usePhotoQuality(): [PhotoQuality, (next: PhotoQuality) => void] {
  const [quality, setQualityState] = useState<PhotoQuality>('standard');

  useEffect(() => {
    void AsyncStorage.getItem(KEY)
      .then((val) => {
        if (val === 'low' || val === 'standard' || val === 'high') {
          setQualityState(val);
        }
      })
      .catch(() => undefined);
  }, []);

  const setQuality = (next: PhotoQuality) => {
    setQualityState(next);
    void AsyncStorage.setItem(KEY, next).catch(() => undefined);
  };

  return [quality, setQuality];
}
