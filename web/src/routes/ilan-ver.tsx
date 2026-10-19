import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { browseCategories } from "@/lib/server/catalog";
import { getCategoryAttrs, getListingForEdit, getMe, saveListing } from "@/lib/server/account";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { NEIGHBORHOODS } from "@/lib/data/geo";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ImageIcon,
  Lightbulb,
  MapPin,
  Pencil,
  Send,
} from "lucide-react";
import { cleanPhone, cn, formatNumber, formatPrice, maskPhone10 } from "@/lib/utils";
import { toast } from "sonner";
import type { AttrDef, CategoryRow } from "@/lib/server/helpers";
import { CategoryButtons } from "@/components/listing/CategoryPicker";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { PhotoUploader, type PhotoOriginal } from "@/components/listing/PhotoUploader";
import { ListingImageGallery } from "@/components/listing/ListingImageGallery";
import { photoSrc } from "@/lib/images";

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
  return (
    <div>
      <Label>
        {a.name}
        {a.unit ? ` (${a.unit})` : ""}
        {a.required ? " *" : ""}
      </Label>
      {a.type === "SELECT" ? (
        <Select
          required={a.required}
          value={String(values[a.name] ?? "")}
          onChange={(e) => setValues((v) => ({ ...v, [a.name]: e.target.value }))}
        >
          <option value="">Seçin</option>
          {(a.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : (
        <Input
          type={a.type === "NUMBER" ? "number" : "text"}
          required={a.required}
          min={a.name === "Yıl" ? 1950 : a.type === "NUMBER" ? 0 : undefined}
          max={a.name === "Yıl" ? new Date().getFullYear() + 1 : undefined}
          value={String(values[a.name] ?? "")}
          onChange={(e) =>
            setValues((v) => ({ ...v, [a.name]: a.type === "NUMBER" ? Number(e.target.value) : e.target.value }))
          }
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/ilan-ver")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s.id === "string" && s.id ? { id: s.id } : {},
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

const STEPS = [
  { label: "Kategori", hint: "Ne satıyorsunuz?" },
  { label: "Detaylar", hint: "Başlık, fiyat ve konum" },
  { label: "Fotoğraflar", hint: "En fazla 10 fotoğraf" },
  { label: "Önizleme", hint: "Kontrol edip yayınlayın" },
] as const;

const TIPS: Record<number, string[]> = {
  0: ["En alt kategoriye kadar inin; alıcılar ilanınızı filtrelerle bu şekilde bulur.", "Arama kutusuna marka veya model yazarak hızlıca bulabilirsiniz."],
  1: [
    "Başlıkta marka, model ve en önemli özelliği belirtin.",
    "Açıklamada kusurları da dürüstçe yazın; güven satışı hızlandırır.",
    "Piyasa fiyatına yakın ilanlar daha çok mesaj alır.",
  ],
  2: [
    "Gün ışığında, ürünün tamamını gösteren fotoğraflar çekin.",
    "Kapak fotoğrafı ilk izlenimdir; en net fotoğrafı kapak yapın.",
    "Fotoğraflar oranları korunarak küçültülür ve filigran eklenir.",
  ],
  3: ["Yayınlamadan önce fiyat ve konumu son kez kontrol edin.", "İlanınızı daha sonra “İlanlarım” sayfasından düzenleyebilirsiniz."],
};

function PostPage() {
  const { id } = Route.useSearch();
  return <PostForm key={id ?? "new"} />;
}

function PostForm() {
  const { user, isPending } = useCurrentUserState();
  const rootLevel = Route.useLoaderData();
  const { id: editId } = Route.useSearch();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<string[]>([]);
  const [attrs, setAttrs] = useState<AttrDef[]>([]);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [phone, setPhone] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeId, setStoreId] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(!editId);
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
    browseCategories({ data: { path } })
      .then((next) => {
        if (!cancelled) setLevel({ key: pathKey, ...next });
      })
      .catch(() => {
        if (!cancelled) toast.error("Kategoriler yüklenemedi");
      });
    return () => {
      cancelled = true;
    };
    // `path` is captured through `pathKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, level.key, selectedRow?.has_children]);

  useEffect(() => {
    if (!selected) return;
    void getCategoryAttrs({ data: { categoryId: selected } }).then(setAttrs);
    if (keepValuesFor.current === selected) return;
    keepValuesFor.current = selected;
    setValues({});
  }, [selected]);

  const userProfileLoaded = useRef(false);

  useEffect(() => {
    if (!userId) return;
    void getMe().then((m) => {
      if (m.store) setStoreId(m.store.id);
      if (!editId && !userProfileLoaded.current) {
        if (m.profile?.phone) setPhone(maskPhone10(m.profile.phone));
        if (m.profile?.city) setCity(m.profile.city);
        userProfileLoaded.current = true;
      }
    });
  }, [userId, editId]);

  useEffect(() => {
    if (!editId || !userId) return;
    let cancelled = false;
    void getListingForEdit({ data: { id: editId } })
      .then((r) => {
        if (cancelled) return;
        keepValuesFor.current = r.path[r.path.length - 1] ?? r.listing.category_id;
        setPath(r.path);
        setTitle(r.listing.title);
        setDescription(r.listing.description);
        setPrice(String(Math.round(Number(r.listing.price))));
        setCity(r.listing.city ?? "");
        setDistrict(r.listing.district ?? "");
        setNeighborhood(r.listing.neighborhood ?? "");
        if (r.phone) setPhone(maskPhone10(r.phone));
        setImages(r.listing.images);
        setValues(r.listing.attrs ?? {});
        if (r.listing.store_id) setStoreId(r.listing.store_id);
        setStep(1);
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "İlan yüklenemedi");
        void nav({ to: "/ilanlarim" });
      });
    return () => {
      cancelled = true;
    };
  }, [editId, userId, nav]);

  // Each step starts at the top of the form, not wherever the previous one was scrolled.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  if (isPending || (user && !loaded)) return <BrandSpinner fullPage text="İlan formu hazırlanıyor…" />;
  if (!user) return <RedirectToSignIn />;

  function goTo(next: number) {
    if (uploading || busy) return;
    setStep(next);
  }

  async function publish() {
    if (!selected || uploading) return;
    if (needsPhoto && images.length < 1) {
      toast.error("Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.");
      setStep(2);
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
          city,
          district,
          neighborhood: neighborhood || undefined,
          phone: cleanPhone(phone) || undefined,
          images,
          attrs: values,
          storeId,
        },
      });
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
      toast.error(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setBusy(false);
    }
  }

  const priceNumber = Number(price) || 0;
  const location = [neighborhood, district, city].filter(Boolean).join(", ");

  return (
    <div ref={topRef} className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-44 pt-4 sm:pt-8 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{editId ? "İlanı düzenle" : "Ücretsiz ilan ver"}</h1>
          <p className="mt-1 text-sm text-muted">
            {editId ? "Değişikliklerinizi yapın ve kaydedin." : "4 adımda ilanınızı oluşturun, binlerce alıcıya ulaşın."}
          </p>
        </div>
      </header>

      <Stepper step={step} onPick={(i) => i < step && goTo(i)} locked={uploading || busy} />

      <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <main className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          {step === 0 ? (
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
              ) : !levelReady ? (
                <p className="py-10 text-center text-sm text-muted">Kategoriler yükleniyor…</p>
              ) : (
                <CategoryButtons
                  items={currentCats}
                  counts={level.counts}
                  onPick={(c) => {
                    setPath([...path, c.id]);
                    if (!c.has_children) setStep(1);
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
                <Button type="button" className="flex-1 md:flex-none" disabled={!leaf} onClick={() => setStep(1)}>
                  Devam <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </section>
          ) : null}

          {step === 1 ? (
            <form
              aria-labelledby="step-details"
              onSubmit={(e) => {
                e.preventDefault();
                if (priceNumber < 1) {
                  toast.error("Geçerli bir fiyat girin.");
                  return;
                }
                setStep(2);
              }}
            >
              <SectionHeading id="step-details" title="İlan detayları" hint="Alıcıların ilk göreceği bilgiler." />

              <CategorySummary rows={pathRows} onChange={() => goTo(0)} />

              <div className="space-y-5">
                <FieldGroup title="Temel bilgiler">
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
                    <div className="relative">
                      <Input
                        id="listing-price"
                        inputMode="numeric"
                        autoComplete="off"
                        value={price ? formatNumber(price) : ""}
                        onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10))}
                        placeholder="0"
                        className="pr-12 text-lg font-semibold tabular-nums md:text-base"
                        required
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm font-semibold text-muted">
                        TL
                      </span>
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
                </FieldGroup>

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
                </FieldGroup>

                {attrs.length ? (
                  <FieldGroup title="Özellikler">
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
                                <span className="text-sm">{a.name}</span>
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
              </div>

              <StepActions>
                <Button type="button" variant="ghost" onClick={() => goTo(0)}>
                  <ArrowLeft className="size-4" /> Geri
                </Button>
                <Button type="submit" className="flex-1 md:flex-none">
                  Fotoğraflara geç <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </form>
          ) : null}

          {step === 2 ? (
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
                <Button type="button" variant="ghost" disabled={uploading} onClick={() => goTo(1)}>
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
                    setStep(3);
                  }}
                >
                  {images.length ? "Önizleme" : "Fotoğrafsız devam et"} <ArrowRight className="size-4" />
                </Button>
              </StepActions>
            </section>
          ) : null}

          {step === 3 ? (
            <section aria-labelledby="step-preview" className="space-y-6">
              <SectionHeading id="step-preview" title="Önizleme" hint="İlanınız alıcılara böyle görünecek." />

              <div className="relative">
                <ListingImageGallery images={images} title={title} categoryName={pathRows[pathRows.length - 1]?.name} />
                <EditLink onClick={() => goTo(2)} className="absolute bottom-3 right-3 z-10 hidden sm:inline-flex" floating>
                  Fotoğrafları düzenle
                </EditLink>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-2xl font-semibold tabular-nums text-primary sm:text-3xl">{formatPrice(priceNumber)}</p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug break-words sm:text-xl">{title}</h2>
                  <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                    <MapPin className="size-4 shrink-0" /> {location}
                  </p>
                  <p className="mt-1 text-xs text-subtle">{pathRows.map((c) => c.name).join(" › ")}</p>
                </div>
                <EditLink onClick={() => goTo(1)}>Bilgileri düzenle</EditLink>
              </div>

              {Object.entries(values).some(([, v]) => v !== "" && v != null) ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Özellikler</h3>
                  <dl className="grid grid-cols-1 overflow-hidden rounded-xl border border-border sm:grid-cols-2">
                    {Object.entries(values)
                      .filter(([, v]) => v !== "" && v != null)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-border px-3 py-2.5 text-sm last:border-b-0 sm:odd:border-r">
                          <dt className="text-muted">{k}</dt>
                          <dd className="text-right font-medium">{String(v)}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Açıklama</h3>
                <p className="whitespace-pre-wrap break-words rounded-xl bg-elevated/50 p-4 text-sm leading-relaxed">{description}</p>
              </div>

              <StepActions>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => goTo(2)}>
                  <ArrowLeft className="size-4" /> Geri
                </Button>
                <Button type="button" className="flex-1 md:flex-none md:px-8" disabled={busy || uploading} onClick={() => void publish()}>
                  {busy ? "Kaydediliyor…" : editId ? "Değişiklikleri kaydet" : "İlanı yayınla"}
                  {busy ? null : <Send className="size-4" />}
                </Button>
              </StepActions>
            </section>
          ) : null}
        </main>

        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
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
              <p className="font-display text-lg font-semibold tabular-nums">{priceNumber ? formatPrice(priceNumber) : "Fiyat"}</p>
              <p className={cn("line-clamp-2 text-sm", title ? "text-fg" : "text-subtle")}>{title || "İlan başlığınız burada görünecek"}</p>
              <p className="flex items-center gap-1 pt-1 text-xs text-muted">
                <MapPin className="size-3.5" /> {location || "Konum"}
              </p>
            </div>
          </div>

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
    </div>
  );
}

/** Desktop: labelled steps with connectors. Mobile: compact "Adım n/4" with a segmented bar. */
function Stepper({ step, onPick, locked }: { step: number; onPick: (i: number) => void; locked: boolean }) {
  return (
    <>
      <div className="mt-5 md:hidden">
        <div className="flex items-baseline justify-between text-sm">
          <p className="font-semibold">{STEPS[step].label}</p>
          <p className="text-xs text-muted">
            Adım {step + 1}/{STEPS.length}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.label} className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-elevated")} />
          ))}
        </div>
      </div>

      <ol className="mt-8 hidden items-center md:flex" aria-label="İlan adımları">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!done || locked}
                onClick={() => onPick(i)}
                aria-current={current ? "step" : undefined}
                className="group flex items-center gap-3 rounded-lg text-left disabled:cursor-default"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
                    done && "bg-primary text-primary-fg group-enabled:group-hover:bg-primary/85",
                    current && "bg-primary text-primary-fg ring-4 ring-primary/15",
                    !done && !current && "border border-border bg-surface text-muted",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="hidden lg:block">
                  <span className={cn("block text-sm font-medium", current || done ? "text-fg" : "text-muted")}>{s.label}</span>
                  <span className="block text-xs text-subtle">{s.hint}</span>
                </span>
                <span className={cn("text-sm font-medium lg:hidden", current || done ? "text-fg" : "text-muted")}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 ? (
                <span className={cn("mx-4 h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")} aria-hidden="true" />
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
      className="fixed inset-x-0 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md md:static md:z-auto md:mt-8 md:border-t md:bg-transparent md:px-0 md:pb-0 md:pt-5 md:shadow-none md:backdrop-blur-none"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {note ? <p className="mb-2 text-center text-xs text-muted md:mb-3 md:text-right">{note}</p> : null}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">{children}</div>
    </div>
  );
}
