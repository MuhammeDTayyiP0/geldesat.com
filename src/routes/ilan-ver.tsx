import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { listCategories } from "@/lib/server/catalog";
import { getCategoryAttrs, getListingForEdit, getMe, saveListing } from "@/lib/server/account";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { NEIGHBORHOODS } from "@/lib/data/geo";
import { compressImage } from "@/lib/images";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Check } from "lucide-react";
import { cleanPhone, formatPhone, formatPrice, maskPhone10 } from "@/lib/utils";
import { toast } from "sonner";
import type { AttrDef, CategoryRow } from "@/lib/server/helpers";
import { CategoryButtons } from "@/components/listing/CategoryPicker";
import { BrandSpinner } from "@/components/brand/BrandSpinner";

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
  loader: () => listCategories(),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useSearch();
  return <PostForm key={id ?? "new"} />;
}

function PostForm() {
  const { user, isPending } = useCurrentUserState();
  const cats = Route.useLoaderData();
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
  const [storeId, setStoreId] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(!editId);
  const keepValuesFor = useRef<string | null>(null);
  const userId = user?.id;

  const selected = path[path.length - 1];
  const children = cats.categories.filter((c: any) => c.parent_id === (selected ?? null));
  const currentCats = path.length === 0 ? cats.roots : children;
  const leaf = path.length > 0 && children.length === 0;
  const pathRows = path.map((id) => cats.categories.find((c: any) => c.id === id)).filter(Boolean) as CategoryRow[];
  const cityData = TURKEY_CITIES.find((c) => c.name === city);
  const hoods = (city && district && NEIGHBORHOODS[city]?.[district]) || [];
  const needsPhoto = path[0] === "emlak" || path[0] === "vasita";

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
        setPrice(String(r.listing.price));
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

  if (isPending) return <BrandSpinner fullPage text="Hesap bilgileri doğrulanıyor…" />;
  if (!user) return <RedirectToSignIn />;
  if (!loaded) return <BrandSpinner fullPage text="İlan bilgileri yükleniyor…" />;

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 10 - images.length)) {
      try {
        const data = await compressImage(file);
        setImages((prev) => [...prev, data]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Yükleme hatası");
      }
    }
  }

  async function publish() {
    if (!selected) return;
    if (needsPhoto && images.length < 1) {
      toast.error("Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.");
      return;
    }
    setBusy(true);
    try {
      const result = await saveListing({
        data: {
          id: editId,
          categoryId: selected,
          title,
          description,
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

  const steps = ["Kategori", "Detay", "Fotoğraf", "Önizleme"];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32">
      <h1 className="text-center text-xl font-semibold tracking-tight">{editId ? "İlanı düzenle" : "Ücretsiz ilan ver"}</h1>
      <ol className="mx-auto mt-8 grid max-w-lg grid-cols-4 gap-2">
        {steps.map((s, i) => (
          <li key={s} className="text-center">
            <span
              className={`mx-auto grid size-8 place-items-center rounded-full text-xs font-semibold ${
                i < step ? "bg-ok text-primary-fg" : i === step ? "bg-primary text-primary-fg" : "bg-elevated text-muted"
              }`}
            >
              {i < step ? <Check className="size-4" /> : i + 1}
            </span>
            <p className={`mt-1 text-xs ${i <= step ? "font-medium text-fg" : "text-subtle"}`}>{s}</p>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-surface p-5">
          {pathRows.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-1 text-sm">
              <button type="button" className="text-muted hover:text-fg" onClick={() => setPath([])}>
                Kategori
              </button>
              {pathRows.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1">
                  <span className="text-subtle">/</span>
                  <button type="button" className="text-muted hover:text-fg" onClick={() => setPath(path.slice(0, i + 1))}>
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted">Önce ana kategori, sonra marka / model veya konut tipi.</p>
          )}
          {path.length > 0 ? (
            <button type="button" className="mb-4 text-sm text-muted" onClick={() => setPath((p) => p.slice(0, -1))}>
              ← Geri
            </button>
          ) : null}
          <CategoryButtons
            items={currentCats}
            counts={cats.counts}
            onPick={(c) => {
              const next = [...path, c.id];
              setPath(next);
              const more = cats.categories.some((x: any) => x.parent_id === c.id);
              if (!more) setStep(1);
            }}
          />
          {leaf ? (
            <Button className="mt-4" onClick={() => setStep(1)}>
              Devam
            </Button>
          ) : null}
        </div>
      ) : null}

      {step === 1 ? (
        <form
          className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
        >
          {pathRows.length ? (
            <p className="rounded-md bg-elevated px-3 py-2 text-sm text-muted">{pathRows.map((c) => c.name).join(" → ")}</p>
          ) : null}
          <div>
            <Label htmlFor="listing-title">Başlık</Label>
            <Input id="listing-title" value={title} onChange={(e) => setTitle(e.target.value)} minLength={5} required />
          </div>
          <div>
            <Label htmlFor="listing-price">Fiyat (TL)</Label>
            <Input id="listing-price" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="listing-desc">Açıklama</Label>
            <Textarea id="listing-desc" value={description} onChange={(e) => setDescription(e.target.value)} minLength={10} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>İl</Label>
              <Select value={city} onChange={(e) => { setCity(e.target.value); setDistrict(""); }} required>
                <option value="">Seçin</option>
                {TURKEY_CITIES.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>İlçe</Label>
              <Select value={district} onChange={(e) => setDistrict(e.target.value)} required>
                <option value="">Seçin</option>
                {(cityData?.districts ?? []).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </div>
          </div>
          {hoods.length ? (
            <div>
              <Label>Mahalle</Label>
              <Select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
                <option value="">İsteğe bağlı</option>
                {hoods.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </div>
          ) : null}
          <div>
            <Label>İletişim Telefonu</Label>
            <PhoneInput value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="mt-1 text-xs text-muted">İlanda alıcıların göreceği irtibat numarası (5xx xxx xx xx).</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {attrs
              .filter((a) => a.type !== "MULTI" && a.type !== "BOOLEAN")
              .map((a) => (
                <AttrInput key={a.id} a={a} values={values} setValues={setValues} />
              ))}
          </div>
          {attrs.some((a) => a.type === "BOOLEAN") ? (
            <div>
              <p className="mb-2 text-sm font-medium">Evet / Hayır</p>
              <div className="flex flex-wrap gap-2">
                {attrs
                  .filter((a) => a.type === "BOOLEAN")
                  .map((a) => {
                    const cur = String(values[a.name] ?? "");
                    return (
                      <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs">
                        <span className="text-muted">{a.name}</span>
                        {(a.options ?? evetHayir).map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={`rounded-full px-2 py-0.5 ${cur === o ? "bg-ink text-primary-fg" : "text-muted"}`}
                            onClick={() => setValues((v) => ({ ...v, [a.name]: o }))}
                          >
                            {o}
                          </button>
                        ))}
                      </span>
                    );
                  })}
              </div>
            </div>
          ) : null}
          {attrs
            .filter((a) => a.type === "MULTI")
            .map((a) => (
              <div key={a.id}>
                <Label>
                  {a.name}
                  {a.required ? " *" : ""}
                </Label>
                <p className="mb-2 text-xs text-muted">Birden fazla seçebilirsiniz</p>
                <div className="flex flex-wrap gap-2">
                  {(a.options ?? []).map((o) => {
                    const cur = String(values[a.name] ?? "")
                      .split(", ")
                      .filter(Boolean);
                    const on = cur.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                        onClick={() => {
                          const next = on ? cur.filter((x) => x !== o) : [...cur, o];
                          setValues((v) => ({ ...v, [a.name]: next.join(", ") }));
                        }}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              Geri
            </Button>
            <Button type="submit">Devam</Button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="mt-8 rounded-xl border border-border bg-surface p-5">
          <Label>Fotoğraflar (en fazla 10)</Label>
          <p className="mt-1 text-sm text-muted">
            Görseller 4:3’e alınır, sıkıştırılır ve arkaya GeldeSat filigranı eklenir.
          </p>
          {needsPhoto ? (
            <p className="mt-1 text-sm text-muted">Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.</p>
          ) : (
            <p className="mt-1 text-sm text-muted">Fotoğraf önerilir; diğer kategorilerde isteğe bağlıdır.</p>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-2 text-sm" onChange={(e) => void onFiles(e.target.files)} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {images.map((im, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-elevated">
                <img src={im} alt="" className="size-full object-cover" />
                {i === 0 ? (
                  <span className="absolute bottom-0 w-full bg-ink/80 py-0.5 text-center text-[10px] text-primary-fg">Kapak</span>
                ) : (
                  <button
                    type="button"
                    className="absolute bottom-0 w-full bg-ink/70 py-0.5 text-center text-[10px] text-primary-fg"
                    onClick={() => setImages((prev) => [prev[i], ...prev.filter((_, j) => j !== i)])}
                  >
                    Kapak yap
                  </button>
                )}
                <button type="button" className="absolute right-1 top-1 rounded-full bg-ink px-1.5 text-xs text-primary-fg" onClick={() => setImages(images.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Geri
            </Button>
            <Button
              onClick={() => {
                if (needsPhoto && images.length < 1) {
                  toast.error("Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.");
                  return;
                }
                setStep(3);
              }}
            >
              Önizleme
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-5">
          <p className="font-display text-2xl font-semibold">{formatPrice(Number(price) || 0)}</p>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted">
            {city} / {district} {neighborhood}
          </p>
          <p className="whitespace-pre-wrap text-sm">{description}</p>
          {Object.keys(values).length > 0 ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(values).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {images[0] ? <img src={images[0]} alt="" className="max-h-64 rounded-lg object-cover" /> : null}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Geri
            </Button>
            <Button disabled={busy} onClick={() => void publish()}>
              {busy ? "Kaydediliyor…" : editId ? "Kaydet" : "Yayınla"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
