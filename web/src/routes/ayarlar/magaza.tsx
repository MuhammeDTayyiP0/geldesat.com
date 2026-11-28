import { ErrorState } from "@/components/common/ErrorState";
import { createFileRoute, Link } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Store,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  bulkImportListings,
  getMe,
  myStoreApplication,
  submitStoreApplication,
  upsertStore,
  type StoreApplicationRow,
} from "@/lib/server/account";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  INDIVIDUAL_ACTIVE_LISTING_LIMIT,
  STORE_SECTORS,
  type BusinessType,
} from "@/lib/account-type";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { checkPhotoFile, PHOTO_ACCEPT } from "@/lib/images";
import { UPLOAD_HEADER } from "@/lib/listing-photos";
import { useFlag } from "@/lib/use-flag";
import { cleanPhone, formatDate, formatPrice, maskPhone10 } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { AvatarCropperDialog } from "@/components/account/AvatarCropperDialog";
import { PhoneInput } from "@/components/ui/phone-input";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/magaza")({
  head: () => ({
    meta: [{ title: "Mağazam | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: StoreSettings,
});

type Form = { name: string; description: string; city: string; phone: string };
type ApplicationForm = {
  name: string;
  businessType: BusinessType;
  sector: string;
  taxOffice: string;
  taxNo: string;
  city: string;
  phone: string;
  address: string;
  notes: string;
};

type BulkRow = {
  title: string;
  description: string;
  price: number;
  currency: "TRY" | "USD" | "EUR";
  categorySlug: string;
  city: string;
  district: string;
  neighborhood?: string;
};

type ParseResult = {
  rows: BulkRow[];
  error: string | null;
};

function normalizeCurrency(raw: string | undefined): "TRY" | "USD" | "EUR" {
  const upper = (raw ?? "").trim().toUpperCase();
  if (upper === "USD" || upper === "$") return "USD";
  if (upper === "EUR" || upper === "€") return "EUR";
  return "TRY";
}

function normalizePrice(raw: string | undefined): number {
  const cleaned = (raw ?? "").replace(/[\s_₺$€]|TL/gi, "").trim();
  if (!cleaned) return Number.NaN;
  let normalized = cleaned;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else if (/^\d+(,\d{1,2})$/.test(cleaned)) {
    normalized = cleaned.replace(",", ".");
  } else if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return Number.NaN;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

function normalizeHeaderKey(header: string): keyof BulkRow | null {
  const k = header
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[\s-]+/g, "_");
  if (k === "title" || k === "baslik" || k === "ilan_basligi") return "title";
  if (k === "description" || k === "aciklama") return "description";
  if (k === "price" || k === "fiyat") return "price";
  if (k === "currency" || k === "para_birimi" || k === "doviz") return "currency";
  if (k === "categoryslug" || k === "category_slug" || k === "category" || k === "kategori" || k === "kategori_slug") {
    return "categorySlug";
  }
  if (k === "city" || k === "sehir" || k === "il") return "city";
  if (k === "district" || k === "ilce") return "district";
  if (k === "neighborhood" || k === "mahalle") return "neighborhood";
  return null;
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        cur += ch;
      }
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      if (cur.trim()) lines.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) lines.push(cur);
  return lines;
}

function splitCsvFields(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function rowFromRecord(record: Partial<Record<keyof BulkRow, string>>): BulkRow {
  const neighborhood = record.neighborhood?.trim();
  return {
    title: (record.title ?? "").trim(),
    description: (record.description ?? "").trim(),
    price: normalizePrice(record.price),
    currency: normalizeCurrency(record.currency),
    categorySlug: (record.categorySlug ?? "").trim(),
    city: (record.city ?? "").trim(),
    district: (record.district ?? "").trim(),
    ...(neighborhood ? { neighborhood } : {}),
  };
}

function parseCsvBulk(text: string): ParseResult {
  const lines = splitCsvLines(text.replace(/^\uFEFF/, ""));
  if (lines.length < 2) {
    return { rows: [], error: "CSV en az bir başlık satırı ve bir veri satırı içermelidir." };
  }
  const headerLine = lines[0];
  const delimiter = headerLine.split(";").length > headerLine.split(",").length ? ";" : ",";
  const headers = splitCsvFields(headerLine, delimiter).map(normalizeHeaderKey);
  if (!headers.some(Boolean)) {
    return {
      rows: [],
      error: "Geçerli sütun başlıkları bulunamadı (title, description, price, currency, categorySlug, city, district, neighborhood).",
    };
  }
  const rows: BulkRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvFields(lines[i], delimiter);
    const rec: Partial<Record<keyof BulkRow, string>> = {};
    headers.forEach((key, idx) => {
      if (key && cols[idx] !== undefined) rec[key] = cols[idx];
    });
    rows.push(rowFromRecord(rec));
  }
  return { rows, error: null };
}

function parseXmlBulk(text: string): ParseResult {
  if (typeof DOMParser === "undefined") return { rows: [], error: "XML ayrıştırıcı kullanılamıyor." };
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    return { rows: [], error: "XML sözdizimi hatalı. Etiketleri kontrol edin." };
  }
  const itemSelectors = ["listing", "ilan", "item", "row", "record"];
  let nodes: Element[] = [];
  for (const tag of itemSelectors) {
    const matched = Array.from(doc.getElementsByTagName(tag));
    if (matched.length) {
      nodes = matched;
      break;
    }
  }
  if (!nodes.length) {
    return { rows: [], error: "XML içinde <listing>, <ilan>, <item> veya <row> öğesi bulunamadı." };
  }
  const rows: BulkRow[] = nodes.map((node) => {
    const rec: Partial<Record<keyof BulkRow, string>> = {};
    for (const child of Array.from(node.children)) {
      const key = normalizeHeaderKey(child.tagName);
      if (key) rec[key] = child.textContent ?? "";
    }
    for (const attr of Array.from(node.attributes)) {
      const key = normalizeHeaderKey(attr.name);
      if (key && !rec[key]) rec[key] = attr.value;
    }
    return rowFromRecord(rec);
  });
  return { rows, error: null };
}

function parseBulkInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], error: null };
  return trimmed.startsWith("<") ? parseXmlBulk(trimmed) : parseCsvBulk(trimmed);
}

function StoreSettings() {
  const topluAktarim = useFlag("toplu_ilan_aktarim");
  const { user, isPending } = useCurrentUserState();
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<{ userId: string; logoUrl: string | null } | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(true);
  const [listingLimit, setListingLimit] = useState<{ used: number; max: number; isCorporate: boolean } | null>(null);
  const [application, setApplication] = useState<StoreApplicationRow | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form>({ name: "", description: "", city: "", phone: "" });
  const [appForm, setAppForm] = useState<ApplicationForm>({
    name: "",
    businessType: "SOLE",
    sector: "",
    taxOffice: "",
    taxNo: "",
    city: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [appBusy, setAppBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [rawImport, setRawImport] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: Array<{ index: number; error: string }> } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const parsedImport = useMemo(() => parseBulkInput(rawImport), [rawImport]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMe()
      .then(async (m) => {
        if (cancelled) return;
        const s = m.store;
        const initial: Form = {
          name: s?.name ?? "",
          description: s?.description ?? "",
          // A new store starts with the member's city; an existing one shows only what it saved.
          city: s ? (s.city ?? "") : (m.profile?.city ?? ""),
          // The personal number is not copied in: saving it would make it the store's.
          phone: maskPhone10(s?.phone ?? ""),
        };
        setStore(s ? { userId: m.userId, logoUrl: s.logo_url ?? null } : null);
        setEmailVerified(Boolean(m.emailVerified));
        setListingLimit(m.listingLimit ?? null);
        setSaved(s ? initial : null);
        setForm(initial);
        if (!s) {
          const app = await myStoreApplication().catch(() => null);
          if (cancelled) return;
          setApplication(app);
          setAppForm((prev) => ({
            ...prev,
            city: prev.city || m.profile?.city || "",
            phone: prev.phone || maskPhone10(m.profile?.phone ?? ""),
          }));
        } else {
          setApplication(null);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per signed-in user
  }, [user?.id, retry]);

  if (failed) {
    return (
      <AccountShell title="Mağaza">
        <ErrorState
          message="Mağaza bilgileri yüklenemedi. Tekrar deneyin."
          onRetry={() => {
            setFailed(false);
            setRetry((r) => r + 1);
          }}
        />
      </AccountShell>
    );
  }
  if (isPending || (user && !loaded)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  const dirty = !saved || JSON.stringify(form) !== JSON.stringify(saved);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setApp = (patch: Partial<ApplicationForm>) => setAppForm((f) => ({ ...f, ...patch }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await upsertStore({
        data: {
          name: form.name.trim(),
          description: form.description.trim(),
          city: form.city,
          phone: cleanPhone(form.phone),
        },
      });
      toast.success("Mağaza güncellendi");
      setStore((prev) => ({ userId: prev?.userId ?? user?.id ?? "", logoUrl: prev?.logoUrl ?? null }));
      setSaved(form);
    } catch (err) {
      toast.error(errorText(err, "Kaydedilemedi"));
    } finally {
      setBusy(false);
    }
  }

  function onSelectLogo(file: File | undefined) {
    if (!file) return;
    const problem = checkPhotoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPendingLogo(file);
  }

  async function onLogoUpload(blob: Blob) {
    setLogoBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "logo.jpg");
      const res = await fetch("/api/store-logo", {
        method: "POST",
        headers: { [UPLOAD_HEADER]: "1" },
        body: formData,
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Logo yüklenemedi.");
      setStore((prev) => (prev ? { ...prev, logoUrl: body.url ?? null } : prev));
      setPendingLogo(null);
      toast.success("Mağaza logosu güncellendi");
    } catch (err) {
      toast.error(errorText(err, "Logo yüklenemedi"));
    } finally {
      setLogoBusy(false);
    }
  }

  async function onLogoRemove() {
    setLogoBusy(true);
    try {
      const res = await fetch("/api/store-logo", {
        method: "DELETE",
        headers: { [UPLOAD_HEADER]: "1" },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Logo kaldırılamadı.");
      setStore((prev) => (prev ? { ...prev, logoUrl: null } : prev));
      toast.success("Mağaza logosu kaldırıldı");
    } catch (err) {
      toast.error(errorText(err, "Logo kaldırılamadı"));
    } finally {
      setLogoBusy(false);
    }
  }

  async function onApplicationSubmit(e: FormEvent) {
    e.preventDefault();
    if (!emailVerified) {
      toast.error("Önce e-posta adresinizi doğrulayın.");
      return;
    }
    setAppBusy(true);
    try {
      const created = await submitStoreApplication({
        data: {
          name: appForm.name.trim(),
          businessType: appForm.businessType,
          sector: appForm.sector,
          taxOffice: appForm.taxOffice.trim(),
          taxNo: appForm.taxNo.trim(),
          city: appForm.city,
          phone: cleanPhone(appForm.phone),
          address: appForm.address.trim(),
          notes: appForm.notes.trim() || undefined,
        },
      });
      setApplication(created);
      toast.success("Kurumsal mağaza başvurunuz alındı");
    } catch (err) {
      toast.error(errorText(err, "Başvuru gönderilemedi"));
    } finally {
      setAppBusy(false);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      setRawImport(text);
      setImportResult(null);
    } catch {
      toast.error("Dosya okunamadı");
    }
  }

  async function onBulkImport() {
    if (!parsedImport.rows.length || parsedImport.rows.length > 50) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const res = await bulkImportListings({ data: { rows: parsedImport.rows } });
      setImportResult(res);
      if (res.imported > 0) {
        toast.success(`${res.imported} ilan başarıyla aktarıldı`);
      } else if (res.errors.length > 0) {
        toast.error("Hiçbir ilan aktarılamadı, satır hatalarını kontrol edin.");
      }
    } catch (err) {
      toast.error(errorText(err, "Toplu aktarım başarısız"));
    } finally {
      setImportBusy(false);
    }
  }

  const cooldownActive = Boolean(application?.cooldown_until && Date.parse(application.cooldown_until) > Date.now());
  const remainingCooldownDays =
    cooldownActive && application?.cooldown_until
      ? Math.max(1, Math.ceil((Date.parse(application.cooldown_until) - Date.now()) / 86_400_000))
      : 0;

  return (
    <AccountShell
      title={store ? "Mağazam" : "Kurumsal Hesaba Geç"}
      description={
        store
          ? "Profilinizin üstünde mağaza olarak görünen bilgiler."
          : "İşletmeniz için kurumsal mağaza vitrini ve yüksek ilan limiti talep edin."
      }
      actions={
        store ? (
          <Link to="/satici/$id" params={{ id: store.userId }} aria-label="Mağazayı gör" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink className="size-3.5" />{" "}
              <span className="hidden sm:inline">Mağazayı gör</span>
            </Link>
        ) : null
      }
    >
      {!store ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Mevcut Hesap Türü</p>
                <p className="mt-0.5 text-base font-semibold">
                  Bireysel Hesap{" "}
                  {listingLimit ? (
                    <span className="text-sm font-normal text-muted">
                      ({listingLimit.used}/{listingLimit.max} aktif ilan)
                    </span>
                  ) : null}
                </p>
              </div>
              <span className="rounded-full bg-elevated px-3 py-1 text-xs font-medium text-muted">
                Limit: {INDIVIDUAL_ACTIVE_LISTING_LIMIT} aktif ilan
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Kurumsal mağaza onaylandığında hesabınız <strong className="text-fg">Kurumsal</strong> türe geçer; mağaza vitrini, kurumsal rozet,{" "}
              <strong className="text-fg">50+ aktif ilan</strong> hakkı ve toplu ilan aktarımı açılır.
            </p>
          </div>

          {!emailVerified ? (
            <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm sm:p-5">
              <p className="font-semibold text-warn">E-posta doğrulaması gerekli</p>
              <p className="mt-1 text-xs text-muted">
                Kurumsal mağaza başvurusu göndermeden önce hesap e-posta adresinizi doğrulamanız gerekir.
              </p>
              <Link to="/ayarlar/guvenlik" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}>
                Hesap ve güvenlikten doğrula →
              </Link>
            </div>
          ) : null}

          {application?.status === "PENDING" ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/8 p-5 shadow-card sm:p-6">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-fg">Kurumsal başvurunuz inceleniyor</h2>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-medium text-fg">{application.name}</span> için yaptığınız başvuru ekibimiz tarafından değerlendiriliyor.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                    {application.business_type ? (
                      <span>Tür: {BUSINESS_TYPE_LABELS[application.business_type]}</span>
                    ) : null}
                    {application.sector ? <span>Sektör: {application.sector}</span> : null}
                    {application.tax_office ? <span>Vergi Dairesi: {application.tax_office}</span> : null}
                    {application.tax_no ? <span>VKN/TCKN: {application.tax_no}</span> : null}
                    {application.city ? <span>İl: {application.city}</span> : null}
                    {application.phone ? <span>Telefon: {application.phone}</span> : null}
                    <span>Başvuru: {formatDate(application.created_at)}</span>
                  </div>
                  {application.address ? <p className="mt-2 text-xs text-muted">Adres: {application.address}</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {application?.status === "APPROVED" ? (
            <div className="rounded-2xl border border-ok/30 bg-ok/10 p-5 shadow-card sm:p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
                <div>
                  <h2 className="text-base font-semibold text-fg">Mağaza başvurunuz onaylandı</h2>
                  <p className="mt-1 text-sm text-muted">Sayfayı yenileyerek mağaza ayarlarınıza erişebilirsiniz.</p>
                </div>
              </div>
            </div>
          ) : null}

          {application?.status === "REJECTED" ? (
            <div className="rounded-2xl border border-danger-solid/30 bg-danger-solid/8 p-5 shadow-card sm:p-6">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 size-5 shrink-0 text-danger" />
                <div>
                  <h2 className="text-base font-semibold text-fg">Önceki başvurunuz reddedildi</h2>
                  {application.review_note ? <p className="mt-1 text-sm text-muted">İnceleme notu: {application.review_note}</p> : null}
                  {cooldownActive ? (
                    <p className="mt-1 text-sm font-medium text-danger">
                      {remainingCooldownDays} gün sonra ({formatDate(application.cooldown_until!)}) yeniden başvurabilirsiniz.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Bilgilerinizi güncelleyerek yeniden başvurabilirsiniz.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {(!application || application.status === "REJECTED") && !cooldownActive ? (
            <form
              onSubmit={onApplicationSubmit}
              className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Store className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Kurumsal Mağaza Başvuru Formu</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    Başvurular vergi ve işletme bilgileri kontrol edilerek ekibimiz tarafından onaylanır.
                  </p>
                </div>
              </div>

              <div>
                <Label>İşletme türü</Label>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_TYPES.map((bt) => {
                    const active = appForm.businessType === bt;
                    return (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setApp({ businessType: bt })}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          active ? "border-primary bg-primary/10 text-primary" : "border-border bg-bg text-muted hover:bg-elevated"
                        }`}
                      >
                        {BUSINESS_TYPE_LABELS[bt]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="app-name">Mağaza / İşletme adı</Label>
                  <Input
                    id="app-name"
                    value={appForm.name}
                    onChange={(e) => setApp({ name: e.target.value })}
                    placeholder="Örn. Anadolu Oto Galeri"
                    minLength={3}
                    maxLength={60}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="app-sector">Faaliyet alanı (Sektör)</Label>
                  <Select id="app-sector" value={appForm.sector} onChange={(e) => setApp({ sector: e.target.value })} required>
                    <option value="">Seçin</option>
                    {STORE_SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="app-tax-office">Vergi dairesi</Label>
                  <Input
                    id="app-tax-office"
                    value={appForm.taxOffice}
                    onChange={(e) => setApp({ taxOffice: e.target.value })}
                    placeholder="Örn. Seyhan Vergi Dairesi"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="app-tax">
                    {appForm.businessType === "COMPANY" ? "Vergi Kimlik No (10 hane VKN)" : "VKN (10 hane) veya TCKN (11 hane)"}
                  </Label>
                  <Input
                    id="app-tax"
                    value={appForm.taxNo}
                    onChange={(e) => setApp({ taxNo: e.target.value.replace(/\D/g, "").slice(0, appForm.businessType === "COMPANY" ? 10 : 11) })}
                    inputMode="numeric"
                    minLength={10}
                    maxLength={appForm.businessType === "COMPANY" ? 10 : 11}
                    placeholder={appForm.businessType === "COMPANY" ? "10 haneli VKN" : "10 haneli VKN veya 11 haneli TCKN"}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="app-city">İl</Label>
                  <Select id="app-city" value={appForm.city} onChange={(e) => setApp({ city: e.target.value })} required>
                    <option value="">Seçin</option>
                    {TURKEY_CITIES.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="app-phone">İşletme telefonu</Label>
                  <PhoneInput id="app-phone" value={appForm.phone} onChange={(e) => setApp({ phone: e.target.value })} required />
                </div>
              </div>

              <div>
                <Label htmlFor="app-address">Açık işletme adresi</Label>
                <Textarea
                  id="app-address"
                  value={appForm.address}
                  onChange={(e) => setApp({ address: e.target.value.slice(0, 300) })}
                  placeholder="Mahalle, cadde/sokak, bina no, ilçe ve il"
                  minLength={10}
                  rows={2}
                  required
                />
              </div>

              <div>
                <Label htmlFor="app-notes">Başvuru notu (isteğe bağlı)</Label>
                <Textarea
                  id="app-notes"
                  value={appForm.notes}
                  onChange={(e) => setApp({ notes: e.target.value.slice(0, 1000) })}
                  placeholder="Web siteniz, ortalama ilan sayınız veya eklemek istedikleriniz"
                  rows={2}
                />
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <Button type="submit" disabled={appBusy || !emailVerified}>
                  {appBusy ? "Gönderiliyor…" : "Kurumsal başvuru gönder"}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <section className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-elevated">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt="Mağaza logosu" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-primary">
                  <Store className="size-8" />
                </div>
              )}
              {logoBusy ? (
                <span className="absolute inset-0 grid place-items-center bg-ink/40">
                  <Loader2 className="size-6 animate-spin text-white" />
                </span>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="font-medium">Mağaza logosu</p>
              <p className="mt-0.5 text-xs text-muted">Seçtikten sonra kırpıp konumlandırabilirsiniz; JPEG, PNG, WebP veya HEIC.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    onSelectLogo(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={logoBusy}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Camera className="size-4" /> {store.logoUrl ? "Logoyu değiştir" : "Logo yükle"}
                </Button>
                {store.logoUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={logoBusy}
                    onClick={() => void onLogoRemove()}
                    className="text-danger hover:bg-danger-solid/8"
                  >
                    <Trash2 className="size-4" /> Kaldır
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6"
          >
            <div>
              <Label htmlFor="st-name">Mağaza adı</Label>
              <Input
                id="st-name"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                minLength={3}
                maxLength={60}
                required
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <Label htmlFor="st-desc" className="mb-0">
                  Açıklama
                </Label>
                <span className="text-xs tabular-nums text-subtle">
                  {form.description.length}/400
                </span>
              </div>
              <Textarea
                id="st-desc"
                value={form.description}
                onChange={(e) => set({ description: e.target.value.slice(0, 400) })}
                placeholder="İşletmenizi, çalışma saatlerinizi ve hizmetlerinizi anlatın"
                rows={4}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="st-city">İl</Label>
                <Select
                  id="st-city"
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                >
                  <option value="">Seçin</option>
                  {TURKEY_CITIES.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="st-phone">Mağaza telefonu</Label>
                <PhoneInput
                  id="st-phone"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" disabled={busy || !dirty}>
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </form>

          {topluAktarim ? (
            <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Toplu İlan Aktarımı (CSV / XML)</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Tek seferde en fazla 50 ilan yükleyebilirsiniz. Sütunlar:{" "}
                      <code className="rounded bg-elevated px-1 py-0.5 text-[11px]">
                        title, description, price, currency, categorySlug, city, district, neighborhood
                      </code>
                    </p>
                  </div>
                </div>
                <div>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv,.xml,text/csv,application/xml,text/xml"
                    className="hidden"
                    onChange={(e) => {
                      void onImportFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importBusy}
                    onClick={() => importFileRef.current?.click()}
                  >
                    <Upload className="size-4" /> Dosya seç
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="bulk-import-raw">CSV veya XML içeriği</Label>
                <Textarea
                  id="bulk-import-raw"
                  value={rawImport}
                  onChange={(e) => {
                    setRawImport(e.target.value);
                    setImportResult(null);
                  }}
                  placeholder={
                    "title,description,price,currency,categorySlug,city,district,neighborhood\nTemiz 2020 Sedan,Garaj arabası bakımlı araç,850000,TRY,otomobil,İstanbul,Kadıköy,Moda"
                  }
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>

              {parsedImport.error ? (
                <p className="rounded-lg border border-danger-solid/30 bg-danger-solid/8 px-3 py-2 text-xs text-danger">
                  {parsedImport.error}
                </p>
              ) : null}

              {parsedImport.rows.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-fg">
                      Önizleme: {parsedImport.rows.length} satır algılandı
                    </span>
                    {parsedImport.rows.length > 50 ? (
                      <span className="font-medium text-danger">
                        Tek seferde en fazla 50 ilan aktarılabilir ({parsedImport.rows.length}/50)
                      </span>
                    ) : null}
                  </div>
                  <ul className="divide-y divide-border text-xs">
                    {parsedImport.rows.slice(0, 5).map((row, idx) => (
                      <li key={`${idx}-${row.title}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                        <span className="min-w-0 flex-1 truncate font-medium text-fg">
                          {idx + 1}. {row.title || "(Başlık yok)"}
                        </span>
                        <span className="text-muted">
                          {formatPrice(row.price, row.currency)} · {row.categorySlug || "?"} · {row.city || "?"}/{row.district || "?"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {parsedImport.rows.length > 5 ? (
                    <p className="text-[11px] text-muted">ve {parsedImport.rows.length - 5} satır daha…</p>
                  ) : null}
                </div>
              ) : null}

              {importResult ? (
                <div className="space-y-2 rounded-xl border border-border bg-surface p-3 text-xs">
                  <p className="font-semibold text-fg">
                    Aktarım sonucu: {importResult.imported} ilan yüklendi
                    {importResult.errors.length ? `, ${importResult.errors.length} satırda hata` : "."}
                  </p>
                  {importResult.errors.length ? (
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-danger">
                      {importResult.errors.map((err) => (
                        <li key={`${err.index}-${err.error}`}>
                          Satır {err.index + 1}: {err.error}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  type="button"
                  disabled={importBusy || parsedImport.rows.length === 0 || parsedImport.rows.length > 50}
                  onClick={() => void onBulkImport()}
                >
                  {importBusy ? "Aktarılıyor…" : `${parsedImport.rows.length || 0} ilanı içe aktar`}
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      )}
      <AvatarCropperDialog
        file={pendingLogo}
        shape="rounded"
        title="Mağaza logosunu düzenle"
        busy={logoBusy}
        onCancel={() => setPendingLogo(null)}
        onConfirm={onLogoUpload}
      />
    </AccountShell>
  );
}
