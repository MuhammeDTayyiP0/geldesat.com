import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getMe, updateProfile } from "@/lib/server/account";
import { authClient } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { PHOTO_ACCEPT } from "@/lib/images";
import { removeAvatar, uploadAvatar } from "@/lib/listing-photos";
import { cleanPhone, maskPhone10 } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { AccountShell, UserAvatar } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/profil")({
  head: () => ({ meta: [{ title: "Profil bilgileri | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ProfileSettings,
});

type Form = { name: string; phone: string; city: string; district: string; bio: string };
const EMPTY: Form = { name: "", phone: "", city: "", district: "", bio: "" };

function ProfileSettings() {
  const { user, isPending } = useCurrentUserState();
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getMe()
      .then((m) => {
        const p = m.profile;
        const loaded: Form = {
          name: p?.display_name ?? "",
          phone: maskPhone10(p?.phone ?? ""),
          city: p?.city ?? "",
          district: p?.district ?? "",
          bio: p?.bio ?? "",
        };
        setSaved(loaded);
        setForm(loaded);
        setAvatar(p?.avatar_url ?? user.profileImageUrl);
      })
      .catch(() => toast.error("Profil yüklenemedi"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per signed-in user
  }, [user?.id]);

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
      await updateProfile({ data: { display_name: name, phone: cleanPhone(form.phone), bio: form.bio.trim(), city: form.city, district: form.district } });
      // Keep the sign-in record (header, menus) in step with the profile name.
      await authClient.updateUser({ name }).catch(() => undefined);
      setSaved(form);
      toast.success("Profil bilgileri kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const url = await uploadAvatar(file);
      await authClient.updateUser({ image: url }).catch(() => undefined);
      setAvatar(url);
      toast.success("Profil fotoğrafı güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fotoğraf yüklenemedi");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemovePhoto() {
    setPhotoBusy(true);
    try {
      await removeAvatar();
      await authClient.updateUser({ image: null }).catch(() => undefined);
      setAvatar(null);
      toast.success("Profil fotoğrafı kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaldırılamadı");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <AccountShell title="Profil bilgileri" description="Alıcıların satıcı profilinizde gördüğü bilgiler.">
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
            <p className="font-medium">Profil fotoğrafı</p>
            <p className="mt-0.5 text-xs text-muted">Kare kırpılır; JPEG, PNG, WebP veya HEIC.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={PHOTO_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  void onPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button type="button" size="sm" variant="outline" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" /> {avatar ? "Değiştir" : "Fotoğraf ekle"}
              </Button>
              {avatar ? (
                <Button type="button" size="sm" variant="ghost" disabled={photoBusy} onClick={() => void onRemovePhoto()} className="text-danger hover:bg-danger/8">
                  <Trash2 className="size-4" /> Kaldır
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <form onSubmit={onSave} className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div>
            <Label htmlFor="pf-name">Ad soyad veya görünen ad</Label>
            <Input id="pf-name" value={form.name} onChange={(e) => set({ name: e.target.value })} minLength={2} maxLength={60} required autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="pf-phone">Telefon</Label>
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
                Hakkımda
              </Label>
              <span className="text-xs tabular-nums text-subtle">{form.bio.length}/400</span>
            </div>
            <Textarea
              id="pf-bio"
              value={form.bio}
              onChange={(e) => set({ bio: e.target.value.slice(0, 400) })}
              placeholder="Kendinizi veya işinizi kısaca tanıtın"
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
      </div>
    </AccountShell>
  );
}
