import { ErrorState } from "@/components/common/ErrorState";
import { createFileRoute, useNavigate, useBlocker } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { browseCategories } from "@/lib/server/catalog";
import { getCategoryAttrs, getListingForEdit, getMe, saveListing } from "@/lib/server/account";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { NEIGHBORHOODS } from "@/lib/data/geo";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  ImageIcon,
  Lightbulb,
  MapPin,
  Pencil,
  Send,
  Sparkles,
} from "lucide-react";
import { cleanPhone, cn, formatNumber, formatPrice, maskPhone10 } from "@/lib/utils";
import { toast } from "sonner";
import type { AttrDef, CategoryRow } from "@/lib/server/helpers";
import { CategoryButtons } from "@/components/listing/CategoryPicker";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { PhotoUploader, type PhotoOriginal } from "@/components/listing/PhotoUploader";
import { ListingImageGallery } from "@/components/listing/ListingImageGallery";
import {
  VehicleDamageDiagram,
  hasDamageData,
  parseDamageValue,
  serializeDamageValue,
  summarizeDamage,
  type VehicleDamageData,
} from "@/components/listing/VehicleDamageDiagram";
import { photoSrc } from "@/lib/images";
import { useFlag } from "@/lib/use-flag";

const evetHayir = ["Evet", "Hayır"];

function AttrInput({
  a,
  values,
  setValues,
}: {
  a: AttrDef;
  values: Record<string, string | number>;
  setValues: Dispatch<SetStateAction<Record<string, string | number>>>;
}) {
  const isYear = a.type === "NUMBER" && (a.name === "Yıl" || a.name === "Model Yılı");
  const isFormattedNumber = a.type === "NUMBER" && !isYear;
  const rawVal = values[a.name];

  return (
    <div>
      <Label htmlFor={`attr-${a.id}`}>
        {a.name}
        {a.unit ? ` (${a.unit})` : ""}
        {a.required ? " *" : ""}
      </Label>
      {a.type === "SELECT" ? (
        <Select
          id={`attr-${a.id}`}
          required={a.required}
          value={String(rawVal ?? "")}
          onChange={(e) => setValues((v) => ({ ...v, [a.name]: e.target.value }))}
        >
          <option value="">Seçin</option>
          {(a.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : isFormattedNumber ? (
        <Input
          id={`attr-${a.id}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={a.required}
          value={rawVal !== undefined && rawVal !== "" ? formatNumber(rawVal) : ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            setValues((v) => ({ ...v, [a.name]: digits === "" ? "" : Number(digits) }));
          }}
        />
      ) : (
        <Input
          id={`attr-${a.id}`}
          type={a.type === "NUMBER" ? "number" : "text"}
          required={a.required}
          min={isYear ? 1950 : a.type === "NUMBER" ? 0 : undefined}
          max={isYear ? new Date().getFullYear() + 1 : undefined}
          value={String(rawVal ?? "")}
          onChange={(e) =>
            setValues((v) => ({ ...v, [a.name]: a.type === "NUMBER" && e.target.value !== "" ? Number(e.target.value) : e.target.value }))
          }
        />
      )}
    </div>
  );
}

type Currency = "TRY" | "USD" | "EUR";

function normalizeCurrency(raw: unknown): Currency {
  return raw === "USD" || raw === "EUR" ? raw : "TRY";
}

function computeQualityScore(input: {
  title: string;
  description: string;
  imagesCount: number;
  attrs: AttrDef[];
  values: Record<string, string | number>;
  leaf: boolean;
  city: string;
  district: string;
  neighborhood: string;
}): { score: number; hint: string } {
  const titleLen = input.title.trim().length;
  const descLen = input.description.trim().length;
  const titlePts = titleLen >= 25 ? 20 : titleLen >= 12 ? 12 : titleLen >= 5 ? 6 : 0;
  const descPts = descLen >= 200 ? 25 : descLen >= 80 ? 18 : descLen >= 30 ? 10 : descLen >= 10 ? 5 : 0;
  const photoPts = input.imagesCount >= 5 ? 30 : input.imagesCount >= 3 ? 22 : input.imagesCount >= 1 ? 12 : 0;
  const filledAttrs = input.attrs.filter((a) => input.values[a.name] !== undefined && input.values[a.name] !== "").length;
  const attrPts = !input.leaf ? 0 : input.attrs.length === 0 ? 15 : Math.round((15 * filledAttrs) / input.attrs.length);
  const locPts = input.city && input.district && input.neighborhood ? 10 : input.city && input.district ? 6 : 0;
  const score = Math.min(100, titlePts + descPts + photoPts + attrPts + locPts);

  let hint = "Harika! İlanınız alıcılar için çok detaylı görünüyor.";
  if (input.imagesCount < 3) hint = "En az 3 net fotoğraf eklemek etkileşimi artırır.";
  else if (descLen < 80) hint = "Açıklamayı biraz daha detaylandırın.";
  else if (titleLen < 20) hint = "Başlıkta marka, model veya önemli özellikleri belirtin.";
  else if (input.attrs.length > 0 && filledAttrs < input.attrs.length) hint = "Kalan özellikleri doldurarak aramalarda öne çıkın.";
  else if (!input.neighborhood && input.district) hint = "Mahalle bilgisi ekleyerek konumu netleştirin.";

  return { score, hint };
}

type StepKey = "category" | "photos" | "details" | "attributes" | "location" | "preview";

type ListingDraft = {
  path: string[];
  title: string;
  description: string;
  price: string;
  currency?: Currency;
  city: string;
  district: string;
  neighborhood: string;
  phone: string;
  images: string[];
  values: Record<string, string | number>;
  step: StepKey | number;
  savedAt: number;
};

const PHOTO_KEEP_MS = 23 * 60 * 60_000;

export const Route = createFileRoute("/ilan-ver")({
  validateSearch: (s: Record<string, unknown>): { id?: string; copyFrom?: string } => ({
    ...(typeof s.id === "string" && s.id ? { id: s.id } : {}),
    ...(typeof s.copyFrom === "string" && s.copyFrom ? { copyFrom: s.copyFrom } : {}),
  }),
  // Only the root level; deeper levels load as the user drills down.
  loader: () => browseCategories({ data: { path: [] } }),
  head: () => ({
    meta: [
      { title: "Ücretsiz İlan Ver | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PostPage,
});

const STEP_META: Record<StepKey, { label: string; hint: string }> = {
  category: { label: "Kategori", hint: "Ne satıyorsunuz?" },
  photos: { label: "Fotoğraflar", hint: "En fazla 10 fotoğraf" },
  details: { label: "İlan bilgileri", hint: "Başlık, fiyat ve açıklama" },
  attributes: { label: "Özellikler", hint: "Kategoriye özel detaylar" },
  location: { label: "Konum & İletişim", hint: "Adres ve telefon" },
  preview: { label: "Önizleme", hint: "Kontrol edip yayınlayın" },
};

const TIPS: Record<StepKey, string[]> = {
  category: ["En alt kategoriye kadar inin; alıcılar ilanınızı filtrelerle bu şekilde bulur.", "Arama kutusuna marka veya model yazarak hızlıca bulabilirsiniz."],
  photos: [
    "Gün ışığında, ürünün tamamını gösteren fotoğraflar çekin.",
    "Kapak fotoğrafı ilk izlenimdir; en net fotoğrafı kapak yapın.",
    "Fotoğraflar oranları korunarak küçültülür ve filigran eklenir.",
  ],
  details: [
    "Başlıkta marka, model ve en önemli özelliği belirtin.",
    "Açıklamada kusurları da dürüstçe yazın; güven satışı hızlandırır.",
    "Piyasa fiyatına yakın ilanlar daha çok mesaj alır.",
  ],
  attributes: ["Özellikleri eksiksiz doldurmak ilanınızın filtrelerde öne çıkmasını sağlar."],
  location: ["Mahalle bilgisi ekleyerek alıcıların konumu daha net görmesini sağlayın."],
  preview: ["Yayınlamadan önce fiyat ve konumu son kez kontrol edin.", "İlanınızı daha sonra “İlanlarım” sayfasından düzenleyebilirsiniz."],
};

function normalizeDraftStep(raw: StepKey | number | undefined, validSteps: StepKey[]): StepKey {
  if (typeof raw === "number") {
    const legacy: StepKey[] = ["category", "photos", "details", "preview"];
    const mapped = legacy[raw] ?? "category";
    return validSteps.includes(mapped) ? mapped : "category";
  }
  if (raw && validSteps.includes(raw)) return raw;
  return "category";
}

function PostPage() {
  const { id, copyFrom } = Route.useSearch();
  return <PostForm key={id ? `edit:${id}` : copyFrom ? `copy:${copyFrom}` : "new"} />;
}

function PostForm() {
  const benzerIlanAcik = useFlag("benzer_ilan_ver");
  const hasarSemasiAcik = useFlag("arac_hasar_semasi");
  const { user, isPending } = useCurrentUserState();
  const rootLevel = Route.useLoaderData();
  const { id: editId, copyFrom } = Route.useSearch();
  const copyId = !editId && benzerIlanAcik ? copyFrom : undefined;
  const nav = useNavigate();
  const [step, setStep] = useState<StepKey>("category");
  const [path, setPath] = useState<string[]>([]);
  const [attrs, setAttrs] = useState<AttrDef[]>([]);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [phone, setPhone] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeId, setStoreId] = useState<string | undefined>();
  const [storeName, setStoreName] = useState<string | undefined>();
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [levelError, setLevelError] = useState(false);
  const [levelAttempt, setLevelAttempt] = useState(0);
  const [attrsError, setAttrsError] = useState(false);
  const [attrsLoading, setAttrsLoading] = useState(false);
  const [attrAttempt, setAttrAttempt] = useState(0);
  const [profilePhone, setProfilePhone] = useState("");
  const [offeredDraft, setOfferedDraft] = useState<ListingDraft | null>(null);
  const saved = useRef(false);
  const clientKeyRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `w-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
  );
  const [loaded, setLoaded] = useState(!editId && !copyId);
  const keepValuesFor = useRef<string | null>(null);
  const photoOriginals = useRef(new Map<string, PhotoOriginal>());
  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const userId = user?.id;

  const selected = path[path.length - 1];
  const pathKey = path.join("/");
  // The picker level for `path`; `key` says which path it belongs to.
  const [level, setLevel] = useState({ key: "", ...rootLevel });
  // Every category row seen so far, for breadcrumbs while the next level loads.
  const knownCats = useRef(new Map<string, CategoryRow>());
  for (const c of [...level.pathRows, ...level.children]) knownCats.current.set(c.id, c);
  const levelReady = level.key === pathKey;
  const children = levelReady ? level.children : [];
  const currentCats = children;
  const pathRows = path.map((id) => knownCats.current.get(id)).filter(Boolean) as CategoryRow[];
  const selectedRow = selected ? knownCats.current.get(selected) : undefined;
  const leaf = path.length > 0 && (selectedRow?.has_children === false || (levelReady && children.length === 0));
  const cityData = TURKEY_CITIES.find((c) => c.name === city);
  const hoods = (city && district && NEIGHBORHOODS[city]?.[district]) || [];
  const needsPhoto = path[0] === "emlak" || path[0] === "vasita";

  useEffect(() => {
    if (level.key === pathKey || selectedRow?.has_children === false) return;
    let cancelled = false;
    setLevelError(false);
    browseCategories({ data: { path } })
      .then((next) => {
        if (!cancelled) setLevel({ key: pathKey, ...next });
      })
      .catch(() => {
        if (!cancelled) setLevelError(true);
      });
    return () => {
      cancelled = true;
    };
    // `path` is captured through `pathKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, level.key, selectedRow?.has_children, levelAttempt]);

  // Only a final category has a form; moving through its parents must not wipe
  // what was filled in, unless a different category is really chosen.
  useEffect(() => {
    if (!selected || !leaf) {
      setAttrsLoading(false);
      return;
    }
    let cancelled = false;
    setAttrsError(false);
    setAttrsLoading(true);
    getCategoryAttrs({ data: { categoryId: selected } })
      .then((next) => {
        if (!cancelled) {
          setAttrs(next);
          setAttrsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAttrsError(true);
          setAttrsLoading(false);
        }
      });
    if (keepValuesFor.current !== selected) {
      keepValuesFor.current = selected;
      setValues({});
    }
    return () => {
      cancelled = true;
    };
  }, [selected, leaf, attrAttempt]);

  const userProfileLoaded = useRef(false);

  useEffect(() => {
    if (!userId) return;
    void getMe()
      .then((m) => {
        if (m.store) {
          if (!editId) setStoreId(m.store.id);
          setStoreName(m.store.name);
        }
        setProfilePhone(m.profile?.phone ?? "");
        if (!editId && !userProfileLoaded.current) {
          if (m.profile?.phone) setPhone(maskPhone10(m.profile.phone));
          if (m.profile?.city) setCity(m.profile.city);
          userProfileLoaded.current = true;
        }
      })
      .catch(() => undefined);
  }, [userId, editId]);

  useEffect(() => {
    const sourceId = editId ?? copyId;
    if (!sourceId || !userId) return;
    let cancelled = false;
    void getListingForEdit({ data: { id: sourceId } })
      .then((r) => {
        if (cancelled) return;
        keepValuesFor.current = r.path[r.path.length - 1] ?? r.listing.category_id;
        setPath(r.path);
        setTitle(r.listing.title);
        setDescription(r.listing.description);
        setPrice(String(Math.round(Number(r.listing.price))));
        setCurrency(normalizeCurrency(r.listing.currency));
        setCity(r.listing.city ?? "");
        setDistrict(r.listing.district ?? "");
        setNeighborhood(r.listing.neighborhood ?? "");
        setValues(r.listing.attrs ?? {});
        if (r.listing.store_id) setStoreId(r.listing.store_id);
        if (editId) {
          if (r.phone) setPhone(maskPhone10(r.phone));
          setImages(r.listing.images);
          setListingStatus(r.listing.status);
          setRejectionReason(r.listing.rejection_reason ?? null);
        } else {
          setOfferedDraft(null);
          setCopiedBanner(true);
        }
        setStep(editId ? "details" : "photos");
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(errorText(e, "İlan yüklenemedi"));
        if (editId) void nav({ to: "/ilanlarim" });
        else setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, copyId, userId, nav]);

  // Each step starts at the top of the form, not wherever the previous one was scrolled.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Drafts: a new listing survives a refresh or the back button; an edit warns before leaving.
  const draftKey = userId ? `geldesat:ilan-taslak:${userId}` : null;
  const draft: ListingDraft = { path, title, description, price, currency, city, district, neighborhood, phone, images, values, step, savedAt: Date.now() };
  const { savedAt: _savedAt, ...draftFields } = draft;
  const draftJson = JSON.stringify(draftFields);
  const hasContent = Boolean(path.length || title || description || price || images.length);
  const loadedForm = useRef<string | null>(null);
  if (editId && loaded && loadedForm.current === null) loadedForm.current = draftJson;
  const editChanged = Boolean(editId) && loadedForm.current !== null && loadedForm.current !== draftJson;

  useEffect(() => {
    if (editId || copyId || !draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setOfferedDraft(JSON.parse(raw) as ListingDraft);
    } catch {
      // Private mode or a damaged draft: start empty.
    }
  }, [editId, copyId, draftKey]);

  useEffect(() => {
    if (editId || !draftKey || !hasContent || offeredDraft || saved.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ ...JSON.parse(draftJson), savedAt: Date.now() }));
      } catch {
        // Storage is full or blocked; the form still works.
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [editId, draftKey, hasContent, offeredDraft, draftJson]);

  const blocker = useBlocker({
    shouldBlockFn: () => !saved.current,
    withResolver: true,
    disabled: !editChanged,
    enableBeforeUnload: editChanged,
  });

  const location = [neighborhood, district, city].filter(Boolean).join(", ");
  const isVehicleCategory =
    path.includes("vasita") ||
    path.includes("otomobil") ||
    pathRows.some((c) => c.slug === "vasita" || c.slug === "otomobil" || c.name === "Vasıta" || c.name === "Otomobil");
  const showAttributes =
    attrs.length > 0 || (hasarSemasiAcik && isVehicleCategory && leaf) || (Boolean(selected) && leaf && (attrsLoading || attrsError));
  const steps: StepKey[] = ["category", "photos", "details", ...(showAttributes ? (["attributes"] as const) : []), "location", "preview"];

  if (isPending || (user && !loaded)) return <BrandSpinner fullPage text="İlan formu hazırlanıyor…" />;
  if (!user) return <RedirectToSignIn />;

  function goTo(next: StepKey) {
    if (uploading || busy) return;
    setStep(next);
  }

  function detailsStepProblem(): string | null {
    if (title.trim().length < 5) return "İlan başlığı en az 5 karakter olmalı.";
    if (priceNumber < 1) return "Geçerli bir fiyat girin.";
    if (priceNumber > 1_000_000_000) return "Fiyat en fazla 1 milyar olabilir.";
    if (description.trim().length < 10) return "Açıklama en az 10 karakter olmalı.";
    return null;
  }

  function attributesStepProblem(): string | null {
    if (attrsLoading) return "Kategori özellikleri yükleniyor, lütfen bekleyin.";
    if (attrsError) return "Kategori özellikleri yüklenemedi. Sayfadaki “Tekrar dene”ye basın.";
    const missing = attrs.find((a) => a.required && (values[a.name] === undefined || values[a.name] === ""));
    if (missing) return `Zorunlu alan: ${missing.name}`;
    const maxYear = new Date().getFullYear() + 1;
    for (const yearKey of ["Yıl", "Model Yılı"] as const) {
      const y = values[yearKey];
      if (y !== undefined && y !== "" && (Number(y) < 1950 || Number(y) > maxYear)) {
        return `${yearKey} 1950 ile ${maxYear} arasında olmalı.`;
      }
    }
    return null;
  }

  function locationStepProblem(): string | null {
    if (!city || !district) return "İl ve ilçe seçin.";
    const digits = cleanPhone(phone);
    if (!digits && !profilePhone) return "İlan için bir telefon numarası girin.";
    if (digits && !/^0?5\d{9}$/.test(digits)) return "Geçerli bir cep telefonu girin (5xx xxx xx xx).";
    return null;
  }

  async function publish() {
    if (!selected || uploading) return;
    if (needsPhoto && images.length < 1) {
      toast.error("Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.");
      setStep("photos");
      return;
    }
    const detailsErr = detailsStepProblem();
    if (detailsErr) {
      toast.error(detailsErr);
      setStep("details");
      return;
    }
    if (showAttributes) {
      const attrsErr = attributesStepProblem();
      if (attrsErr) {
        toast.error(attrsErr);
        setStep("attributes");
        return;
      }
    }
    const locErr = locationStepProblem();
    if (locErr) {
      toast.error(locErr);
      setStep("location");
      return;
    }
    setBusy(true);
    try {
      const result = await saveListing({
        data: {
          id: editId,
          categoryId: selected,
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          currency,
          city,
          district,
          neighborhood: neighborhood || undefined,
          phone: cleanPhone(phone) || undefined,
          images,
          attrs: values,
          storeId,
          clientKey: editId ? undefined : clientKeyRef.current,
        },
      });
      saved.current = true;
      discardDraft();
      toast.success(
        editId
          ? result.status === "PENDING"
            ? "İlan onaya gönderildi"
            : "İlan güncellendi"
          : result.status === "ACTIVE"
            ? "İlan yayınlandı"
            : "İlan onaya gönderildi",
      );
      void nav({ to: "/ilan/$slug", params: { slug: result.slug } });
    } catch (e) {
      toast.error(errorText(e, "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  }

  const priceNumber = Number(price) || 0;

  function resumeDraft(d: ListingDraft) {
    // The server removes photos not attached to a listing after 24 hours.
    const photosGone = Date.now() - d.savedAt > PHOTO_KEEP_MS;
    keepValuesFor.current = d.path[d.path.length - 1] ?? null;
    setPath(d.path);
    setTitle(d.title);
    setDescription(d.description);
    setPrice(d.price);
    setCurrency(normalizeCurrency(d.currency));
    setCity(d.city);
    setDistrict(d.district);
    setNeighborhood(d.neighborhood);
    setPhone(d.phone);
    setImages(photosGone ? [] : d.images);
    setValues(d.values);
    setStep(normalizeDraftStep(d.step, steps));
    setOfferedDraft(null);
    if (photosGone && d.images.length) toast.warning("Taslaktaki fotoğrafların süresi doldu; lütfen yeniden ekleyin.");
  }

  function discardDraft() {
    setOfferedDraft(null);
    try {
      if (draftKey) localStorage.removeItem(draftKey);
    } catch {
      // Nothing to clean up if storage is blocked.
    }
  }

  const quality = computeQualityScore({
    title,
    description,
    imagesCount: images.length,
    attrs,
    values,
    leaf,
    city,
    district,
    neighborhood,
  });

  function handleDamageChange(nextDamage: VehicleDamageData) {
    const serialized = serializeDamageValue(nextDamage);
    const counts = summarizeDamage(nextDamage);
    setValues((prev) => {
      const next = { ...prev };
      if (serialized) next["_damage"] = serialized;
      else delete next["_damage"];

      const boyaAttr = attrs.find((a) => a.name === "Boya-Değişen");
      if (boyaAttr) {
        const painted = counts.boyali + counts.lokal;
        const val =
          painted > 0 && counts.degisen > 0
            ? "Boyalı + Değişen"
            : counts.degisen > 0
              ? "Değişen"
              : painted > 0
                ? "Boyalı"
                : serialized
                  ? "Tamamı Orijinal"
                  : "";
        if (val && (!boyaAttr.options?.length || boyaAttr.options.includes(val))) {
          next["Boya-Değişen"] = val;
        }
      }

      const hasarAttr = attrs.find((a) => a.name === "Hasar Kaydı");
      if (hasarAttr && nextDamage.tramer !== null) {
        const val = nextDamage.tramer > 0 ? "Var" : "Yok";
        if (!hasarAttr.options?.length || hasarAttr.options.includes(val)) {
          next["Hasar Kaydı"] = val;
        }
      }
      return next;
    });
  }

  return (
    <div ref={topRef} className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-44 pt-4 sm:pt-8 md:pb-16">
      {offeredDraft ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/8 p-3 text-sm">
          <p>
            Yarım kalan bir ilanınız var{offeredDraft.title ? `: “${offeredDraft.title}”` : ""}.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => resumeDraft(offeredDraft)}>
              Devam et
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
              Yeni başla
            </Button>
          </div>
        </div>
      ) : null}
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{editId ? "İlanı düzenle" : "Ücretsiz ilan ver"}</h1>
          <p className="mt-1 text-sm text-muted">
            {editId ? "Değişikliklerinizi yapın ve kaydedin." : `${steps.length} adımda ilanınızı oluşturun, binlerce alıcıya ulaşın.`}
          </p>
        </div>
      </header>

      {editId && listingStatus === "REJECTED" ? (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/8 p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Bu ilan moderasyon tarafından reddedildi</p>
            {rejectionReason ? <p className="mt-0.5 text-danger/90">Reddetme gerekçesi: {rejectionReason}</p> : null}
            <p className="mt-1 text-xs text-muted">Gerekli düzenlemeleri yapıp kaydettiğinizde ilanınız yeniden incelemeye gönderilir.</p>
          </div>
        </div>
      ) : null}

      {copiedBanner ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/8 px-3.5 py-2.5 text-sm text-primary">
          <Copy className="size-4 shrink-0" aria-hidden="true" />
          <span>Mevcut ilandan bilgiler kopyalandı. Fotoğraflarınızı ekleyip yayınlayabilirsiniz.</span>
        </div>
      ) : null}

      <Stepper steps={steps} step={step} onPick={goTo} locked={uploading || busy} />

      {benzerIlanAcik ? (
        <div className="mt-4 rounded-xl border border-border bg-surface p-3 lg:hidden">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" /> İlan Kalite Puanı
            </span>
            <span className="tabular-nums text-primary">{quality.score}/100</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                quality.score >= 80 ? "bg-ok" : quality.score >= 50 ? "bg-primary-solid" : "bg-warn",
              )}
              style={{ width: `${quality.score}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{quality.hint}</p>
        </div>
      ) : null}

      <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          {step === "category" ? (
            <section aria-labelledby="step-category">
              <SectionHeading id="step-category" title="Kategori seçin" hint="Önce ana kategori, sonra marka / model veya alt tür." />
              {pathRows.length > 0 ? (
                <nav aria-label="Seçilen kategori" className="mb-4 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-sm text-muted transition-colors hover:border-primary/40 hover:text-fg"
                    onClick={() => setPath([])}
                  >
                    Tümü
                  </button>
                  {pathRows.map((c, i) => (
                    <span key={c.id} className="flex items-center gap-1.5">
                      <ChevronRight className="size-3.5 text-subtle" />
                      <button
                        type="button"
                        className={cn(
                          "rounded-full px-3 py-1 text-sm transition-colors",
                          i === pathRows.length - 1
                            ? "bg-primary/10 font-medium text-primary"
                            : "border border-border text-muted hover:border-primary/40 hover:text-fg",
                        )}
                        onClick={() => setPath(path.slice(0, i + 1))}
                      >
                        {c.name}
                      </button>
                    </span>
                  ))}
                </nav>
              ) : null}
              {leaf ? (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-ok/25 bg-ok/8 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm font-medium text-ok">
                    <Check className="size-4" /> Kategori seçildi: {pathRows.map((c) => c.name).join(" › ")}
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPath((p) => p.slice(0, -1))}>
                    Değiştir
                  </Button>
                </div>
              ) : levelError ? (
                <ErrorState message="Kategoriler yüklenemedi." onRetry={() => setLevelAttempt((n) => n + 1)} />
              ) : !levelReady ? (
                <p className="py-10 text-center text-sm text-muted">Kategoriler yükleniyor…</p>
              ) : (
                <CategoryButtons
                  items={currentCats}
                  counts={level.counts}
                  showIcons={path.length === 0}
                  onPick={(c) => {
                    setPath([...path, c.id]);
                    if (!c.has_children) setStep("photos");
                  }}
                />
              )}
              <StepActions>
                {path.length > 0 ? (
                  <Button type="button" variant="ghost" onClick={() => setPath((p) => p.slice(0, -1))}>
                    <ArrowLeft className="size-4" /> Geri
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" className="flex-1 md:flex-none" disabled={!leaf} onClick={() => setStep("photos")}>
                  Devam <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </section>
          ) : null}

          {step === "photos" ? (
            <section aria-label="Fotoğraflar">
              <PhotoUploader
                images={images}
                setImages={setImages}
                originals={photoOriginals.current}
                onBusyChange={setUploading}
                required={needsPhoto}
                editing={Boolean(editId)}
              />
              <StepActions note={uploading ? "Yüklemeler bitince devam edebilirsiniz…" : undefined}>
                <Button type="button" variant="ghost" disabled={uploading} onClick={() => goTo("category")}>
                  <ArrowLeft className="size-4" /> Geri
                </Button>
                <Button
                  type="button"
                  className="flex-1 md:flex-none"
                  disabled={uploading}
                  onClick={() => {
                    if (needsPhoto && images.length < 1) {
                      toast.error("Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.");
                      return;
                    }
                    setStep("details");
                  }}
                >
                  {images.length ? "İlan bilgilerine geç" : "Fotoğrafsız devam et"} <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </section>
          ) : null}

          {step === "details" ? (
            <form
              aria-labelledby="step-details"
              onSubmit={(e) => {
                e.preventDefault();
                const problem = detailsStepProblem();
                if (problem) {
                  toast.error(problem);
                  return;
                }
                setStep(showAttributes ? "attributes" : "location");
              }}
            >
              <SectionHeading id="step-details" title="İlan bilgileri" hint="Alıcıların ilk göreceği bilgiler." />

              <CategorySummary rows={pathRows} onChange={() => goTo("category")} />

              {editId ? (
                <p className="mb-4 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2 text-sm text-warn">
                  Başlık, açıklama, kategori, özellik değişirse veya yeni fotoğraf eklerseniz ilan yeniden onaya gider ve o sırada yayında görünmez.
                </p>
              ) : null}

              <div className="space-y-4">
                <div>
                  <FieldLabel htmlFor="listing-title" count={`${title.length}/100`}>
                    İlan başlığı
                  </FieldLabel>
                  <Input
                    id="listing-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                    placeholder="Örn. Sahibinden temiz 2018 Renault Clio 1.5 dCi"
                    minLength={5}
                    maxLength={100}
                    required
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="listing-price">Fiyat</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="listing-price"
                      inputMode="numeric"
                      autoComplete="off"
                      value={price ? formatNumber(price) : ""}
                      onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10))}
                      placeholder="0"
                      className="flex-1 text-lg font-semibold tabular-nums md:text-base"
                      required
                    />
                    <Select
                      id="listing-currency"
                      aria-label="Para birimi"
                      value={currency}
                      onChange={(e) => setCurrency(normalizeCurrency(e.target.value))}
                      className="w-28 shrink-0 font-semibold"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="listing-desc" count={`${description.length}/5000`}>
                    Açıklama
                  </FieldLabel>
                  <Textarea
                    id="listing-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
                    placeholder="Ürünün durumu, kullanım süresi, varsa kusurları, teslimat bilgisi…"
                    rows={6}
                    minLength={10}
                    maxLength={5000}
                    required
                  />
                </div>
              </div>

              <StepActions>
                <Button type="button" variant="ghost" onClick={() => goTo("photos")}>
                  <ArrowLeft className="size-4" /> Geri
                </Button>
                <Button type="submit" className="flex-1 md:flex-none">
                  {showAttributes ? "Özelliklere geç" : "Konuma geç"} <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </form>
          ) : null}

          {step === "attributes" ? (
            <form
              aria-labelledby="step-attributes"
              onSubmit={(e) => {
                e.preventDefault();
                const problem = attributesStepProblem();
                if (problem) {
                  toast.error(problem);
                  return;
                }
                setStep("location");
              }}
            >
              <SectionHeading id="step-attributes" title="Özellikler" hint="Alıcılar ilanınızı bu bilgilerle filtreleyerek bulur." />

              {attrsError ? <ErrorState message="Kategori özellikleri yüklenemedi." onRetry={() => setAttrAttempt((n) => n + 1)} /> : null}
              {attrsLoading ? <p className="py-6 text-center text-sm text-muted">Kategori özellikleri yükleniyor…</p> : null}

              <div className="space-y-5">
                {attrs.length ? (
                  <FieldGroup title="Kategori özellikleri">
                    {attrs.some((a) => a.type !== "MULTI" && a.type !== "BOOLEAN") ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {attrs
                          .filter((a) => a.type !== "MULTI" && a.type !== "BOOLEAN")
                          .map((a) => (
                            <AttrInput key={a.id} a={a} values={values} setValues={setValues} />
                          ))}
                      </div>
                    ) : null}
                    {attrs.some((a) => a.type === "BOOLEAN") ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {attrs
                          .filter((a) => a.type === "BOOLEAN")
                          .map((a) => {
                            const cur = String(values[a.name] ?? "");
                            return (
                              <div
                                key={a.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                              >
                                <span className="text-sm">
                                  {a.name}
                                  {a.required ? " *" : ""}
                                </span>
                                <div className="inline-flex shrink-0 rounded-md bg-elevated p-0.5" role="radiogroup" aria-label={a.name}>
                                  {(a.options ?? evetHayir).map((o) => (
                                    <button
                                      key={o}
                                      type="button"
                                      role="radio"
                                      aria-checked={cur === o}
                                      className={cn(
                                        "h-8 rounded px-3 text-sm transition-colors",
                                        cur === o ? "bg-surface font-medium text-fg shadow-xs" : "text-muted hover:text-fg",
                                      )}
                                      onClick={() => setValues((v) => ({ ...v, [a.name]: cur === o ? "" : o }))}
                                    >
                                      {o}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : null}
                    {attrs
                      .filter((a) => a.type === "MULTI")
                      .map((a) => {
                        const cur = String(values[a.name] ?? "")
                          .split(", ")
                          .filter(Boolean);
                        return (
                          <fieldset key={a.id}>
                            <legend className="mb-2 text-sm font-medium">
                              {a.name}
                              {a.required ? " *" : ""}
                              <span className="ml-2 text-xs font-normal text-muted">Birden fazla seçebilirsiniz</span>
                            </legend>
                            <div className="flex flex-wrap gap-2">
                              {(a.options ?? []).map((o) => {
                                const on = cur.includes(o);
                                return (
                                  <button
                                    key={o}
                                    type="button"
                                    aria-pressed={on}
                                    className={cn(
                                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                                      on ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                                    )}
                                    onClick={() => {
                                      const next = on ? cur.filter((x) => x !== o) : [...cur, o];
                                      setValues((v) => ({ ...v, [a.name]: next.join(", ") }));
                                    }}
                                  >
                                    {on ? <Check className="size-3.5" /> : null}
                                    {o}
                                  </button>
                                );
                              })}
                            </div>
                          </fieldset>
                        );
                      })}
                  </FieldGroup>
                ) : null}

                {hasarSemasiAcik && isVehicleCategory ? (
                  <FieldGroup title="Boya, Değişen ve Tramer">
                    <VehicleDamageDiagram value={parseDamageValue(values["_damage"])} onChange={handleDamageChange} />
                  </FieldGroup>
                ) : null}
              </div>

              <StepActions>
                <Button type="button" variant="ghost" onClick={() => goTo("details")}>
                  <ArrowLeft className="size-4" /> Geri
                </Button>
                <Button type="submit" className="flex-1 md:flex-none">
                  Konuma geç <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </form>
          ) : null}

          {step === "location" ? (
            <form
              aria-labelledby="step-location"
              onSubmit={(e) => {
                e.preventDefault();
                const problem = locationStepProblem();
                if (problem) {
                  toast.error(problem);
                  return;
                }
                setStep("preview");
              }}
            >
              <SectionHeading id="step-location" title="Konum ve iletişim" hint="Alıcıların size ulaşacağı bilgiler." />

              <div className="space-y-5">
                <FieldGroup title="Konum">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="listing-city">İl</Label>
                      <Select
                        id="listing-city"
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          setDistrict("");
                          setNeighborhood("");
                        }}
                        required
                      >
                        <option value="">Seçin</option>
                        {TURKEY_CITIES.map((c) => (
                          <option key={c.name}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="listing-district">İlçe</Label>
                      <Select
                        id="listing-district"
                        value={district}
                        disabled={!city}
                        onChange={(e) => {
                          setDistrict(e.target.value);
                          setNeighborhood("");
                        }}
                        required
                      >
                        <option value="">{city ? "Seçin" : "Önce il seçin"}</option>
                        {(cityData?.districts ?? []).map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="listing-hood">Mahalle</Label>
                      <Select
                        id="listing-hood"
                        value={neighborhood}
                        disabled={!hoods.length}
                        onChange={(e) => setNeighborhood(e.target.value)}
                      >
                        <option value="">{hoods.length ? "İsteğe bağlı" : "—"}</option>
                        {hoods.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </FieldGroup>

                <FieldGroup title="İletişim">
                  <div className="sm:max-w-sm">
                    <Label htmlFor="listing-phone">Telefon</Label>
                    <PhoneInput id="listing-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <p className="mt-1.5 text-xs text-muted">Alıcılar “Telefonu göster” ile bu numarayı görür.</p>
                  </div>
                  {storeId && storeName ? (
                    <p className="rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5 text-xs font-medium text-primary">
                      İlan “{storeName}” mağazanız adına yayınlanacak.
                    </p>
                  ) : null}
                </FieldGroup>
              </div>

              <StepActions>
                <Button type="button" variant="ghost" onClick={() => goTo(showAttributes ? "attributes" : "details")}>
                  <ArrowLeft className="size-4" /> Geri
                </Button>
                <Button type="submit" className="flex-1 md:flex-none">
                  Önizlemeye geç <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </form>
          ) : null}

          {step === "preview" ? (
            <section aria-labelledby="step-preview" className="space-y-6">
              <SectionHeading id="step-preview" title="Önizleme" hint="İlanınız alıcılara böyle görünecek." />

              <div className="relative">
                <ListingImageGallery images={images} title={title} categoryName={pathRows[pathRows.length - 1]?.name} />
                <EditLink onClick={() => goTo("photos")} className="absolute bottom-3 right-3 z-10 hidden sm:inline-flex" floating>
                  Fotoğrafları düzenle
                </EditLink>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-2xl font-semibold tabular-nums text-primary sm:text-3xl">{formatPrice(priceNumber, currency)}</p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug break-words sm:text-xl">{title}</h2>
                  <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                    <MapPin className="size-4 shrink-0" /> {location}
                  </p>
                  <p className="mt-1 text-xs text-subtle">{pathRows.map((c) => c.name).join(" › ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EditLink onClick={() => goTo("details")}>Bilgileri düzenle</EditLink>
                  <EditLink onClick={() => goTo("location")}>Konumu düzenle</EditLink>
                </div>
              </div>

              {Object.entries(values).some(([k, v]) => !k.startsWith("_") && v !== "" && v != null) ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Özellikler</h3>
                    {showAttributes ? (
                      <button type="button" onClick={() => goTo("attributes")} className="text-xs font-medium text-primary hover:underline">
                        Düzenle
                      </button>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-1 overflow-hidden rounded-xl border border-border sm:grid-cols-2">
                    {Object.entries(values)
                      .filter(([k, v]) => !k.startsWith("_") && v !== "" && v != null)
                      .map(([k, v]) => {
                        const raw = String(v);
                        const display = raw === "true" ? "Evet" : raw === "false" ? "Hayır" : raw;
                        return (
                          <div key={k} className="flex justify-between gap-4 border-b border-border px-3 py-2.5 text-sm last:border-b-0 sm:odd:border-r">
                            <dt className="text-muted">{k}</dt>
                            <dd className="text-right font-medium">{display}</dd>
                          </div>
                        );
                      })}
                  </dl>
                </div>
              ) : null}

              {hasarSemasiAcik && isVehicleCategory && hasDamageData(values["_damage"]) ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Boya, Değişen ve Tramer</h3>
                    {showAttributes ? (
                      <button type="button" onClick={() => goTo("attributes")} className="text-xs font-medium text-primary hover:underline">
                        Düzenle
                      </button>
                    ) : null}
                  </div>
                  <VehicleDamageDiagram readOnly value={parseDamageValue(values["_damage"])} />
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Açıklama</h3>
                <p className="whitespace-pre-wrap break-words rounded-xl bg-elevated/50 p-4 text-sm leading-relaxed">{description}</p>
              </div>

              <p className="rounded-xl bg-elevated/60 px-4 py-3 text-xs text-muted">
                {editId ? "Değişiklikleri kaydet" : "İlanı yayınla"}’ya tıklayarak ilanınızın GeldeSat kullanım koşullarına uygun olduğunu onaylarsınız. Kurallara aykırı ilanlar kaldırılır.
              </p>

              <StepActions>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => goTo("location")}>
                  <ArrowLeft className="size-4" /> Geri
                </Button>
                <Button type="button" className="flex-1 md:flex-none md:px-8" disabled={busy || uploading} onClick={() => void publish()}>
                  {busy ? "Kaydediliyor…" : editId ? "Değişiklikleri kaydet" : "İlanı yayınla"}
                  {busy ? null : <Send className="size-4" />}
                </Button>
              </StepActions>
            </section>
          ) : null}
        </div>

        <aside className="hidden space-y-4 lg:sticky lg:top-28 lg:block">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <div className="relative aspect-4/3 bg-elevated">
              {images[0] ? (
                <img src={photoSrc(images[0], 480)} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-subtle">
                  <div className="text-center">
                    <ImageIcon className="mx-auto size-8" />
                    <p className="mt-1 text-xs">Kapak fotoğrafı</p>
                  </div>
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-ink/65 px-2 py-0.5 text-[11px] font-semibold text-white">
                Canlı önizleme
              </span>
              {images.length > 1 ? (
                <span className="absolute bottom-2 right-2 rounded-full bg-ink/65 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {images.length} fotoğraf
                </span>
              ) : null}
            </div>
            <div className="space-y-1 p-4">
              <p className="font-display text-lg font-semibold tabular-nums">{priceNumber ? formatPrice(priceNumber, currency) : "Fiyat"}</p>
              <p className={cn("line-clamp-2 text-sm", title ? "text-fg" : "text-subtle")}>{title || "İlan başlığınız burada görünecek"}</p>
              <p className="flex items-center gap-1 pt-1 text-xs text-muted">
                <MapPin className="size-3.5" /> {location || "Konum"}
              </p>
            </div>
          </div>

          {benzerIlanAcik ? (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" aria-hidden="true" /> İlan Kalite Puanı
                </p>
                <span className="font-display text-sm font-bold tabular-nums text-primary">{quality.score}/100</span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    quality.score >= 80 ? "bg-ok" : quality.score >= 50 ? "bg-primary-solid" : "bg-warn",
                  )}
                  style={{ width: `${quality.score}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">{quality.hint}</p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-warn" /> İpuçları
            </p>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              {TIPS[step].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kaydedilmemiş değişiklikler var</DialogTitle>
            <DialogDescription>Bu sayfadan ayrılırsanız yaptığınız değişiklikler kaybolacak. Çıkmak istiyor musunuz?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => blocker.reset?.()}>
              Düzenlemeye devam et
            </Button>
            <Button type="button" variant="danger" onClick={() => blocker.proceed?.()}>
              Değişiklikleri sil ve çık
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Desktop: labelled steps with connectors. Mobile: compact "Adım n/total" + clickable completed pills. */
function Stepper({
  steps,
  step,
  onPick,
  locked,
}: {
  steps: StepKey[];
  step: StepKey;
  onPick: (s: StepKey) => void;
  locked: boolean;
}) {
  const activeIdx = steps.indexOf(step);
  return (
    <>
      <div className="mt-5 md:hidden">
        <div className="flex items-baseline justify-between text-sm">
          <p className="font-semibold">{STEP_META[step].label}</p>
          <p className="text-xs text-muted">
            Adım {activeIdx + 1}/{steps.length}
          </p>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= activeIdx ? "bg-primary-solid" : "bg-elevated")} />
          ))}
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {steps.map((s, i) => {
            const done = i < activeIdx;
            const current = s === step;
            return (
              <button
                key={s}
                type="button"
                disabled={!done || locked}
                onClick={() => onPick(s)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
                  current
                    ? "border-primary bg-primary/10 text-primary"
                    : done
                      ? "border-border bg-surface text-fg hover:border-primary/40"
                      : "border-border/60 bg-elevated/50 text-subtle",
                )}
              >
                {done ? <Check className="size-3 text-primary" /> : null}
                {STEP_META[s].label}
              </button>
            );
          })}
        </div>
      </div>

      <ol className="mt-8 hidden items-center md:flex" aria-label="İlan adımları">
        {steps.map((s, i) => {
          const done = i < activeIdx;
          const current = s === step;
          const meta = STEP_META[s];
          return (
            <li key={s} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!done || locked}
                onClick={() => onPick(s)}
                aria-current={current ? "step" : undefined}
                className="group flex items-center gap-3 rounded-lg text-left disabled:cursor-default"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
                    done && "bg-primary-solid text-primary-fg group-enabled:group-hover:bg-primary-solid/85",
                    current && "bg-primary-solid text-primary-fg ring-4 ring-primary/15",
                    !done && !current && "border border-border bg-surface text-muted",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="hidden lg:block">
                  <span className={cn("block text-sm font-medium", current || done ? "text-fg" : "text-muted")}>{meta.label}</span>
                  <span className="block text-xs text-subtle">{meta.hint}</span>
                </span>
                <span className={cn("text-sm font-medium lg:hidden", current || done ? "text-fg" : "text-muted")}>{meta.label}</span>
              </button>
              {i < steps.length - 1 ? (
                <span className={cn("mx-4 h-0.5 flex-1 rounded-full", done ? "bg-primary-solid" : "bg-border")} aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function SectionHeading({ id, title, hint }: { id: string; title: string; hint: string }) {
  return (
    <div className="mb-5">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted">{hint}</p>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-4 w-full text-xs font-semibold uppercase tracking-wider text-subtle">{title}</legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

function FieldLabel({ htmlFor, count, children }: { htmlFor: string; count?: string; children: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <Label htmlFor={htmlFor} className="mb-0">
        {children}
      </Label>
      {count ? <span className="text-xs tabular-nums text-subtle">{count}</span> : null}
    </div>
  );
}

function CategorySummary({ rows, onChange }: { rows: CategoryRow[]; onChange: () => void }) {
  if (!rows.length) return null;
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-elevated/70 px-3 py-2.5">
      <p className="min-w-0 truncate text-sm">
        <span className="text-muted">Kategori: </span>
        <span className="font-medium">{rows.map((c) => c.name).join(" › ")}</span>
      </p>
      <button type="button" onClick={onChange} className="shrink-0 text-sm font-medium text-primary hover:underline">
        Değiştir
      </button>
    </div>
  );
}

function EditLink({
  onClick,
  children,
  className,
  floating,
}: {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
        floating ? "bg-surface/95 text-fg shadow-md backdrop-blur hover:bg-surface" : "border border-border text-fg hover:bg-elevated",
        className,
      )}
    >
      <Pencil className="size-3.5" />
      {children}
    </button>
  );
}

/**
 * Step navigation. On phones it is pinned above the bottom tab bar so the main
 * action is always in thumb reach; from md up it sits at the end of the card.
 */
function StepActions({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md md:static md:z-auto md:mt-8 md:border-t md:bg-transparent md:px-0 md:pb-0 md:pt-5 md:shadow-none md:backdrop-blur-none"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      {note ? <p className="mb-2 text-center text-xs text-muted md:mb-3 md:text-right">{note}</p> : null}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">{children}</div>
    </div>
  );
}
