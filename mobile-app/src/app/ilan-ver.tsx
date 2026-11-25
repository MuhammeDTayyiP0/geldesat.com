import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CarFront, Check, ChevronLeft, ChevronRight, LayoutGrid, MapPin, Phone, Sparkles, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, catalog, myListings, uploads } from '@/api/endpoints';
import { keys, queryClient, useMe } from '@/api/queries';
import type { AttrDef, Category } from '@/api/types';
import { useSession } from '@/auth/session';
import { NEIGHBORHOODS } from '@/data/neighborhoods';
import { TURKEY_CITIES } from '@/data/locations';
import { categoryIcon } from '@/features/catalog/categoryIcon';
import { OptionPicker } from '@/features/location/OptionPicker';
import { AttrField } from '@/features/post/AttrField';
import {
  VehicleDamageSvg,
  parseDamageValue,
  summarizeDamage,
  syncDamageAttrs,
} from '@/features/listing/VehicleDamageSvg';
import { PhotoReview } from '@/features/photos/PhotoReview';
import { PhotoViewer } from '@/features/listing/Gallery';
import { PhotoStep } from '@/features/post/PhotoStep';
import { MAX_PHOTOS, PHOTO_KEEP_MS, STEP_TITLES, emptyDraft, needsPhoto, stepError, type Draft, type PhotoItem, type StepKey } from '@/features/post/draft';
import { mediaUrl } from '@/lib/config';
import { useFlag } from '@/lib/flags';
import { cleanPhone, formatNumber, formatPrice, locationLabel, maskPhoneInput, maskThousands, parseMasked } from '@/lib/format';
import { pickPhotos, preparePhoto, recoverPickedPhotos, type PickedPhoto } from '@/lib/photos';
import { clearDraft, loadDraft, saveDraft } from '@/lib/storage';
import { Badge, Button, Card, Divider, EmptyState, ErrorState, IconButton, Input, Loading, Segmented, SelectField, Text, confirm, hairline, radius, space, toast, useTheme } from '@/ui';
import { Image } from 'expo-image';

type Currency = 'TRY' | 'USD' | 'EUR';
const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'TRY', label: '₺ TRY' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
];
const CURRENCY_SUFFIX: Record<Currency, string> = { TRY: '₺', USD: '$', EUR: '€' };

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
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [step, setStep] = useState<StepKey>('category');
  const [ready, setReady] = useState(!(editId || (copyFrom && copyAndQualityOn)));
  // New listing: nothing is saved until the "continue the draft?" question is answered,
  // or the empty form would overwrite the draft while the question is open.
  const [hydrated, setHydrated] = useState(!!editId);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<'city' | 'district' | 'neighborhood' | null>(null);
  /** Photos just picked, shown full screen before anything uploads. */
  const [review, setReview] = useState<PickedPhoto[] | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const originalImages = useRef<string[]>([]);
  /** Running uploads, so removing a photo stops its upload. */
  const uploadsInFlight = useRef(new Map<string, AbortController>());
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const prefilled = useRef(false);
  const copiedRef = useRef(false);

  const leaf = draft.path[draft.path.length - 1];
  const isVehicleCategory = useMemo(
    () =>
      draft.path.some(
        (p) =>
          p.id === 'vasita' ||
          p.slug === 'vasita' ||
          p.slug === 'otomobil' ||
          p.name.toLocaleLowerCase('tr').includes('vasıta') ||
          p.name.toLocaleLowerCase('tr').includes('otomobil'),
      ),
    [draft.path],
  );
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
          const cur: Currency = r.listing.currency === 'USD' || r.listing.currency === 'EUR' ? r.listing.currency : 'TRY';
          setCurrency(cur);
          setDraft((prev) => ({
            path: browse.pathRows.map((row, i) => (i === browse.pathRows.length - 1 ? { ...row, has_children: false } : row)),
            photos: isCopy ? [] : r.listing.images.map((url) => ({ key: url, url, status: 'done' })),
            title: r.listing.title,
            price: maskThousands(String(Math.round(r.listing.price))),
            description: r.listing.description ?? '',
            attrs: r.listing.attrs ?? {},
            city: r.listing.city ?? '',
            district: r.listing.district ?? '',
            neighborhood: r.listing.neighborhood ?? '',
            phone: isCopy ? prev.phone : (r.phone ? maskPhoneInput(r.phone) : ''),
            clientKey: editId ? undefined : Crypto.randomUUID(),
          }));
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
        // A real choice: a tap outside or Android's back button must not delete the draft.
        const resume = await confirm({
          title: 'Kaydedilmiş taslak',
          message: `“${saved.title || saved.path.map((p) => p.name).join(' › ')}” taslağınıza devam etmek ister misiniz?`,
          confirmText: 'Devam et',
          cancelText: 'Sil, yeni başla',
          cancelable: false,
        });
        if (cancelled) return;
        if (resume) {
          const { photos, expired } = resumePhotos(saved.photos, stored.savedAt);
          if (expired) toast.info(`${expired} fotoğrafın süresi doldu; lütfen yeniden ekleyin.`);
          const leafPicked = saved.path[saved.path.length - 1]?.has_children === false;
          setDraft({ ...saved, photos, clientKey: saved.clientKey ?? Crypto.randomUUID() });
          setStep(leafPicked ? 'photos' : 'category');
        } else void clearDraft();
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
    if (editId || !ready || !hydrated) return;
    const t = setTimeout(() => void saveDraft(draft, owner), 600);
    return () => clearTimeout(t);
  }, [draft, editId, ready, hydrated, owner]);

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

  /** The person checked the photos and tapped "ekle": now they upload, in the background. */
  const acceptPhotos = async (picked: PickedPhoto[]) => {
    setReview(null);
    const items = picked.map((p, i) => ({ key: `${Date.now()}-${i}`, photo: p }));
    setDraft((d) => ({
      ...d,
      photos: [...d.photos, ...items.map(({ key, photo }) => ({ key, localUri: photo.uri, status: 'uploading' as const, source: photo }))],
    }));
    for (const { key, photo } of items) {
      // Removed before its turn came: skip it.
      if (removedKeys.current.has(key)) continue;
      await upload(key, photo);
    }
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

  // ─── Navigation ───────────────────────────────────────────────────────────
  const next = () => {
    const problem = stepError(step, draft, attributes, stepContext);
    if (problem) {
      toast.error(problem);
      return;
    }
    const following = steps[stepIndex + 1];
    if (following) setStep(following);
  };

  const back = () => {
    if (step === 'category' && draft.path.length) {
      update({ path: draft.path.slice(0, -1) });
      return;
    }
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
    else void close();
  };

  const close = async () => {
    if (busy) return;
    if (editId) {
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
        phone: cleanPhone(draft.phone) || undefined,
        images: draft.photos.flatMap((p) => (p.url ? [p.url] : [])),
        attrs: Object.fromEntries(Object.entries(draft.attrs).filter(([, v]) => v !== undefined && v !== '')),
        storeId: meData?.store?.id,
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

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <TopBar title={editId ? 'İlanı düzenle' : 'Ücretsiz ilan ver'} onClose={() => void close()} />
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
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={90}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
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

        {step === 'category' ? <CategoryStep path={draft.path} onPath={(path) => update({ path, attrs: path[path.length - 1]?.id === leaf?.id ? draft.attrs : {} })} onLeaf={() => setStep('photos')} /> : null}

        {step === 'photos' ? (
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
            onMove={movePhoto}
            onCover={makeCover}
            onOpen={setViewing}
          />
        ) : null}

        {step === 'details' ? (
          <View style={styles.form}>
            <CategorySummary path={draft.path} onChange={() => setStep('category')} />
            <Input
              label="İlan başlığı"
              required
              placeholder="Örn. Sahibinden temiz 2018 Renault Clio 1.5 dCi"
              value={draft.title}
              onChangeText={(t) => update({ title: t.slice(0, 100) })}
              maxLength={100}
              hint={`${draft.title.length}/100 · Marka, model ve en önemli özelliği yazın.`}
            />
            <View style={styles.currencyWrap}>
              <Text variant="label" style={styles.currencyLabel}>
                Para birimi
              </Text>
              <Segmented value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} />
            </View>
            <Input
              label="Fiyat"
              required
              keyboardType="number-pad"
              placeholder="0"
              value={draft.price}
              onChangeText={(t) => update({ price: maskThousands(t) })}
              suffix={CURRENCY_SUFFIX[currency]}
              style={styles.price}
            />
            <Input
              label="Açıklama"
              required
              multiline
              placeholder="Ürünün durumu, kullanım süresi, varsa kusurları, teslimat bilgisi…"
              value={draft.description}
              onChangeText={(t) => update({ description: t.slice(0, 5000) })}
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
                  onChange={(v) =>
                    setDraft((d) => {
                      const attrs = { ...d.attrs };
                      if (v === undefined) delete attrs[a.name];
                      else attrs[a.name] = v;
                      return { ...d, attrs };
                    })
                  }
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
            <SelectField label="İl" required icon={MapPin} placeholder="İl seçin" value={draft.city} onPress={() => setPicker('city')} />
            <SelectField
              label="İlçe"
              required
              placeholder={draft.city ? 'İlçe seçin' : 'Önce il seçin'}
              value={draft.district}
              disabled={!draft.city}
              onPress={() => setPicker('district')}
            />
            {hoods.length ? (
              <SelectField label="Mahalle" placeholder="İsteğe bağlı" value={draft.neighborhood} onPress={() => setPicker('neighborhood')} />
            ) : null}
            <Divider />
            <Input
              label="Telefon"
              icon={Phone}
              keyboardType="phone-pad"
              placeholder="05xx xxx xx xx"
              value={draft.phone}
              onChangeText={(t) => update({ phone: maskPhoneInput(t) })}
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

        {step === 'preview' ? <Preview draft={draft} currency={currency} attributes={attributes} onEdit={setStep} editing={!!editId} /> : null}
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

      <OptionPicker visible={picker === 'city'} onClose={() => setPicker(null)} title="İl seçin" value={draft.city} onSelect={(v) => update({ city: v ?? '', district: '', neighborhood: '' })} />
      <OptionPicker
        visible={picker === 'district'}
        onClose={() => setPicker(null)}
        title="İlçe seçin"
        options={cityData?.districts ?? []}
        value={draft.district}
        onSelect={(v) => update({ district: v ?? '', neighborhood: '' })}
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

function TopBar({ title, onClose }: { title: string; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.top, { paddingTop: insets.top + space.xs, backgroundColor: c.surface }]}>
      <IconButton icon={X} label="Kapat" onPress={onClose} />
      <Text variant="subheading" style={styles.flex} center>
        {title}
      </Text>
      <View style={styles.topSpacer} />
    </View>
  );
}

/** Inline drill-down: tap through the tree until a leaf is reached. */
function CategoryStep({ path, onPath, onLeaf }: { path: Category[]; onPath: (path: Category[]) => void; onLeaf: () => void }) {
  const { c, dark } = useTheme();
  const leafPicked = path.length > 0 && path[path.length - 1]?.has_children === false;
  const browsePath = (leafPicked ? path.slice(0, -1) : path).map((p) => p.id);
  const level = useQuery({ queryKey: keys.browse(browsePath), queryFn: () => catalog.browse(browsePath), placeholderData: (p) => p });
  const children = level.data?.children ?? [];

  return (
    <View style={styles.form}>
      <Text tone="muted">Ne satıyorsunuz? En alt kategoriye kadar inin; alıcılar ilanınızı filtrelerle bu şekilde bulur.</Text>
      {path.length ? (
        <View style={styles.crumbs}>
          <Pressable onPress={() => onPath([])} hitSlop={6}>
            <Text variant="label" tone="primary">
              Tümü
            </Text>
          </Pressable>
          {path.map((p, i) => (
            <View key={p.id} style={styles.crumb}>
              <ChevronRight size={14} color={c.subtle} />
              <Pressable onPress={() => onPath(path.slice(0, i + 1).map((x, j) => (j === i ? { ...x, has_children: true } : x)))} hitSlop={6}>
                <Text variant="label" tone={i === path.length - 1 ? 'default' : 'primary'}>
                  {p.name}
                </Text>
              </Pressable>
            </View>
          ))}
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

      {level.isError && !level.data ? (
        <ErrorState error={level.error} onRetry={() => void level.refetch()} compact />
      ) : level.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : (
        <View style={[styles.catList, { backgroundColor: c.surface, borderColor: c.border }]}>
          {children.map((cat, i) => {
            const selected = leafPicked && path[path.length - 1]?.id === cat.id;
            const { icon: Icon, tint } = categoryIcon(cat.icon, dark);
            return (
              <View key={cat.id}>
                {i ? <Divider inset={space.lg} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const base = leafPicked ? path.slice(0, -1) : path;
                    const nextPath = [...base, cat];
                    onPath(nextPath);
                    if (cat.has_children === false) onLeaf();
                  }}
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
                  {selected ? <Check size={18} color={c.primary} /> : cat.has_children !== false ? <ChevronRight size={18} color={c.subtle} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
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
  editing,
}: {
  draft: Draft;
  currency: Currency;
  attributes: AttrDef[];
  onEdit: (step: StepKey) => void;
  editing: boolean;
}) {
  const { c } = useTheme();
  const cover = draft.photos[0];
  const coverUri = cover?.localUri ?? mediaUrl(cover?.url, 800);
  const attrRows = attributes.filter((a) => draft.attrs[a.name] !== undefined && draft.attrs[a.name] !== '');
  const damageSummaryLine = summarizeDamageForPreview(draft.attrs['_damage']);
  const allAttrLines = [
    ...attrRows.map((a) => `${a.name}: ${previewAttrValue(a, draft.attrs[a.name])}`),
    ...(damageSummaryLine ? [`Hasar & Tramer: ${damageSummaryLine}`] : []),
  ];
  return (
    <View style={styles.form}>
      <Text tone="muted">
        {editing ? 'Kaydetmeden önce bilgileri kontrol edin.' : 'Yayınlamadan önce bilgileri kontrol edin. İlanınızı daha sonra “İlanlarım”dan düzenleyebilirsiniz.'}
      </Text>
      <Card padded={false} style={styles.previewCard}>
        {coverUri ? <Image source={coverUri} style={styles.previewImage} contentFit="cover" /> : null}
        <View style={styles.previewBody}>
          <Text variant="title" tone="primary">
            {formatPrice(parseMasked(draft.price) ?? 0, currency)}
          </Text>
          <Text variant="subheading">{draft.title}</Text>
          <Text variant="caption" tone="muted">
            {locationLabel(draft.city, draft.district, draft.neighborhood)} · {draft.photos.length} fotoğraf
          </Text>
        </View>
      </Card>
      <PreviewRow label="Kategori" value={draft.path.map((p) => p.name).join(' › ')} onEdit={() => onEdit('category')} />
      <PreviewRow label="Açıklama" value={draft.description} onEdit={() => onEdit('details')} />
      {allAttrLines.length ? (
        <PreviewRow label="Özellikler" value={allAttrLines.join('\n')} onEdit={() => onEdit('attributes')} />
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
  return typeof value === 'number' ? formatNumber(value) : String(value ?? '');
}

function PreviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onEdit} style={[styles.previewRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.flex}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <Text numberOfLines={4}>{value}</Text>
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
  content: { padding: space.lg, paddingBottom: space.xxxl * 2, gap: space.lg },
  rejectBanner: { gap: space.xs, borderWidth: 1 },
  rejectHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  qualityCard: { gap: space.sm, padding: space.md },
  qualityHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  qualityTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  qualityBar: { height: 6, borderRadius: 3 },
  currencyWrap: { gap: space.xs + 2 },
  currencyLabel: { marginLeft: 2 },
  damageCard: { gap: space.md },
  damageHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  form: { gap: space.lg },
  price: { fontSize: 20, fontWeight: '700' },
  description: { minHeight: 160 },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  loading: { padding: space.xxl },
  catList: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 54 },
  catIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: hairline },
  storeNote: { padding: space.md },
  previewCard: { overflow: 'hidden' },
  previewImage: { width: '100%', aspectRatio: 4 / 3 },
  previewBody: { padding: space.lg, gap: space.xs },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: hairline },
  rules: { padding: space.md, borderRadius: radius.md },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: hairline },
});
