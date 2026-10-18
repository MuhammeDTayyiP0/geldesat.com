import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getMe, updateProfile, upsertStore } from "@/lib/server/account";
import { deleteSavedSearch, mySavedSearches } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authClient, signOut } from "@/lib/auth/client";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { cleanPhone, maskPhone10 } from "@/lib/utils";
import { Bell, CheckCircle2, Heart, LayoutGrid, Lock, LogOut, Mail, MapPin, MessageCircle, Settings2, Shield, Store, User as UserIcon } from "lucide-react";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { toast } from "sonner";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profilim | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Profil,
});

function Profil() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Awaited<ReturnType<typeof getMe>> | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof mySavedSearches>>>([]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  const initializedRef = useRef(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    void getMe().then((m) => {
      setMe(m);
      if (!initializedRef.current) {
        setName(m.profile?.display_name ?? "");
        setPhone(maskPhone10(m.profile?.phone ?? ""));
        setBio(m.profile?.bio ?? "");
        setCity(m.profile?.city ?? "");
        setStoreName(m.store?.name ?? "");
        initializedRef.current = true;
      }
    });
    void mySavedSearches().then(setSaved).catch(() => setSaved([]));
  }, [userId]);

  if (isPending || (!me && user)) return <BrandSpinner fullPage text="Profiliniz yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    try {
      await updateProfile({ data: { display_name: name, phone: cleanPhone(phone), bio, city } });
      toast.success("Profil bilgileri kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profil kaydedilemedi");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Yeni şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifreler eşleşmiyor.");
      return;
    }
    setPwdBusy(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) throw new Error(error.message || "Şifre değiştirilemedi");
      toast.success("Şifreniz başarıyla güncellendi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hesabım</h1>
          <p className="mt-1 text-sm text-muted">{user.primaryEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="#account-settings" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-elevated">
            <Settings2 className="size-4 text-primary" /> Ayarlar
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-muted hover:text-danger hover:border-danger/30"
            onClick={() => {
              if (confirm("Çıkış yapmak istediğinize emin misiniz?")) {
                void signOut("/");
              }
            }}
          >
            <LogOut className="size-4" /> Çıkış Yap
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xl font-semibold text-fg">{me?.profile?.active_count ?? 0}</p>
          <p className="text-xs text-muted">Aktif İlan</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xl font-semibold text-fg">{me?.profile?.rating_avg ? me.profile.rating_avg.toFixed(1) : "—"}</p>
          <p className="text-xs text-muted">Satıcı Puanı</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AccountShortcut to="/ilanlarim" icon={LayoutGrid} label="İlanlarım" />
        <AccountShortcut to="/favoriler" icon={Heart} label="Favorilerim" />
        <AccountShortcut to="/mesajlar" icon={MessageCircle} label="Mesajlarım" />
        <AccountShortcut to="/bildirimler" icon={Bell} label="Bildirimler" />
        <AccountShortcut to="/harita" icon={MapPin} label="Haritada keşfet" />
      </div>

      {/* Profil Bilgileri Formu */}
      <form
        id="account-settings"
        className="mt-8 scroll-mt-24 space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
        onSubmit={handleSaveProfile}
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <UserIcon className="size-5 text-primary" />
          <h2 className="font-semibold text-fg">Kişisel Bilgiler</h2>
        </div>

        <div>
          <Label htmlFor="profile-name">Ad Soyad</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adınız ve soyadınız"
            required
          />
        </div>

        <div>
          <Label htmlFor="profile-phone">Telefon Numarası</Label>
          <PhoneInput
            id="profile-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">İlanlarınızda ve alıcılarla iletişimde kullanılır (5xx xxx xx xx).</p>
        </div>

        <div>
          <Label htmlFor="profile-city">Şehir</Label>
          <Select id="profile-city" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Şehir Seçin</option>
            {TURKEY_CITIES.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="profile-bio">Hakkında</Label>
          <Textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Satıcı profilinizde görünecek kısa bir tanıtım yazın..."
            rows={3}
          />
        </div>

        <Button type="submit" disabled={profileBusy}>
          {profileBusy ? "Kaydediliyor…" : "Bilgileri Kaydet"}
        </Button>
      </form>

      {/* Hesap & Güvenlik Ayarları */}
      <div className="mt-8 space-y-6 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Shield className="size-5 text-primary" />
          <h2 className="font-semibold text-fg">E-posta ve Güvenlik Ayarları</h2>
        </div>

        {/* E-posta Bilgisi */}
        <div className="rounded-lg border border-border bg-bg/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="size-5 text-muted" />
              <div>
                <p className="text-xs text-muted">Kayıtlı Giriş E-postası</p>
                <p className="text-sm font-medium text-fg">{user.primaryEmail}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> Doğrulanmış Hesap
            </span>
          </div>
        </div>

        {/* Şifre Değiştirme */}
        <form onSubmit={handleChangePassword} className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted" />
            <h3 className="text-sm font-medium text-fg">Şifre Değiştir</h3>
          </div>

          <div>
            <Label htmlFor="curr-pwd">Mevcut Şifre</Label>
            <Input
              id="curr-pwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Mevcut şifreniz"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-pwd">Yeni Şifre</Label>
              <Input
                id="new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
                required
                minLength={8}
              />
            </div>
            <div>
              <Label htmlFor="confirm-pwd">Yeni Şifre (Tekrar)</Label>
              <Input
                id="confirm-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifrenizi doğrulayın"
                required
                minLength={8}
              />
            </div>
          </div>

          <Button type="submit" variant="outline" disabled={pwdBusy || !currentPassword || !newPassword}>
            {pwdBusy ? "Değiştiriliyor…" : "Şifreyi Güncelle"}
          </Button>
        </form>
      </div>

      {/* Mağaza Ayarları */}
      <form
        className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const s = await upsertStore({ data: { name: storeName, description: storeDesc, city, phone: cleanPhone(phone) } });
            toast.success("Mağaza bilgileri güncellendi");
            setMe((m) =>
              m ? { ...m, store: { id: s.id, name: storeName, slug: s.slug, plan: m.store?.plan ?? "BASIC", city } } : m,
            );
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Hata oluştu");
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Store className="size-5 text-primary" />
          <h2 className="font-semibold text-fg">Kurumsal Mağaza</h2>
        </div>
        <p className="text-sm text-muted">İlanlarınız mağaza sayfanızda özel bir vitrinde toplanır.</p>

        <div>
          <Label htmlFor="store-name">Mağaza Adı</Label>
          <Input
            id="store-name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Mağaza adı"
            required
          />
        </div>

        <div>
          <Label htmlFor="store-desc">Mağaza Açıklaması</Label>
          <Textarea
            id="store-desc"
            value={storeDesc}
            onChange={(e) => setStoreDesc(e.target.value)}
            placeholder="Müşterilerinize işletmeniz hakkında bilgi verin..."
            rows={2}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" variant="outline">
            {me?.store ? "Mağazayı Güncelle" : "Mağaza Aç"}
          </Button>
          {me?.store ? (
            <Link to="/magaza/$slug" params={{ slug: me.store.slug }} className="text-sm text-primary hover:underline">
              Mağazayı Gör →
            </Link>
          ) : null}
        </div>
      </form>

      {/* Kayıtlı Aramalar */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <h2 className="font-semibold text-fg">Kayıtlı Aramalar</h2>
        <p className="mt-1 text-sm text-muted">Kriterlerinize uyan yeni bir ilan eklendiğinde bildirim alırsınız.</p>
        {saved.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
            Henüz kayıtlı aramanız bulunmuyor. Arama sayfasından “Aramayı Kaydet” diyebilirsiniz.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {saved.map((s) => {
              let href = `/search?q=${encodeURIComponent(s.query)}`;
              try {
                const f = JSON.parse(s.filters) as Record<string, string>;
                const params = new URLSearchParams();
                for (const [k, v] of Object.entries(f)) {
                  if (v) params.set(k, String(v));
                }
                const q = params.toString();
                if (q) href = `/search?${q}`;
              } catch {
                /* keep href */
              }
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <a href={href} className="min-w-0 truncate text-sm font-medium hover:text-primary">
                    {s.label || s.query || "Kayıtlı Arama"}
                  </a>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-danger hover:underline"
                    onClick={() =>
                      void deleteSavedSearch({ data: { id: s.id } }).then(() =>
                        setSaved((prev) => prev.filter((x) => x.id !== s.id)),
                      )
                    }
                  >
                    Sil
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </div>
  );
}

function AccountShortcut({ to, icon: Icon, label }: { to: "/ilanlarim" | "/favoriler" | "/mesajlar" | "/bildirimler" | "/harita"; icon: typeof LayoutGrid; label: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-fg shadow-sm transition-colors hover:border-primary/30 hover:bg-elevated">
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
