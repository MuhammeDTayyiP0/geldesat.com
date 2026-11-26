import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Keyboard, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardToolbar, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CarFront,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  LayoutGrid,
  LocateFixed,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, catalog, geo, myListings, uploads } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import type { AttrDef, Category } from '@/api/types';
import { useSession } from '@/auth/session';
import { NEIGHBORHOODS } from '@/data/neighborhoods';
import { TURKEY_CITIES } from '@/data/locations';
import { categoryIcon } from '@/features/catalog/categoryIcon';
import { LocationPicker } from '@/features/chat/LocationPicker';
import { OptionPicker } from '@/features/location/OptionPicker';
import { MapThumb } from '@/features/map/MapThumb';
import { isCityCenterFallback } from '@/features/map/cityCoords';
import { AttrField } from '@/features/post/AttrField';
import {
  VehicleDamageSvg,
  hasDamageData,
  parseDamageValue,
  summarizeDamage,
  syncDamageAttrs,
} from '@/features/listing/VehicleDamageSvg';
import { PhotoReview } from '@/features/photos/PhotoReview';
import { PhotoViewer } from '@/features/listing/Gallery';
import { PhotoStep } from '@/features/post/PhotoStep';
import { MAX_PHOTOS, PHOTO_KEEP_MS, STEP_TITLES, emptyDraft, needsPhoto, stepError, type Currency, type Draft, type PhotoItem, type StepKey } from '@/features/post/draft';
import { mediaUrl } from '@/lib/config';
import { useFlag } from '@/lib/flags';
import { cleanPhone, formatNumber, formatPrice, locationLabel, maskPhoneInput, maskThousands, parseMasked } from '@/lib/format';
import { pickPhotos, preparePhoto, recoverPickedPhotos, rotatePhoto, type PickedPhoto } from '@/lib/photos';
import { clearDraft, loadDraft, saveDraft } from '@/lib/storage';
import { Badge, Button, Card, Chip, Divider, EmptyState, ErrorState, IconButton, Input, Loading, Segmented, SelectField, Text, confirm, hairline, radius, space, toast, useTheme } from '@/ui';
import { Image } from 'expo-image';

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'TRY', label: '₺ TRY' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
];
const CURRENCY_SUFFIX: Record<Currency, string> = { TRY: '₺', USD: '$', EUR: '€' };
const UPLOAD_CONCURRENCY = 3;
const POPULAR_NAMES = new Set([
  'BMW',
  'Mercedes-Benz',
  'Audi',
  'Volkswagen',
  'Renault',
  'Fiat',
  'Ford',
  'Toyota',
  'Honda',
  'Hyundai',
  'Opel',
  'Peugeot',
  'Citroen',
  'Volvo',
  'Nissan',
  'Skoda',
  'Seat',
  'Dacia',
  'Tesla',
  'Togg',
  'Yamaha',
  'Kawasaki',
  'Suzuki',
  'KTM',
  'Vespa',
]);

const LETTER_ORDER = '#ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ';

function firstLetter(name: string): string {
  const ch = name.trim().charAt(0);
  if (!ch || /\d/.test(ch)) return '#';
  return ch.toLocaleUpperCase('tr');
}

function sortLetters(a: string, b: string): number {
  const ia = LETTER_ORDER.indexOf(a);
  const ib = LETTER_ORDER.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b, 'tr');
}

function sortedCats(list: Category[]): Category[] {
  return [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'tr'));
}

const DAMAGE_ALLOWED_IDS = new Set([
  'otomobil',
  'arazi-suv',
  'minivan',
  'hasarli',
  'klasik',
  'engelli-plaka',
  'kiralik-arac',
  'ticari-kamyonet',
  'ticari-minibus',
]);
const DAMAGE_EXCLUDED_IDS = new Set([
  'moto',
  'motosiklet',
  'deniz',
  'hava',
  'atv',
  'elektrikli-bisiklet',
  'karavan',
  'ticari-kamyon',
  'ticari-cekici',
  'ticari-otobus',
]);

function isDamageVehicleCategory(path: Category[]): boolean {
  if (path.some((p) => DAMAGE_EXCLUDED_IDS.has(p.id) || DAMAGE_EXCLUDED_IDS.has(p.slug))) return false;
  if (path.some((p) => DAMAGE_ALLOWED_IDS.has(p.id) || DAMAGE_ALLOWED_IDS.has(p.slug))) return true;
  return path.some((p) => {
    const n = p.name.toLocaleLowerCase('tr');
    return n.includes('otomobil') || n.includes('suv') || n.includes('minivan') || n.includes('panelvan');
  });
}

function getCategoryPlaceholders(path: Category[]): { title: string; description: string } {
  const root = path[0]?.id;
  const joined = path.map((p) => p.name.toLocaleLowerCase('tr')).join(' ');
  if (root === 'emlak' || joined.includes('arsa') || joined.includes('daire') || joined.includes('konut')) {
    if (joined.includes('arsa') || joined.includes('tarla')) {
      return {
        title: 'Örn. Yatırıma uygun imarlı 450 m² köşe parsel arsa',
        description: 'Ada/parsel veya konum bilgisi, imar durumu, yola cephe, altyapı ve tapu durumu…',
      };
    }
    return {
      title: 'Örn. Kadıköy Moda’da 2+1 deniz manzaralı ferah daire',
      description: 'Cephe, ısınma, aidat, ulaşım yakınlığı, tadilat ve tapu/kredi durumu…',
    };
  }
  if (root === 'vasita') {
    if (joined.includes('motosiklet')) {
      return {
        title: 'Örn. Hatasız 2022 Yamaha MT-07 ABS 12.000 km',
        description: 'Bakım geçmişi, lastik/zincir durumu, ekstra aksesuarlar, tramer/boya bilgisi…',
      };
    }
    return {
      title: 'Örn. Sahibinden temiz 2018 Renault Clio 1.5 dCi',
      description: 'Bakım geçmişi, ekspertiz/boya durumu, lastikler, yedek anahtar ve muayene tarihi…',
    };
  }
  if (joined.includes('telefon') || joined.includes('bilgisayar') || root === 'elektronik') {
    return {
      title: 'Örn. iPhone 15 Pro 256 GB TR Garantili Kutu Faturalı',
      description: 'Pil sağlığı, kozmetik durumu, kutu/fatura/garanti, tamir veya değişen parça bilgisi…',
    };
  }
  return {
    title: 'Örn. Marka, model, beden/kapasite ve önemli özellik',
    description: 'Ürünün durumu, kullanım süresi, varsa kusurları, kutu/garanti ve teslimat bilgisi…',
  };
}

const foldGeo = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/i̇/g, 'i')
    .replace(/[ıi]/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

function matchCityName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = foldGeo(raw.replace(/\s+(ili|province)$/i, '').trim());
  return TURKEY_CITIES.find((c) => foldGeo(c.name) === n)?.name ?? null;
}

function matchDistrictName(city: string, raw: string | null | undefined): string | null {
  if (!city || !raw) return null;
  const cityObj = TURKEY_CITIES.find((c) => c.name === city);
  if (!cityObj) return null;
  const n = foldGeo(raw.replace(/\s+(ilçesi|district)$/i, '').trim());
  return cityObj.districts.find((d) => foldGeo(d) === n) ?? null;
}

function matchNeighborhoodName(city: string, district: string, raw: string | null | undefined): string | null {
  if (!city || !district || !raw) return null;
  const list = NEIGHBORHOODS[city]?.[district] ?? [];
  const n = foldGeo(raw.replace(/\s+(mahallesi|mah\.?)$/i, '').trim());
  return list.find((h) => foldGeo(h) === n) ?? null;
}

function editSnapshotOf(d: Draft): string {
  return JSON.stringify({
    path: d.path.map((p) => p.id),
    photos: d.photos.map((p) => p.url ?? p.key),
    title: d.title,
    price: d.price,
    currency: d.currency ?? 'TRY',
    description: d.description,
    attrs: d.attrs,
    city: d.city,
    district: d.district,
    neighborhood: d.neighborhood,
    phone: d.phone,
  });
}

export default function PostListingScreen() {
  const { id: editId, copyFrom } = useLocalSearchParams<{ id?: string; copyFrom?: string }>();
  const session = useSession();
  const router = useRouter();
  const { c } = useTheme();
  if (session.status !== 'signedIn') {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <TopBar title="İlan ver" onClose={() => router.back()} />
        <EmptyState
          icon={LayoutGrid}
          title="İlan vermek için giriş yapın"
          message="İlan vermek ücretsizdir. Hesabınız yoksa birkaç saniyede oluşturabilirsiniz."
          action={<Button title="Giriş yap / Üye ol" onPress={() => router.push('/giris')} />}
        />
      </View>
    );
  }
  return <PostForm key={editId ?? (copyFrom ? `copy-${copyFrom}` : 'new')} editId={editId} copyFrom={editId ? undefined : copyFrom} owner={session.user.id} />;
}

function PostForm({ editId, copyFrom, owner }: { editId?: string; copyFrom?: string; owner: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = useMe();
  const copyAndQualityOn = useFlag('benzer_ilan_ver');
  const damageOn = useFlag('arac_hasar_semasi');
  const [draft, setDraft] = useState<Draft>(() => (editId ? emptyDraft : { ...emptyDraft, clientKey: Crypto.randomUUID() }));
  const currency: Currency = draft.currency === 'USD' || draft.currency === 'EUR' ? draft.currency : 'TRY';
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [offeredDraft, setOfferedDraft] = useState<{ draft: Draft; savedAt: number } | null>(null);
  const [step, setStep] = useState<StepKey>('category');
  const [maxReachedIdx, setMaxReachedIdx] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(!(editId || (copyFrom && copyAndQualityOn)));
  // New listing: nothing is saved until the "continue the draft?" question is answered,
  // or the empty form would overwrite the draft while the question is open.
  const [hydrated, setHydrated] = useState(!!editId);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<'city' | 'district' | 'neighborhood' | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [stickyLetters, setStickyLetters] = useState<string[]>([]);
  const jumpToLetterRef = useRef<((letter: string) => void) | null>(null);
  /** Photos just picked, shown full screen before anything uploads. */
  const [review, setReview] = useState<PickedPhoto[] | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const originalImages = useRef<string[]>([]);
  const editStoreIdRef = useRef<string | null | undefined>(undefined);
  const [editInitialContent, setEditInitialContent] = useState<{
    title: string;
    description: string;
    categoryId: string;
    images: string[];
    attrsJson: string;
  } | null>(null);
  const initialEditSnapshot = useRef<string | null>(null);
  /** Running uploads, so removing a photo stops its upload. */
  const uploadsInFlight = useRef(new Map<string, AbortController>());
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const prefilled = useRef(false);
  const copiedRef = useRef(false);

  const leaf = draft.path[draft.path.length - 1];
  const isVehicleCategory = useMemo(() => isDamageVehicleCategory(draft.path), [draft.path]);
  const placeholders = useMemo(() => getCategoryPlaceholders(draft.path), [draft.path]);
  const attrsQuery = useQuery({
    queryKey: keys.attributes(leaf?.id ?? ''),
    queryFn: () => catalog.attributes(leaf?.id ?? ''),
    enabled: !!leaf && leaf.has_children === false,
    staleTime: 10 * 60_000,
  });
  const attributes = useMemo(() => attrsQuery.data ?? [], [attrsQuery.data]);
  // While loading or after a failure the step stays, so required fields are not skipped silently.
  const showAttributes =
    attributes.length > 0 ||
    (damageOn && isVehicleCategory && leaf?.has_children === false) ||
    (!!leaf && leaf.has_children === false && (attrsQuery.isLoading || attrsQuery.isError));
  const stepContext = { profilePhone: me.data ? !!me.data.profile?.phone : undefined, attributesFailed: attrsQuery.isError && !attrsQuery.data };

  const steps: StepKey[] = useMemo(
    () => ['category', 'photos', 'details', ...(showAttributes ? (['attributes'] as const) : []), 'location', 'preview'],
    [showAttributes],
  );
  const stepIndex = steps.indexOf(step);
  const quality = useMemo(() => computeListingQuality(draft, attributes), [draft, attributes]);

  const setStepAndTrack = useCallback(
    (nextStep: StepKey) => {
      setStep(nextStep);
      const idx = steps.indexOf(nextStep);
      if (idx >= 0) setMaxReachedIdx((prev) => (idx > prev ? idx : prev));
    },
    [steps],
  );

  const editWillReReview = useMemo(() => {
    if (!editId || !editInitialContent) return false;
    const init = editInitialContent;
    const addedPhoto = draft.photos.some((p) => !p.url || !init.images.includes(p.url));
    return (
      init.title !== draft.title.trim() ||
      init.description !== draft.description.trim() ||
      init.categoryId !== (leaf?.id ?? '') ||
      addedPhoto ||
      init.attrsJson !== JSON.stringify(draft.attrs)
    );
  }, [editId, editInitialContent, draft.photos, draft.title, draft.description, draft.attrs, leaf?.id]);

  // Edit: load the listing; copyFrom: prefill new listing; new: offer the saved draft and prefill from the profile.
  useEffect(() => {
    let cancelled = false;
    const isCopy = !editId && Boolean(copyFrom && copyAndQualityOn);
    const sourceId = editId ?? (isCopy ? copyFrom : undefined);
    if (sourceId) {
      if (isCopy && copiedRef.current) return;
      if (isCopy) copiedRef.current = true;
      void (async () => {
        try {
          const r = await myListings.forEdit(sourceId);
          const browse = await catalog.browse(r.path);
          if (cancelled) return;
          originalImages.current = isCopy ? [] : r.listing.images;
          if (editId && r.listing.status === 'REJECTED' && r.listing.rejection_reason) {
            setRejectionReason(r.listing.rejection_reason);
          }
          if (isCopy) setCopiedBanner(true);
          if (editId) {
            editStoreIdRef.current = r.listing.store_id ?? null;
            setEditInitialContent({
              title: r.listing.title,
              description: r.listing.description ?? '',
              categoryId: r.path[r.path.length - 1] ?? r.listing.category_id ?? '',
              images: r.listing.images,
              attrsJson: JSON.stringify(r.listing.attrs ?? {}),
            });
            setMaxReachedIdx(5);
          }
          const hasRealPin =
            r.listing.lat != null &&
            r.listing.lng != null &&
            !isCityCenterFallback(r.listing.city, r.listing.lat, r.listing.lng);
          const cur: Currency = r.listing.currency === 'USD' || r.listing.currency === 'EUR' ? r.listing.currency : 'TRY';
          setDraft((prev) => {
            const nextDraft: Draft = {
              path: browse.pathRows.map((row, i) => (i === browse.pathRows.length - 1 ? { ...row, has_children: false } : row)),
              photos: isCopy ? [] : r.listing.images.map((url) => ({ key: url, url, status: 'done' })),
              title: r.listing.title,
              price: maskThousands(String(Math.round(r.listing.price))),
              currency: cur,
              description: r.listing.description ?? '',
              attrs: r.listing.attrs ?? {},
              city: r.listing.city ?? '',
              district: r.listing.district ?? '',
              neighborhood: r.listing.neighborhood ?? '',
              lat: isCopy ? null : hasRealPin ? r.listing.lat : null,
              lng: isCopy ? null : hasRealPin ? r.listing.lng : null,
              pinLabel:
                !isCopy && hasRealPin
                  ? [r.listing.neighborhood, r.listing.district, r.listing.city].filter(Boolean).join(', ')
                  : undefined,
              phone: isCopy ? prev.phone : (r.phone ? maskPhoneInput(r.phone) : ''),
              clientKey: editId ? undefined : Crypto.randomUUID(),
            };
            if (editId) initialEditSnapshot.current = editSnapshotOf(nextDraft);
            return nextDraft;
          });
          setStep(isCopy ? 'photos' : 'details');
          setHydrated(true);
          setReady(true);
        } catch (e) {
          toast.error(errorMessage(e));
          router.back();
        }
      })();
    } else {
      void (async () => {
        const stored = await loadDraft<Draft>(owner);
        const saved = stored?.draft;
        if (cancelled) return;
        if (!stored || !saved || (!saved.path.length && !saved.title)) {
          setHydrated(true);
          return;
        }
        setOfferedDraft({ draft: saved, savedAt: stored.savedAt });
        setHydrated(true);
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [editId, copyFrom, copyAndQualityOn, owner, router]);

  // A photo taken just before Android closed the app comes back for review.
  useEffect(() => {
    void recoverPickedPhotos().then((photos) => {
      if (photos.length) setReview(photos.slice(0, MAX_PHOTOS));
    });
  }, []);

  useEffect(() => {
    if (editId || prefilled.current || !me.data?.profile) return;
    prefilled.current = true;
    const p = me.data.profile;
    setDraft((d) => ({
      ...d,
      phone: d.phone || (p.phone ? maskPhoneInput(p.phone) : ''),
      city: d.city || p.city || '',
      district: d.district || (d.city ? '' : (p.district ?? '')),
    }));
  }, [editId, me.data]);

  // Keep a draft of new listings so an interrupted post is not lost.
  useEffect(() => {
    if (editId || !ready || !hydrated || offeredDraft) return;
    const t = setTimeout(() => void saveDraft({ ...draft, step }, owner), 600);
    return () => clearTimeout(t);
  }, [draft, step, editId, ready, hydrated, offeredDraft, owner]);

  const resumeOfferedDraft = () => {
    if (!offeredDraft) return;
    const { draft: saved, savedAt } = offeredDraft;
    const { photos, expired } = resumePhotos(saved.photos, savedAt);
    if (expired) toast.info(`${expired} fotoğrafın süresi doldu; lütfen yeniden ekleyin.`);
    const leafPicked = saved.path[saved.path.length - 1]?.has_children === false;
    const validSteps: StepKey[] = ['category', 'photos', 'details', 'attributes', 'location', 'preview'];
    const restoredStep =
      saved.step && validSteps.includes(saved.step) && (leafPicked || saved.step === 'category')
        ? saved.step
        : leafPicked
          ? 'photos'
          : 'category';
    setDraft({
      ...saved,
      currency: saved.currency === 'USD' || saved.currency === 'EUR' ? saved.currency : 'TRY',
      photos,
      clientKey: saved.clientKey ?? Crypto.randomUUID(),
    });
    setMaxReachedIdx(Math.max(0, validSteps.indexOf(restoredStep)));
    setStep(restoredStep);
    setOfferedDraft(null);
  };

  const discardOfferedDraft = () => {
    setOfferedDraft(null);
    void clearDraft();
  };

  const clearNewForm = async () => {
    const ok = await confirm({
      title: 'Form temizlensin mi?',
      message: 'Girdiğiniz başlık, açıklama, fotoğraflar ve taslak silinecek.',
      confirmText: 'Temizle',
      destructive: true,
    });
    if (!ok) return;
    Keyboard.dismiss();
    const p = me.data?.profile;
    setDraft({
      ...emptyDraft,
      phone: p?.phone ? maskPhoneInput(p.phone) : '',
      city: p?.city ?? '',
      district: p?.district ?? '',
      clientKey: Crypto.randomUUID(),
    });
    setFieldErrors({});
    setMaxReachedIdx(0);
    setStep('category');
    void clearDraft();
    toast.info('Form temizlendi.');
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), []);
  /** Photos removed while waiting to upload (the upload loop runs across renders). */
  const removedKeys = useRef(new Set<string>());

  // ─── Photos ───────────────────────────────────────────────────────────────
  const setPhoto = (key: string, patch: Partial<PhotoItem>) =>
    setDraft((d) => ({ ...d, photos: d.photos.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));

  const upload = async (key: string, photo: PickedPhoto) => {
    const controller = new AbortController();
    uploadsInFlight.current.set(key, controller);
    setPhoto(key, { status: 'uploading', error: undefined });
    try {
      const prepared = await preparePhoto(photo);
      const url = await uploads.listingPhoto(prepared, controller.signal);
      if (controller.signal.aborted) {
        // Removed while it was uploading: do not keep it on the server either.
        void uploads.discardListingPhoto(url);
        return;
      }
      setPhoto(key, { status: 'done', url, uploadedAt: Date.now(), source: undefined });
    } catch (e) {
      if (!controller.signal.aborted) setPhoto(key, { status: 'error', error: errorMessage(e) });
    } finally {
      if (uploadsInFlight.current.get(key) === controller) uploadsInFlight.current.delete(key);
    }
  };

  const addPhotos = async (source: 'camera' | 'library') => {
    try {
      const picked = await pickPhotos(source, MAX_PHOTOS - draft.photos.length);
      if (picked.length) setReview(picked);
    } catch (e) {
      toast.error(errorMessage(e, 'Fotoğraf seçilemedi.'));
    }
  };

  /** The person checked the photos and tapped "ekle": now they upload, up to 3 in parallel. */
  const acceptPhotos = async (picked: PickedPhoto[]) => {
    setReview(null);
    const items = picked.map((p, i) => ({ key: `${Date.now()}-${i}`, photo: p }));
    setDraft((d) => ({
      ...d,
      photos: [...d.photos, ...items.map(({ key, photo }) => ({ key, localUri: photo.uri, status: 'uploading' as const, source: photo }))],
    }));
    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const next = items[cursor++];
        if (!next || removedKeys.current.has(next.key)) continue;
        await upload(next.key, next.photo);
      }
    };
    const poolSize = Math.min(UPLOAD_CONCURRENCY, items.length);
    await Promise.all(Array.from({ length: poolSize }, () => worker()));
  };

  const removePhoto = (key: string) => {
    const item = draft.photos.find((p) => p.key === key);
    if (item?.url && !originalImages.current.includes(item.url)) void uploads.discardListingPhoto(item.url);
    uploadsInFlight.current.get(key)?.abort();
    removedKeys.current.add(key);
    setDraft((d) => ({ ...d, photos: d.photos.filter((p) => p.key !== key) }));
  };

  const movePhoto = (key: string, delta: -1 | 1) =>
    setDraft((d) => {
      const i = d.photos.findIndex((p) => p.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.photos.length) return d;
      const photos = [...d.photos];
      [photos[i], photos[j]] = [photos[j], photos[i]];
      return { ...d, photos };
    });

  const makeCover = (key: string) =>
    setDraft((d) => {
      const item = d.photos.find((p) => p.key === key);
      return item ? { ...d, photos: [item, ...d.photos.filter((p) => p.key !== key)] } : d;
    });

  const rotateExistingPhoto = async (key: string) => {
    const item = draft.photos.find((p) => p.key === key);
    if (!item?.source) {
      toast.info('Bu fotoğraf döndürülemiyor.');
      return;
    }
    const prevUrl = item.url;
    try {
      const turned = await rotatePhoto(item.source);
      setPhoto(key, { localUri: turned.uri, source: turned });
      await upload(key, turned);
      if (prevUrl && !originalImages.current.includes(prevUrl)) void uploads.discardListingPhoto(prevUrl);
    } catch (e) {
      toast.error(errorMessage(e, 'Fotoğraf döndürülemedi.'));
    }
  };

  const applyGeoAddress = (
    geoCity?: string | null,
    geoDistrict?: string | null,
    geoNeighborhood?: string | null,
    overwrite = false,
  ) => {
    const matchedCity = matchCityName(geoCity);
    if (!matchedCity) return;
    setDraft((d) => {
      if (!overwrite && d.city) return d;
      const matchedDistrict = matchDistrictName(matchedCity, geoDistrict) ?? '';
      const matchedHood = matchedDistrict ? (matchNeighborhoodName(matchedCity, matchedDistrict, geoNeighborhood) ?? '') : '';
      return { ...d, city: matchedCity, district: matchedDistrict, neighborhood: matchedHood };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.city;
      delete next.district;
      return next;
    });
  };

  const detectCurrentLocation = async () => {
    Keyboard.dismiss();
    setGpsLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        toast.info('Konum izni verilmedi. Haritadan manuel seçebilirsiniz.');
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12_000)),
      ]);
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const res = await geo
        .reverseFull(lat, lng)
        .catch(() => ({ label: 'Mevcut konum', city: null, district: null, neighborhood: null }));
      setDraft((d) => ({ ...d, lat, lng, pinLabel: res.label || 'Mevcut konum' }));
      applyGeoAddress(res.city, res.district, res.neighborhood, true);
      toast.success('Konumunuz haritaya eklendi.');
    } catch {
      toast.error('Konumunuz alınamadı. Haritadan seçebilirsiniz.');
    } finally {
      setGpsLocating(false);
    }
  };

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const collectStepErrors = (targetStep: StepKey): string | null => {
    const errs: Record<string, string> = {};
    if (targetStep === 'details') {
      if (draft.title.trim().length < 5) errs.title = 'Başlık en az 5 karakter olmalı.';
      const p = parseMasked(draft.price) ?? 0;
      if (p < 1) errs.price = 'Geçerli bir fiyat girin.';
      else if (p > 1_000_000_000) errs.price = 'Fiyat en fazla 1 milyar olabilir.';
      if (draft.description.trim().length < 10) errs.description = 'Açıklama en az 10 karakter olmalı.';
      setFieldErrors((prev) => ({
        ...Object.fromEntries(Object.entries(prev).filter(([k]) => !['title', 'price', 'description'].includes(k))),
        ...errs,
      }));
    } else if (targetStep === 'attributes') {
      for (const a of attributes) {
        if (a.required && (draft.attrs[a.name] === undefined || draft.attrs[a.name] === '')) {
          errs[`attr:${a.name}`] = `“${a.name}” alanını doldurun.`;
        }
      }
      const maxYear = new Date().getFullYear() + 1;
      for (const yk of ['Yıl', 'Model Yılı'] as const) {
        const y = draft.attrs[yk];
        if (y !== undefined && y !== '' && (Number(y) < 1950 || Number(y) > maxYear)) {
          errs[`attr:${yk}`] = `${yk} 1950 ile ${maxYear} arasında olmalı.`;
        }
      }
      setFieldErrors((prev) => ({
        ...Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('attr:'))),
        ...errs,
      }));
    } else if (targetStep === 'location') {
      if (!draft.city) errs.city = 'İl seçin.';
      if (!draft.district) errs.district = 'İlçe seçin.';
      const phone = cleanPhone(draft.phone);
      if (phone && !/^05\d{9}$/.test(phone)) errs.phone = 'Telefon 05xx xxx xx xx biçiminde olmalı.';
      else if (!phone && stepContext.profilePhone === false) errs.phone = 'İlan vermek için telefon numarası yazın.';
      setFieldErrors((prev) => ({
        ...Object.fromEntries(Object.entries(prev).filter(([k]) => !['city', 'district', 'phone'].includes(k))),
        ...errs,
      }));
    }
    return stepError(targetStep, draft, attributes, stepContext);
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  const goTo = (nextStep: StepKey) => {
    Keyboard.dismiss();
    setStepAndTrack(nextStep);
  };

  const next = () => {
    Keyboard.dismiss();
    const problem = collectStepErrors(step);
    if (problem) {
      toast.error(problem);
      return;
    }
    const following = steps[stepIndex + 1];
    if (following) setStepAndTrack(following);
  };

  const back = () => {
    Keyboard.dismiss();
    if (step === 'category' && draft.path.length) {
      update({ path: draft.path.slice(0, -1) });
      return;
    }
    const prev = steps[stepIndex - 1];
    if (prev) setStepAndTrack(prev);
    else void close();
  };

  const close = async () => {
    if (busy) return;
    if (editId && initialEditSnapshot.current !== null && editSnapshotOf(draft) !== initialEditSnapshot.current) {
      const ok = await confirm({ title: 'Değişiklikler kaydedilmeyecek', message: 'Düzenlemeden çıkılsın mı?', confirmText: 'Çık', destructive: true });
      if (!ok) return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Android back: one step back, like the "Geri" button, and the edit warning at the start.
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const publish = async () => {
    for (const s of steps) {
      const problem = stepError(s, draft, attributes, stepContext);
      if (problem) {
        setStep(s);
        toast.error(problem);
        return;
      }
    }
    if (!leaf) return;
    setBusy(true);
    try {
      // Without the profile, storeId would be empty and the listing would leave its store.
      const meData = me.data ?? (await queryClient.fetchQuery({ queryKey: keys.me, queryFn: account.me }));
      const result = await myListings.save({
        id: editId,
        categoryId: leaf.id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        price: parseMasked(draft.price) ?? 0,
        currency,
        city: draft.city,
        district: draft.district,
        neighborhood: draft.neighborhood || undefined,
        lat: draft.lat ?? null,
        lng: draft.lng ?? null,
        phone: cleanPhone(draft.phone) || undefined,
        images: draft.photos.flatMap((p) => (p.url ? [p.url] : [])),
        attrs: Object.fromEntries(Object.entries(draft.attrs).filter(([, v]) => v !== undefined && v !== '')),
        storeId: editId ? (editStoreIdRef.current ?? undefined) : meData?.store?.id,
        clientKey: editId ? undefined : draft.clientKey,
      });
      if (!editId) await clearDraft();
      void queryClient.invalidateQueries({ queryKey: keys.myListings });
      void queryClient.invalidateQueries({ queryKey: keys.me });
      void queryClient.invalidateQueries({ queryKey: ['listing'] });
      toast.success(
        result.status === 'ACTIVE'
          ? editId
            ? 'İlan güncellendi'
            : 'İlanınız yayında!'
          : result.status === 'PENDING'
            ? 'İlanınız onaya gönderildi. Onaylanınca bildirim alacaksınız.'
            : 'Değişiklikler kaydedildi. İlan yayında değil; İlanlarım’dan yayına alabilirsiniz.',
      );
      router.replace({ pathname: '/ilan/[id]', params: { id: result.id } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <TopBar title="İlanı düzenle" onClose={() => router.back()} />
        <Loading label="İlan yükleniyor…" />
      </View>
    );
  }

  const cityData = TURKEY_CITIES.find((x) => x.name === draft.city);
  const hoods = (draft.city && draft.district && NEIGHBORHOODS[draft.city]?.[draft.district]) || [];
  const isLast = step === 'preview';

  const hasClearableContent = Boolean(!editId && !offeredDraft && (draft.path.length || draft.title || draft.description || draft.price || draft.photos.length || draft.lat != null));

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <TopBar
        title={editId ? 'İlanı düzenle' : 'Ücretsiz ilan ver'}
        onClose={() => void close()}
        right={
          hasClearableContent ? (
            <IconButton icon={Trash2} label="Formu temizle" onPress={() => void clearNewForm()} />
          ) : undefined
        }
      />
      <View style={[styles.progressWrap, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.progressText}>
          <Text variant="label">{STEP_TITLES[step]}</Text>
          <Text variant="caption" tone="subtle">
            Adım {stepIndex + 1} / {steps.length}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: c.elevated }]}>
          <View style={[styles.bar, { backgroundColor: c.primary, width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepPills}>
          {steps.map((s, i) => {
            const done = i < stepIndex;
            const current = s === step;
            const canPick = !current && (Boolean(editId) || i <= maxReachedIdx || done);
            return (
              <Pressable
                key={s}
                accessibilityRole="button"
                disabled={!canPick || busy}
                onPress={() => canPick && !busy && goTo(s)}
                style={[
                  styles.stepPill,
                  current
                    ? { backgroundColor: c.primarySoft, borderColor: c.primary }
                    : done || canPick
                      ? { backgroundColor: c.surface, borderColor: c.borderStrong }
                      : { backgroundColor: c.elevated, borderColor: c.border },
                ]}
              >
                {done ? <Check size={12} color={c.primary} /> : null}
                <Text
                  variant="small"
                  style={{
                    fontWeight: current || canPick ? '600' : '500',
                    color: current ? c.primary : canPick ? c.fg : c.subtle,
                  }}
                >
                  {STEP_TITLES[s]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {step === 'category' && stickyLetters.length > 0 ? (
        <View style={[styles.stickyLetterWrap, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.letterBar}>
            {stickyLetters.map((letter) => (
              <Pressable
                key={letter}
                accessibilityRole="button"
                accessibilityLabel={`${letter} harfine git`}
                onPress={() => {
                  Keyboard.dismiss();
                  jumpToLetterRef.current?.(letter);
                }}
                style={[styles.letterBtn, { backgroundColor: c.elevated }]}
              >
                <Text variant="small" style={styles.letterBtnText}>
                  {letter}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={90}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {offeredDraft ? (
          <Card style={[styles.draftBanner, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
            <Text variant="label">
              Yarım kalan bir ilanınız var
              {offeredDraft.draft.title ? `: “${offeredDraft.draft.title}”` : offeredDraft.draft.path.length ? `: “${offeredDraft.draft.path.map((p) => p.name).join(' › ')}”` : '.'}
            </Text>
            <View style={styles.draftBannerActions}>
              <Button title="Devam et" size="sm" onPress={resumeOfferedDraft} />
              <Button title="Yeni başla" size="sm" variant="ghost" onPress={discardOfferedDraft} />
            </View>
          </Card>
        ) : null}
        {rejectionReason ? (
          <Card style={[styles.rejectBanner, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
            <View style={styles.rejectHead}>
              <AlertTriangle size={18} color={c.danger} />
              <Text variant="label" tone="danger">
                İlanınız reddedildi
              </Text>
            </View>
            <Text variant="caption" tone="danger">
              {rejectionReason}
            </Text>
            <Text variant="small" tone="muted">
              Gerekli düzenlemeleri yapıp kaydettiğinizde ilanınız yeniden incelemeye alınır.
            </Text>
          </Card>
        ) : null}

        {copiedBanner ? (
          <Card style={[styles.rejectBanner, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
            <View style={styles.rejectHead}>
              <Sparkles size={16} color={c.primary} />
              <Text variant="label" tone="primary" style={styles.flex}>
                Önceki ilanınızdan kopyalandı
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={8} onPress={() => setCopiedBanner(false)}>
                <X size={16} color={c.primary} />
              </Pressable>
            </View>
            <Text variant="caption" tone="muted">
              Önceki ilanınızdan kopyalandı. Yeni fotoğraflar ekleyip başlık, fiyat ve detayları gözden geçirebilirsiniz.
            </Text>
          </Card>
        ) : null}

        {copyAndQualityOn && step !== 'category' ? <QualityScoreCard score={quality.score} tip={quality.tip} /> : null}

        {step === 'category' ? (
          <CategoryStep
            path={draft.path}
            onPath={(path) => update({ path, attrs: path[path.length - 1]?.id === leaf?.id ? draft.attrs : {} })}
            onLeaf={() => goTo('photos')}
            onJumpY={(y) => scrollRef.current?.scrollTo({ y, animated: true })}
            onLettersChange={(letters, jumper) => {
              setStickyLetters(letters);
              jumpToLetterRef.current = jumper;
            }}
          />
        ) : null}

        {step === 'photos' ? (
          <View style={styles.form}>
            {editId ? (
              <Card style={[styles.warnBanner, { backgroundColor: c.warnSoft, borderColor: c.warn }]}>
                <Info size={16} color={c.warn} />
                <Text variant="caption" style={styles.flex}>
                  Yeni fotoğraf eklemek ilanı tekrar onaya gönderir. Sıralamak ve silmek onay gerektirmez.
                </Text>
              </Card>
            ) : null}
            <PhotoStep
              photos={draft.photos}
              required={needsPhoto(draft)}
              onAdd={(s) => void addPhotos(s)}
              onRemove={removePhoto}
              onRetry={(key) => {
                const photo = draft.photos.find((p) => p.key === key)?.source;
                if (photo) void upload(key, photo);
                else toast.error('Bu fotoğraf tekrar yüklenemiyor; silip yeniden ekleyin.');
              }}
              onRotate={(key) => void rotateExistingPhoto(key)}
              onMove={movePhoto}
              onCover={makeCover}
              onOpen={setViewing}
            />
          </View>
        ) : null}

        {step === 'details' ? (
          <View style={styles.form}>
            <CategorySummary path={draft.path} onChange={() => goTo('category')} />
            {editId ? (
              editWillReReview ? (
                <Card style={[styles.warnBanner, { backgroundColor: c.warnSoft, borderColor: c.warn }]}>
                  <AlertTriangle size={16} color={c.warn} />
                  <Text variant="caption" style={styles.flex}>
                    Başlık, açıklama, kategori, özellik değişti veya yeni fotoğraf eklendi; kaydettiğinizde ilan yeniden onaya gönderilir.
                  </Text>
                </Card>
              ) : (
                <Card style={[styles.warnBanner, { backgroundColor: c.okSoft, borderColor: c.ok }]}>
                  <CheckCircle2 size={16} color={c.ok} />
                  <Text variant="caption" style={styles.flex}>
                    Fiyat, konum veya telefon değişiklikleri onay gerektirmez; kaydettiğiniz anda yayında kalır.
                  </Text>
                </Card>
              )
            ) : null}
            <Input
              label="İlan başlığı"
              required
              placeholder={placeholders.title}
              error={fieldErrors.title}
              value={draft.title}
              onChangeText={(t) => {
                clearFieldError('title');
                update({ title: t.slice(0, 100) });
              }}
              maxLength={100}
              hint={`${draft.title.length}/100 · Marka, model ve en önemli özelliği yazın.`}
            />
            <View style={styles.priceRow}>
              <View style={styles.priceInputWrap}>
                <Input
                  label="Fiyat"
                  required
                  keyboardType="number-pad"
                  placeholder="0"
                  error={fieldErrors.price}
                  value={draft.price}
                  onChangeText={(t) => {
                    clearFieldError('price');
                    update({ price: maskThousands(t) });
                  }}
                  suffix={CURRENCY_SUFFIX[currency]}
                  style={styles.price}
                />
              </View>
              <View style={styles.currencyCompactWrap}>
                <Text variant="label" style={styles.currencyLabel}>
                  Birim
                </Text>
                <Segmented value={currency} onChange={(next) => update({ currency: next })} options={CURRENCY_OPTIONS} />
              </View>
            </View>
            <Input
              label="Açıklama"
              required
              multiline
              placeholder={placeholders.description}
              error={fieldErrors.description}
              value={draft.description}
              onChangeText={(t) => {
                clearFieldError('description');
                update({ description: t.slice(0, 5000) });
              }}
              maxLength={5000}
              style={styles.description}
              hint={`${draft.description.length}/5000 · Kusurları dürüstçe yazmak satışı hızlandırır.`}
            />
          </View>
        ) : null}

        {step === 'attributes' ? (
          <View style={styles.form}>
            <Text tone="muted">Alıcılar ilanınızı bu bilgilerle filtreleyerek bulur.</Text>
            {attrsQuery.isLoading ? <ActivityIndicator color={c.primary} /> : null}
            {attrsQuery.isError && !attrsQuery.data ? <ErrorState error={attrsQuery.error} onRetry={() => void attrsQuery.refetch()} compact /> : null}
            {attributes
              .filter((a: AttrDef) => !(damageOn && isVehicleCategory && DAMAGE_MANAGED_KEYS.has(a.name)))
              .map((a: AttrDef) => (
                <AttrField
                  key={a.id}
                  attr={a}
                  value={draft.attrs[a.name]}
                  error={fieldErrors[`attr:${a.name}`]}
                  hint={
                    damageOn && isVehicleCategory && (a.name === 'Boya-Değişen' || a.name === 'Hasar Kaydı')
                      ? 'Aşağıdaki hasar şemasıyla otomatik senkronize edilir.'
                      : undefined
                  }
                  onChange={(v) => {
                    clearFieldError(`attr:${a.name}`);
                    setDraft((d) => {
                      const attrs = { ...d.attrs };
                      if (v === undefined) delete attrs[a.name];
                      else attrs[a.name] = v;
                      return { ...d, attrs };
                    });
                  }}
                />
              ))}
            {damageOn && isVehicleCategory ? (
              <Card style={styles.damageCard}>
                <View style={styles.damageHead}>
                  <CarFront size={18} color={c.primary} />
                  <Text variant="label" style={styles.flex}>
                    Araç Boya / Değişen & Hasar Şeması
                  </Text>
                </View>
                <VehicleDamageSvg
                  value={parseDamageValue(draft.attrs['_damage'])}
                  onChange={(nextDamage) =>
                    setDraft((d) => ({
                      ...d,
                      attrs: syncDamageAttrs(d.attrs, nextDamage, attributes),
                    }))
                  }
                />
              </Card>
            ) : null}
          </View>
        ) : null}

        {step === 'location' ? (
          <View style={styles.form}>
            <View style={styles.gpsRow}>
              <Button
                title={gpsLocating ? 'Konum alınıyor…' : 'Mevcut konumumu kullan'}
                icon={LocateFixed}
                variant="outline"
                size="sm"
                loading={gpsLocating}
                onPress={() => void detectCurrentLocation()}
              />
              {draft.path[0]?.id === 'emlak' ? (
                <Badge label="Ev / Arsa için harita önerilir" tone="primary" />
              ) : null}
            </View>
            <SelectField
              label="İl"
              required
              icon={MapPin}
              placeholder="İl seçin"
              value={draft.city}
              error={fieldErrors.city}
              onPress={() => {
                Keyboard.dismiss();
                setPicker('city');
              }}
            />
            <SelectField
              label="İlçe"
              required
              placeholder={draft.city ? 'İlçe seçin' : 'Önce il seçin'}
              value={draft.district}
              error={fieldErrors.district}
              disabled={!draft.city}
              onPress={() => {
                Keyboard.dismiss();
                setPicker('district');
              }}
            />
            {hoods.length ? (
              <SelectField
                label="Mahalle"
                placeholder="İsteğe bağlı"
                value={draft.neighborhood}
                onPress={() => {
                  Keyboard.dismiss();
                  setPicker('neighborhood');
                }}
              />
            ) : null}

            <Card style={styles.pinCard}>
              <View style={styles.pinCardHead}>
                <MapPin size={18} color={c.primary} />
                <View style={styles.flex}>
                  <Text variant="label">Haritada Konum İşaretle (İsteğe bağlı)</Text>
                  <Text variant="small" tone="muted">
                    İşaretlerseniz ilan detayında il merkezi yerine seçtiğiniz nokta görünür.
                  </Text>
                </View>
              </View>
              {draft.lat != null && draft.lng != null ? (
                <View style={styles.pinPreviewRow}>
                  <MapThumb lat={draft.lat} lng={draft.lng} width={132} height={84} radius={radius.md} />
                  <View style={styles.flex}>
                    <Text variant="caption" numberOfLines={2}>
                      {draft.pinLabel || locationLabel(draft.city, draft.district, draft.neighborhood) || 'Haritada işaretlendi'}
                    </Text>
                    <Text variant="small" tone="subtle">
                      {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.pinCardActions}>
                <Button
                  title={draft.lat != null ? 'Konumu değiştir' : 'Haritada seç'}
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    Keyboard.dismiss();
                    setMapPickerOpen(true);
                  }}
                />
                {draft.lat != null ? (
                  <Button
                    title="Kaldır"
                    size="sm"
                    variant="ghost"
                    onPress={() => update({ lat: null, lng: null, pinLabel: undefined })}
                  />
                ) : null}
              </View>
            </Card>

            <Divider />
            <Input
              label="Telefon"
              icon={Phone}
              keyboardType="phone-pad"
              placeholder="05xx xxx xx xx"
              error={fieldErrors.phone}
              value={draft.phone}
              onChangeText={(t) => {
                clearFieldError('phone');
                update({ phone: maskPhoneInput(t) });
              }}
              hint={
                me.data?.profile?.phone
                  ? 'Boş bırakırsanız profilinizdeki numara kullanılır. Alıcılar “Ara” ile bu numarayı görür.'
                  : 'İlan vermek için telefon gerekli. Alıcılar “Ara” ile bu numarayı görür.'
              }
            />
            {me.data?.store ? (
              <Card style={[styles.storeNote, { backgroundColor: c.primarySoft, borderColor: c.primarySoft }]}>
                <Text variant="caption" tone="primary">
                  İlan “{me.data.store.name}” mağazanız adına yayınlanacak.
                </Text>
              </Card>
            ) : null}
          </View>
        ) : null}

        {step === 'preview' ? (
          <Preview
            draft={draft}
            currency={currency}
            attributes={attributes}
            onEdit={goTo}
            onOpenPhoto={setViewing}
            editing={!!editId}
            damageOn={damageOn}
            isVehicleCategory={isVehicleCategory}
          />
        ) : null}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom + space.sm }]}>
        <Button title="Geri" icon={ChevronLeft} variant="outline" onPress={back} disabled={busy} style={styles.flex} />
        {isLast ? (
          <Button title={editId ? 'Kaydet' : 'Yayınla'} icon={Check} loading={busy} haptic onPress={() => void publish()} style={styles.grow} />
        ) : step === 'category' ? (
          <Button
            title="Devam"
            iconRight={ChevronRight}
            disabled={leaf?.has_children !== false}
            onPress={next}
            style={styles.grow}
          />
        ) : (
          <Button title="Devam" iconRight={ChevronRight} onPress={next} style={styles.grow} />
        )}
      </View>

      <OptionPicker
        visible={picker === 'city'}
        onClose={() => setPicker(null)}
        title="İl seçin"
        value={draft.city}
        onSelect={(v) => {
          clearFieldError('city');
          clearFieldError('district');
          update({ city: v ?? '', district: '', neighborhood: '' });
        }}
      />
      <OptionPicker
        visible={picker === 'district'}
        onClose={() => setPicker(null)}
        title="İlçe seçin"
        options={cityData?.districts ?? []}
        value={draft.district}
        onSelect={(v) => {
          clearFieldError('district');
          update({ district: v ?? '', neighborhood: '' });
        }}
      />
      <OptionPicker
        visible={picker === 'neighborhood'}
        onClose={() => setPicker(null)}
        title="Mahalle seçin"
        options={hoods}
        value={draft.neighborhood}
        allLabel="Belirtmek istemiyorum"
        onSelect={(v) => update({ neighborhood: v ?? '' })}
      />

      <LocationPicker
        visible={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        title="İlan konumu seç"
        subtitle="Haritayı kaydırarak ilanın konumunu işaretleyin"
        confirmLabel="Bu konumu seç"
        footnote=""
        showMineShortcut={false}
        autoLocate={false}
        initialCenter={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng, zoom: 16 } : null}
        initialQuery={draft.lat == null && (draft.district || draft.city) ? [draft.district, draft.city].filter(Boolean).join(', ') : undefined}
        onSend={(label, lat, lng, addr) => {
          update({ lat, lng, pinLabel: label });
          applyGeoAddress(addr?.city, addr?.district, addr?.neighborhood, false);
        }}
      />

      <KeyboardToolbar
        theme={{
          light: { primary: c.primary, disabled: c.subtle, background: c.surface, ripple: c.elevated },
          dark: { primary: c.primary, disabled: c.subtle, background: c.surface, ripple: c.elevated },
        }}
      >
        <KeyboardToolbar.Prev />
        <KeyboardToolbar.Next />
        <KeyboardToolbar.Content />
        <KeyboardToolbar.Done text="Bitti" />
      </KeyboardToolbar>

      <PhotoReview
        photos={review}
        mode="listing"
        max={MAX_PHOTOS - draft.photos.length}
        existing={draft.photos.length}
        onCancel={() => setReview(null)}
        onConfirm={(photos) => void acceptPhotos(photos)}
      />
      <PhotoViewer
        images={draft.photos.map((p) => p.localUri ?? p.url ?? '')}
        start={viewing}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

/**
 * Photos of a resumed draft: uploaded ones the server has dropped by now (24 hours) go,
 * unfinished ones come back as "try again" (their file is kept with the draft).
 */
function resumePhotos(photos: PhotoItem[], savedAt: number): { photos: PhotoItem[]; expired: number } {
  let expired = 0;
  const kept: PhotoItem[] = [];
  for (const p of photos) {
    if (p.status === 'done') {
      if (Date.now() - (p.uploadedAt ?? savedAt) > PHOTO_KEEP_MS) expired++;
      else kept.push(p);
    } else if (p.source) {
      kept.push({ ...p, status: 'error', error: 'Yükleme yarıda kaldı.' });
    }
  }
  return { photos: kept, expired };
}

function TopBar({ title, onClose, right }: { title: string; onClose: () => void; right?: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.top, { paddingTop: insets.top + space.xs, backgroundColor: c.surface }]}>
      <IconButton icon={X} label="Kapat" onPress={onClose} />
      <Text variant="subheading" style={styles.flex} center>
        {title}
      </Text>
      {right ?? <View style={styles.topSpacer} />}
    </View>
  );
}

/** Inline drill-down + global category path search. */
function CategoryStep({
  path,
  onPath,
  onLeaf,
  onJumpY,
  onLettersChange,
}: {
  path: Category[];
  onPath: (path: Category[]) => void;
  onLeaf: () => void;
  onJumpY: (y: number) => void;
  onLettersChange: (letters: string[], jumper: ((letter: string) => void) | null) => void;
}) {
  const { c, dark } = useTheme();
  const leafPicked = path.length > 0 && path[path.length - 1]?.has_children === false;
  const browsePath = (leafPicked ? path.slice(0, -1) : path).map((p) => p.id);
  const browseKey = browsePath.join('/');
  const [search, setSearch] = useState({ key: browseKey, text: '' });
  const [globalQ, setGlobalQ] = useState('');
  const [globalResults, setGlobalResults] = useState<{ path: Category[]; leaf: Category }[]>([]);
  const [globalBusy, setGlobalBusy] = useState(false);
  const query = search.key === browseKey ? search.text : '';
  const setQuery = (text: string) => setSearch({ key: browseKey, text });
  const level = useQuery({ queryKey: keys.browse(browsePath), queryFn: () => catalog.browse(browsePath), placeholderData: (p) => p });
  const children = useMemo(() => sortedCats(level.data?.children ?? []), [level.data?.children]);
  const counts = level.data?.counts ?? {};
  const listOffsetY = useRef(0);
  const sectionOffsets = useRef<Record<string, number>>({});

  useEffect(() => {
    sectionOffsets.current = {};
  }, [browseKey]);

  useEffect(() => {
    const term = globalQ.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setGlobalBusy(true);
      void catalog
        .searchCategoryPaths(term)
        .then((rows) => {
          if (!cancelled) setGlobalResults(rows);
        })
        .catch(() => {
          if (!cancelled) setGlobalResults([]);
        })
        .finally(() => {
          if (!cancelled) setGlobalBusy(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [globalQ]);

  const searching = query.trim().length > 0;
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return children;
    return children.filter((cat) => cat.name.toLocaleLowerCase('tr').includes(q));
  }, [children, query]);

  const useLetters = !searching && shown.length >= 18;
  const groups = useMemo(() => {
    if (!useLetters) return [{ letter: '', items: shown }];
    const map = new Map<string, Category[]>();
    for (const cat of shown) {
      const letter = firstLetter(cat.name);
      const arr = map.get(letter) ?? [];
      arr.push(cat);
      map.set(letter, arr);
    }
    return [...map.keys()].sort(sortLetters).map((letter) => ({ letter, items: map.get(letter) ?? [] }));
  }, [shown, useLetters]);
  const letters = useMemo(() => groups.map((g) => g.letter).filter(Boolean), [groups]);

  useEffect(() => {
    if (!level.isLoading && useLetters && letters.length > 0) {
      onLettersChange(letters, (letter) => {
        const secY = sectionOffsets.current[letter];
        if (secY !== undefined) onJumpY(Math.max(0, listOffsetY.current + secY - 8));
      });
    } else {
      onLettersChange([], null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.isLoading, useLetters, letters]);

  const popular = useMemo(() => {
    if (searching) return [];
    return children.filter((cat) => POPULAR_NAMES.has(cat.name)).slice(0, 10);
  }, [children, searching]);

  const pickCategory = (cat: Category) => {
    const base = leafPicked ? path.slice(0, -1) : path;
    const nextPath = [...base, cat];
    onPath(nextPath);
    if (cat.has_children === false) onLeaf();
  };

  return (
    <View style={styles.form}>
      <Text tone="muted">Hızlı arama yapın veya ana kategoriden en alt türe kadar inin.</Text>

      <View style={styles.globalSearchWrap}>
        <Input
          icon={Search}
          placeholder="Tüm kategorilerde hızlı ara (ör. iPhone 15, Clio)"
          value={globalQ}
          onChangeText={(text) => {
            setGlobalQ(text);
            if (text.trim().length < 2) {
              setGlobalResults([]);
              setGlobalBusy(false);
            }
          }}
          right={
            globalBusy ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : globalQ ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" hitSlop={8} onPress={() => setGlobalQ('')}>
                <X size={16} color={c.subtle} />
              </Pressable>
            ) : undefined
          }
        />
        {globalQ.trim().length >= 2 && (globalResults.length > 0 || !globalBusy) ? (
          <View style={[styles.globalResultsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            {globalResults.length === 0 ? (
              <Text variant="caption" tone="muted" style={styles.emptyCat}>
                “{globalQ.trim()}” için kategori bulunamadı.
              </Text>
            ) : (
              globalResults.map((hit, idx) => (
                <View key={hit.leaf.id}>
                  {idx > 0 ? <Divider inset={space.md} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      Keyboard.dismiss();
                      const normalized = hit.path.map((p, i) => ({
                        ...p,
                        has_children: i < hit.path.length - 1 ? true : hit.leaf.has_children,
                      }));
                      onPath(normalized);
                      setGlobalQ('');
                      setGlobalResults([]);
                      if (hit.leaf.has_children === false) onLeaf();
                    }}
                    style={({ pressed }) => [styles.globalResultRow, pressed && { backgroundColor: c.elevated }]}
                  >
                    <View style={styles.flex}>
                      <Text variant="bodyStrong">{hit.leaf.name}</Text>
                      <Text variant="small" tone="muted" numberOfLines={1}>
                        {hit.path.map((p) => p.name).join(' › ')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={c.subtle} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>

      {path.length ? (
        <View style={styles.crumbs}>
          <Pressable
            onPress={() => onPath([])}
            hitSlop={6}
            style={[styles.crumbPill, { borderColor: c.border, backgroundColor: c.surface }]}
          >
            <Text variant="caption" tone="muted">
              Tümü
            </Text>
          </Pressable>
          {path.map((p, i) => {
            const active = i === path.length - 1;
            const isLeafItem = active && p.has_children === false;
            return (
              <View key={p.id} style={styles.crumb}>
                <ChevronRight size={14} color={c.subtle} />
                <Pressable
                  onPress={() => {
                    if (isLeafItem) return;
                    onPath(path.slice(0, i + 1).map((x, j) => (j === i ? { ...x, has_children: true } : x)));
                  }}
                  hitSlop={6}
                  style={[
                    styles.crumbPill,
                    active
                      ? { backgroundColor: c.primarySoft, borderColor: c.primarySoft }
                      : { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <Text variant="caption" style={{ fontWeight: active ? '600' : '500', color: active ? c.primary : c.muted }}>
                    {p.name}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {leafPicked ? (
        <Card style={[styles.picked, { backgroundColor: c.okSoft, borderColor: c.okSoft }]}>
          <Check size={18} color={c.ok} />
          <Text variant="label" tone="ok" style={styles.flex}>
            Kategori seçildi: {path[path.length - 1]?.name}
          </Text>
        </Card>
      ) : null}

      {!level.isLoading && children.length > 8 ? (
        <Input
          icon={Search}
          placeholder="Ara (ör. BMW, Civic, Satılık Daire)"
          value={query}
          onChangeText={setQuery}
          right={
            query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" hitSlop={8} onPress={() => setQuery('')}>
                <X size={16} color={c.subtle} />
              </Pressable>
            ) : undefined
          }
        />
      ) : null}

      {!level.isLoading && popular.length >= 4 ? (
        <View style={styles.popularWrap}>
          <Text variant="small" tone="muted" style={styles.popularLabel}>
            POPÜLER
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll}>
            {popular.map((cat) => (
              <Chip key={cat.id} label={cat.name} selected={false} onPress={() => pickCategory(cat)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {level.isError && !level.data ? (
        <ErrorState error={level.error} onRetry={() => void level.refetch()} compact />
      ) : level.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : (
        <>
          <View
            onLayout={(e) => {
              listOffsetY.current = e.nativeEvent.layout.y;
            }}
            style={[styles.catList, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            {shown.length === 0 ? (
              <Text tone="muted" style={styles.emptyCat}>
                Eşleşen kategori yok.
              </Text>
            ) : (
              groups.map((g, gi) => (
                <View
                  key={g.letter || 'all'}
                  onLayout={(e) => {
                    if (g.letter) sectionOffsets.current[g.letter] = e.nativeEvent.layout.y;
                  }}
                >
                  {g.letter ? (
                    <View
                      style={[
                        styles.letterHead,
                        { backgroundColor: c.elevated, borderColor: c.border, borderTopWidth: gi > 0 ? hairline : 0 },
                      ]}
                    >
                      <Text variant="small" tone="muted" style={styles.letterHeadText}>
                        {g.letter}
                      </Text>
                    </View>
                  ) : null}
                  {g.items.map((cat, i) => {
                    const selected = leafPicked && path[path.length - 1]?.id === cat.id;
                    const { icon: Icon, tint } = categoryIcon(cat.icon, dark);
                    const n = counts[cat.id];
                    return (
                      <View key={cat.id}>
                        {i ? <Divider inset={space.lg} /> : null}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => pickCategory(cat)}
                          style={({ pressed }) => [styles.catRow, pressed && { backgroundColor: c.elevated }]}
                        >
                          {browsePath.length === 0 ? (
                            <View style={[styles.catIcon, { backgroundColor: `${tint}1a` }]}>
                              <Icon size={20} color={tint} />
                            </View>
                          ) : null}
                          <Text variant={selected ? 'bodyStrong' : 'body'} tone={selected ? 'primary' : 'default'} style={styles.flex}>
                            {cat.name}
                          </Text>
                          {n != null && n > 0 ? (
                            <Text variant="caption" tone="muted" style={styles.catCount}>
                              {formatNumber(n)}
                            </Text>
                          ) : null}
                          {selected ? <Check size={18} color={c.primary} /> : cat.has_children !== false ? <ChevronRight size={18} color={c.subtle} /> : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </View>
          <Text variant="small" tone="subtle">
            {shown.length} kategori
          </Text>
        </>
      )}
    </View>
  );
}

function CategorySummary({ path, onChange }: { path: Category[]; onChange: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onChange} style={[styles.summary, { backgroundColor: c.surface, borderColor: c.border }]}>
      <LayoutGrid size={18} color={c.primary} />
      <Text variant="caption" style={styles.flex} numberOfLines={2}>
        {path.map((p) => p.name).join(' › ')}
      </Text>
      <Text variant="label" tone="primary">
        Değiştir
      </Text>
    </Pressable>
  );
}

function Preview({
  draft,
  currency,
  attributes,
  onEdit,
  onOpenPhoto,
  editing,
  damageOn,
  isVehicleCategory,
}: {
  draft: Draft;
  currency: Currency;
  attributes: AttrDef[];
  onEdit: (step: StepKey) => void;
  onOpenPhoto: (index: number) => void;
  editing: boolean;
  damageOn: boolean;
  isVehicleCategory: boolean;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = width - space.lg * 2;
  const [photoIdx, setPhotoIdx] = useState(0);
  const attrRows = attributes.filter((a) => draft.attrs[a.name] !== undefined && draft.attrs[a.name] !== '');
  const showVisualDamage = damageOn && isVehicleCategory && hasDamageData(draft.attrs['_damage']);
  const damageSummaryLine = !showVisualDamage ? summarizeDamageForPreview(draft.attrs['_damage']) : null;
  const attrEntries: { label: string; value: string }[] = [
    ...attrRows.map((a) => ({ label: a.name, value: previewAttrValue(a, draft.attrs[a.name]) })),
    ...(damageSummaryLine ? [{ label: 'Hasar & Tramer', value: damageSummaryLine }] : []),
  ];
  return (
    <View style={styles.form}>
      <Text tone="muted">
        {editing ? 'Kaydetmeden önce bilgileri kontrol edin.' : 'Yayınlamadan önce bilgileri kontrol edin. İlanınızı daha sonra “İlanlarım”dan düzenleyebilirsiniz.'}
      </Text>
      <Card padded={false} style={styles.previewCard}>
        {draft.photos.length ? (
          <View>
            <FlatList
              data={draft.photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              onMomentumScrollEnd={(e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / cardWidth))}
              renderItem={({ item, index: i }) => {
                const uri = item.localUri ?? mediaUrl(item.url, 800);
                return (
                  <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Fotoğraf ${i + 1}, büyüt`} onPress={() => onOpenPhoto(i)}>
                    {uri ? <Image source={uri} style={{ width: cardWidth, aspectRatio: 4 / 3 }} contentFit="cover" /> : null}
                  </Pressable>
                );
              }}
            />
            {draft.photos.length > 1 ? (
              <View style={styles.previewCounter}>
                <Text variant="small" style={styles.previewCounterText}>
                  {photoIdx + 1} / {draft.photos.length}
                </Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => onEdit('photos')}
              style={[styles.previewEditPhotos, { backgroundColor: c.surface }]}
            >
              <Text variant="small" tone="primary" style={styles.previewEditPhotosText}>
                Fotoğrafları düzenle
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.previewBody}>
          <View style={styles.previewPriceRow}>
            <Text variant="title" tone="primary" style={styles.flex}>
              {formatPrice(parseMasked(draft.price) ?? 0, currency)}
            </Text>
            <Pressable onPress={() => onEdit('details')} hitSlop={8}>
              <Text variant="label" tone="primary">
                Düzenle
              </Text>
            </Pressable>
          </View>
          <Text variant="subheading">{draft.title}</Text>
          <Text variant="caption" tone="muted">
            {locationLabel(draft.city, draft.district, draft.neighborhood)} · {draft.photos.length} fotoğraf
          </Text>
        </View>
      </Card>
      {draft.lat != null && draft.lng != null ? (
        <Card style={styles.pinCard}>
          <View style={styles.pinPreviewRow}>
            <MapThumb lat={draft.lat} lng={draft.lng} width={120} height={76} radius={radius.md} />
            <View style={styles.flex}>
              <Text variant="label">Harita konumu işaretlendi</Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {draft.pinLabel || locationLabel(draft.city, draft.district, draft.neighborhood)}
              </Text>
            </View>
            <Pressable onPress={() => onEdit('location')} hitSlop={8}>
              <Text variant="label" tone="primary">
                Düzenle
              </Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
      <PreviewRow label="Kategori" value={draft.path.map((p) => p.name).join(' › ')} onEdit={() => onEdit('category')} />
      <PreviewRow label="Açıklama" value={draft.description} onEdit={() => onEdit('details')} />
      {attrEntries.length ? (
        <Card padded={false} style={styles.attrTableCard}>
          <View style={[styles.attrTableHead, { borderBottomColor: c.border }]}>
            <Text variant="label">Özellikler</Text>
            <Pressable onPress={() => onEdit('attributes')} hitSlop={8}>
              <Text variant="label" tone="primary">
                Düzenle
              </Text>
            </Pressable>
          </View>
          {attrEntries.map((row, idx) => (
            <View
              key={row.label}
              style={[
                styles.attrTableRow,
                idx > 0 && { borderTopWidth: hairline, borderTopColor: c.border },
              ]}
            >
              <Text variant="caption" tone="muted" style={styles.attrTableKey}>
                {row.label}
              </Text>
              <Text variant="label" style={styles.attrTableVal}>
                {row.value}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      {showVisualDamage ? (
        <Card style={styles.damageCard}>
          <View style={styles.damageHead}>
            <CarFront size={18} color={c.primary} />
            <Text variant="label" style={styles.flex}>
              Boya, Değişen ve Tramer
            </Text>
            <Pressable onPress={() => onEdit('attributes')} hitSlop={8}>
              <Text variant="label" tone="primary">
                Düzenle
              </Text>
            </Pressable>
          </View>
          <VehicleDamageSvg readOnly value={parseDamageValue(draft.attrs['_damage'])} />
        </Card>
      ) : null}
      <PreviewRow label="Telefon" value={draft.phone || 'Profil telefonunuz'} onEdit={() => onEdit('location')} />
      <View style={[styles.rules, { backgroundColor: c.elevated }]}>
        <Text variant="caption" tone="muted">
          {editing ? 'Kaydet’e' : 'Yayınla’ya'} dokunarak ilanınızın GeldeSat kullanım koşullarına uygun olduğunu onaylarsınız. Kurallara aykırı ilanlar
          kaldırılır.
        </Text>
      </View>
    </View>
  );
}

function previewAttrValue(attr: AttrDef, value: string | number | undefined): string {
  const raw: unknown = value;
  if (raw === true || raw === 'true') return 'Evet';
  if (raw === false || raw === 'false') return 'Hayır';
  if (attr.type === 'BOOLEAN') {
    if (raw === 1 || raw === 'Evet') return 'Evet';
    if (raw === 0 || raw === 'Hayır') return 'Hayır';
  }
  const isYear = attr.name === 'Yıl' || attr.name === 'Model Yılı';
  const formatted =
    isYear
      ? String(value ?? '')
      : typeof value === 'number' || (attr.type === 'NUMBER' && /^\d+$/.test(String(value ?? '')))
        ? formatNumber(Number(value))
        : String(value ?? '');
  return attr.unit && formatted && !formatted.includes(attr.unit) ? `${formatted} ${attr.unit}` : formatted;
}

function PreviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onEdit} style={[styles.previewRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.flex}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <Text>{value}</Text>
      </View>
      <Text variant="label" tone="primary">
        Düzenle
      </Text>
    </Pressable>
  );
}

function computeListingQuality(draft: Draft, attributes: AttrDef[]): { score: number; tip: string | null } {
  const titleLen = draft.title.trim().length;
  const descLen = draft.description.trim().length;
  const photoCount = draft.photos.filter((p) => p.status === 'done' || p.localUri).length;
  const leaf = draft.path[draft.path.length - 1];
  const isLeaf = Boolean(leaf && leaf.has_children === false);

  const titlePts = titleLen >= 25 ? 20 : titleLen >= 12 ? 12 : titleLen >= 5 ? 6 : 0;
  const descPts = descLen >= 200 ? 25 : descLen >= 80 ? 18 : descLen >= 30 ? 10 : descLen >= 10 ? 5 : 0;
  const photoPts = photoCount >= 5 ? 30 : photoCount >= 3 ? 22 : photoCount >= 1 ? 12 : 0;
  const filledAttrs = attributes.filter((a) => draft.attrs[a.name] !== undefined && draft.attrs[a.name] !== '').length;
  const attrPts = !isLeaf ? 0 : attributes.length === 0 ? 15 : Math.round((15 * filledAttrs) / attributes.length);
  const locPts = draft.city && draft.district && draft.neighborhood ? 10 : draft.city && draft.district ? 6 : 0;
  const score = Math.min(100, titlePts + descPts + photoPts + attrPts + locPts);

  let tip: string | null = null;
  if (photoCount < 3) tip = 'En az 3 net fotoğraf eklemek etkileşimi artırır.';
  else if (descLen < 80) tip = 'Açıklamayı biraz daha detaylandırın.';
  else if (titleLen < 20) tip = 'Başlıkta marka, model veya önemli özellikleri belirtin.';
  else if (attributes.length > 0 && filledAttrs < attributes.length) tip = 'Kalan özellikleri doldurarak aramalarda öne çıkın.';
  else if (!draft.neighborhood && draft.district) tip = 'Mahalle bilgisi ekleyerek konumu netleştirin.';

  return { score, tip };
}

function QualityScoreCard({ score, tip }: { score: number; tip: string | null }) {
  const { c } = useTheme();
  const tone = score >= 80 ? 'ok' : score >= 50 ? 'primary' : 'warn';
  const color = tone === 'ok' ? c.ok : tone === 'primary' ? c.primary : c.warn;
  return (
    <Card style={styles.qualityCard}>
      <View style={styles.qualityHead}>
        <Sparkles size={16} color={color} />
        <Text variant="label" style={styles.flex}>
          İlan Kalite Puanı
        </Text>
        <Badge label={`${score} / 100`} tone={tone} />
      </View>
      <View style={[styles.qualityTrack, { backgroundColor: c.elevated }]}>
        <View style={[styles.qualityBar, { backgroundColor: color, width: `${score}%` }]} />
      </View>
      {tip ? (
        <Text variant="caption" tone="muted">
          İpucu: {tip}
        </Text>
      ) : (
        <Text variant="caption" tone="ok">
          Harika! İlanınız tüm önemli bilgileri içeriyor.
        </Text>
      )}
    </Card>
  );
}

const DAMAGE_MANAGED_KEYS = new Set(['_damage']);

function summarizeDamageForPreview(raw: string | number | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const parsed = parseDamageValue(raw);
  const counts = summarizeDamage(parsed);
  const parts: string[] = [];
  if (counts.degisen) parts.push(`${counts.degisen} Değişen`);
  if (counts.boyali) parts.push(`${counts.boyali} Boyalı`);
  if (counts.lokal) parts.push(`${counts.lokal} Lokal`);
  if (!parts.length && parsed.tramer === null) return null;
  if (!parts.length) parts.push('Boyasız / Değişensiz');
  if (parsed.tramer !== null) parts.push(`Tramer: ${parsed.tramer === 0 ? 'Yok' : formatPrice(parsed.tramer, 'TRY')}`);
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 2 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, paddingBottom: space.xs },
  topSpacer: { width: 40 },
  progressWrap: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm, borderBottomWidth: hairline },
  progressText: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
  stepPills: { gap: 6, paddingTop: 2 },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  content: { padding: space.lg, paddingBottom: space.xxxl * 2, gap: space.lg },
  draftBanner: { gap: space.sm, borderWidth: 1, padding: space.md },
  draftBannerActions: { flexDirection: 'row', gap: space.sm },
  rejectBanner: { gap: space.xs, borderWidth: 1 },
  warnBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, borderWidth: 1, padding: space.md },
  rejectHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  qualityCard: { gap: space.sm, padding: space.md },
  qualityHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  qualityTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  qualityBar: { height: 6, borderRadius: 3 },
  stickyLetterWrap: { paddingHorizontal: space.lg, paddingVertical: space.xs, borderBottomWidth: hairline },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  priceInputWrap: { flex: 1 },
  currencyCompactWrap: { gap: space.xs + 2, minWidth: 168 },
  currencyWrap: { gap: space.xs + 2 },
  currencyLabel: { marginLeft: 2 },
  gpsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  pinCard: { gap: space.sm, padding: space.md },
  pinCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  pinPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pinCardActions: { flexDirection: 'row', gap: space.sm },
  globalSearchWrap: { gap: space.xs },
  globalResultsCard: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  globalResultRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md },
  previewPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  damageCard: { gap: space.md },
  damageHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  form: { gap: space.lg },
  price: { fontSize: 20, fontWeight: '700' },
  description: { minHeight: 160 },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  crumbPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  loading: { padding: space.xxl },
  catList: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  emptyCat: { padding: space.lg, textAlign: 'center' },
  popularWrap: { gap: space.xs },
  popularLabel: { fontWeight: '700', letterSpacing: 0.6 },
  popularScroll: { gap: space.xs + 2 },
  letterBar: { gap: 4, paddingVertical: 2 },
  letterBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterBtnText: { fontWeight: '700' },
  letterHead: { paddingHorizontal: space.lg, paddingVertical: 6, borderBottomWidth: hairline },
  letterHeadText: { fontWeight: '700', letterSpacing: 0.6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 54 },
  catIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  catCount: { fontVariant: ['tabular-nums'] },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: hairline },
  storeNote: { padding: space.md },
  previewCard: { overflow: 'hidden' },
  previewCounter: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    backgroundColor: 'rgba(13,17,23,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  previewCounterText: { color: '#fff', fontWeight: '600' },
  previewEditPhotos: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewEditPhotosText: { fontWeight: '600' },
  previewBody: { padding: space.lg, gap: space.xs },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: hairline },
  attrTableCard: { overflow: 'hidden' },
  attrTableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: hairline,
  },
  attrTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  attrTableKey: { flex: 1 },
  attrTableVal: { textAlign: 'right', flexShrink: 1 },
  rules: { padding: space.md, borderRadius: radius.md },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: hairline },
});
