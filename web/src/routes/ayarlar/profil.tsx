import { ErrorState } from "@/components/common/ErrorState";
import { createFileRoute, Link } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, ExternalLink, Loader2, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getMe, updateProfile } from "@/lib/server/account";
import { authClient } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "@/lib/account-type";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { checkPhotoFile, PHOTO_ACCEPT } from "@/lib/images";
import { removeAvatar, uploadAvatar } from "@/lib/listing-photos";
import { cleanPhone, maskPhone10 } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { AccountShell, UserAvatar } from "@/components/account/AccountShell";
import { AvatarCropperDialog } from "@/components/account/AvatarCropperDialog";

export const Route = createFileRoute("/ayarlar/profil")({
  head: () => ({ meta: [{ title: "Profil bilgileri | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ProfileSettings,
});

type Form = { name: string; phone: string; city: string; district: string; bio: string };
const EMPTY: Form = { name: "", phone: "", city: "", district: "", bio: "" };

type MeData = Awaited<ReturnType<typeof getMe>>;

function ProfileSettings() {
  const { user, isPending } = useCurrentUserState();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [me, setMe] = useState<MeData | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getMe()
      .then((m) => {
        const p = m.profile;
        const s = m.store;
        const loaded: Form = {
          name: s?.name || p?.display_name || "",
          phone: maskPhone10(p?.phone || s?.phone || ""),
          city: p?.city || s?.city || "",
          district: p?.district ?? "",
          bio: p?.bio || s?.description || "",
        };
        setMe(m);
        setSaved(loaded);
        setForm(loaded);
        setAvatar(s?.logo_url ?? p?.avatar_url ?? user.profileImageUrl);
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per signed-in user
  }, [user?.id, retry]);

  if (failed) {
    return (
      <AccountShell title="Profil bilgileri">
        <ErrorState
          message="Profiliniz yüklenemedi. Tekrar deneyin."
          onRetry={() => {
            setFailed(false);
            setRetry((r) => r + 1);
          }}
        />
      </AccountShell>
    );
  }
  if (isPending || (user && !saved)) return <BrandSpinner fullPage text="Profil yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  const districts = TURKEY_CITIES.find((c) => c.name === form.city)?.districts ?? [];
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const name = form.name.trim();
      if (name.length < 2) throw new Error("Adınız en az 2 karakter olmalı.");
      await updateProfile({ data: { display_name: name, phone: cleanPhone(form.phone), bio: form.bio.trim(), city: form.city, district: form.district } });
      // Keep the sign-in record (header, menus) in step with the profile name.
      await authClient.updateUser({ name }).catch(() => undefined);
      setSaved(form);
      toast.success("Profil bilgileri kaydedildi");
    } catch (err) {
      toast.error(errorText(err, "Kaydedilemedi"));
    } finally {
      setBusy(false);
    }
  }

  function onSelectPhoto(file: File | undefined) {
    if (!file) return;
    const problem = checkPhotoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPendingFile(file);
  }

  async function onPhoto(blob: Blob) {
    setPhotoBusy(true);
    try {
      const url = await uploadAvatar(blob);
      setAvatar(url);
      await authClient.getSession({ query: { disableCookieCache: true } }).catch(() => undefined);
      setPendingFile(null);
      toast.success("Profil fotoğrafı güncellendi");
    } catch (err) {
      toast.error(errorText(err, "Fotoğraf yüklenemedi"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemovePhoto() {
    setPhotoBusy(true);
    try {
      await removeAvatar();
      setAvatar(null);
      await authClient.getSession({ query: { disableCookieCache: true } }).catch(() => undefined);
      toast.success("Profil fotoğrafı kaldırıldı");
    } catch (err) {
      toast.error(errorText(err, "Kaldırılamadı"));
    } finally {
      setPhotoBusy(false);
    }
  }

  const store = me?.store ?? null;
  const listingLimit = me?.listingLimit ?? null;
  const isCorporate = Boolean(store);

  return (
    <AccountShell
      title={isCorporate ? "Profil ve mağaza bilgileri" : "Profil bilgileri"}
      description={
        isCorporate
          ? "Vitrininizde, ilanlarınızda ve mesajlarda görünen tek işletme profiliniz."
          : "Alıcıların satıcı profilinizde gördüğü bilgiler."
      }
      actions={
        me ? (
          <Link to="/satici/$id" params={{ id: me.userId }} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">{isCorporate ? "Mağazayı gör" : "Profilimi gör"}</span>
          </Link>
        ) : null
      }
    >
      <div className="space-y-5">
        <section className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div className="relative">
            <UserAvatar src={avatar} name={form.name || "?"} className="size-20 text-2xl" />
            {photoBusy ? (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/40">
                <Loader2 className="size-6 animate-spin text-white" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{isCorporate ? "Mağaza / Profil fotoğrafı" : "Profil fotoğrafı"}</p>
              <Badge tone={isCorporate ? "primary" : "muted"}>{isCorporate ? "Kurumsal" : "Bireysel"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted">Seçtikten sonra kırpıp konumlandırabilirsiniz; JPEG, PNG, WebP veya HEIC.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={PHOTO_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  onSelectPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button type="button" size="sm" variant="outline" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" /> {avatar ? "Değiştir" : "Fotoğraf ekle"}
              </Button>
              {avatar ? (
                <Button type="button" size="sm" variant="ghost" disabled={photoBusy} onClick={() => void onRemovePhoto()} className="text-danger hover:bg-danger-solid/8">
                  <Trash2 className="size-4" /> Kaldır
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <form onSubmit={onSave} className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div>
            <Label htmlFor="pf-name">{isCorporate ? "Mağaza / İşletme adı" : "Ad soyad veya görünen ad"}</Label>
            <Input id="pf-name" value={form.name} onChange={(e) => set({ name: e.target.value })} minLength={2} maxLength={60} required autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="pf-phone">{isCorporate ? "İşletme telefonu" : "Telefon"}</Label>
            <PhoneInput id="pf-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel-national" />
            <p className="mt-1.5 text-xs text-muted">İlanlarda “Telefonu göster” ile paylaşılır. İlan vermek için gereklidir.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pf-city">İl</Label>
              <Select id="pf-city" value={form.city} onChange={(e) => set({ city: e.target.value, district: "" })}>
                <option value="">Seçin</option>
                {TURKEY_CITIES.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pf-district">İlçe</Label>
              <Select id="pf-district" value={form.district} disabled={!form.city} onChange={(e) => set({ district: e.target.value })}>
                <option value="">{form.city ? "Seçin" : "Önce il seçin"}</option>
                {districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <Label htmlFor="pf-bio" className="mb-0">
                {isCorporate ? "İşletme açıklaması" : "Hakkımda"}
              </Label>
              <span className="text-xs tabular-nums text-subtle">{form.bio.length}/400</span>
            </div>
            <Textarea
              id="pf-bio"
              value={form.bio}
              onChange={(e) => set({ bio: e.target.value.slice(0, 400) })}
              placeholder={isCorporate ? "İşletmenizi, çalışma saatlerinizi ve hizmetlerinizi anlatın" : "Kendinizi veya işinizi kısaca tanıtın"}
              rows={4}
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            {dirty ? (
              <Button type="button" variant="ghost" onClick={() => saved && setForm(saved)} disabled={busy}>
                Vazgeç
              </Button>
            ) : null}
            <Button type="submit" disabled={busy || !dirty}>
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>

        {store ? (
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Onaylı İşletme Bilgileri</h2>
              <Badge tone="primary">Paket: {store.plan}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">Bu bilgiler kurumsal başvuru onayından gelir. Değişiklik için destek ekibimizle iletişime geçebilirsiniz.</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {store.business_type ? (
                <div>
                  <dt className="text-xs text-muted">İşletme türü</dt>
                  <dd className="font-medium">{BUSINESS_TYPE_LABELS[store.business_type as BusinessType] ?? store.business_type}</dd>
                </div>
              ) : null}
              {store.sector ? (
                <div>
                  <dt className="text-xs text-muted">Sektör</dt>
                  <dd className="font-medium">{store.sector}</dd>
                </div>
              ) : null}
              {store.tax_office ? (
                <div>
                  <dt className="text-xs text-muted">Vergi dairesi</dt>
                  <dd className="font-medium">{store.tax_office}</dd>
                </div>
              ) : null}
              {store.tax_no ? (
                <div>
                  <dt className="text-xs text-muted">VKN / TCKN</dt>
                  <dd className="font-mono font-medium">{store.tax_no}</dd>
                </div>
              ) : null}
              {listingLimit ? (
                <div>
                  <dt className="text-xs text-muted">Aktif ilan hakkı</dt>
                  <dd className="font-medium">
                    {listingLimit.used} / {listingLimit.max}
                  </dd>
                </div>
              ) : null}
              {store.address ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">Açık işletme adresi</dt>
                  <dd className="font-medium">{store.address}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Store className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Kurumsal Hesaba Geç</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Bireysel hesapta en fazla {listingLimit?.max ?? 5} aktif ilan yayınlayabilirsiniz. İşletme başvurusuyla kurumsal rozet ve 50+ ilan hakkı açılır.
                </p>
              </div>
            </div>
            <Link to="/ayarlar/magaza" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Başvuru yap →
            </Link>
          </section>
        )}
      </div>
      <AvatarCropperDialog
        file={pendingFile}
        shape="circle"
        title="Profil fotoğrafını düzenle"
        busy={photoBusy}
        onCancel={() => setPendingFile(null)}
        onConfirm={onPhoto}
      />
    </AccountShell>
  );
}
