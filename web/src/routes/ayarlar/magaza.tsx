import { ErrorState } from "@/components/common/ErrorState";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Clock, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getMe, myStoreApplication, submitStoreApplication, type StoreApplicationRow } from "@/lib/server/account";
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
import { cleanPhone, formatDate, maskPhone10 } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/magaza")({
  head: () => ({
    meta: [{ title: "Kurumsal Hesaba Geç | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: CorporateUpgradePage,
});

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

function CorporateUpgradePage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [loaded, setLoaded] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [listingLimit, setListingLimit] = useState<{ used: number; max: number; isCorporate: boolean } | null>(null);
  const [application, setApplication] = useState<StoreApplicationRow | null>(null);
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
  const [appBusy, setAppBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMe()
      .then(async (m) => {
        if (cancelled) return;
        if (m.store) {
          void navigate({ to: "/ayarlar/profil", replace: true });
          return;
        }
        setEmailVerified(Boolean(m.emailVerified));
        setListingLimit(m.listingLimit ?? null);
        const app = await myStoreApplication().catch(() => null);
        if (cancelled) return;
        setApplication(app);
        setAppForm((prev) => ({
          ...prev,
          city: prev.city || m.profile?.city || "",
          phone: prev.phone || maskPhone10(m.profile?.phone ?? ""),
        }));
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
      <AccountShell title="Kurumsal Hesaba Geç">
        <ErrorState
          message="Bilgiler yüklenemedi. Tekrar deneyin."
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

  const setApp = (patch: Partial<ApplicationForm>) => setAppForm((f) => ({ ...f, ...patch }));

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

  const cooldownActive = Boolean(application?.cooldown_until && Date.parse(application.cooldown_until) > Date.now());
  const remainingCooldownDays =
    cooldownActive && application?.cooldown_until
      ? Math.max(1, Math.ceil((Date.parse(application.cooldown_until) - Date.now()) / 86_400_000))
      : 0;

  return (
    <AccountShell
      title="Kurumsal Hesaba Geç"
      description="İşletmeniz için kurumsal mağaza vitrini ve yüksek ilan limiti talep edin."
    >
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
            Başvurunuz onaylandığında mevcut hesabınız <strong className="text-fg">Kurumsal</strong> türe dönüşür; profiliniz, mağaza vitrininiz,{" "}
            <strong className="text-fg">50+ aktif ilan</strong> hakkı ve toplu ilan aktarımı tek hesap altında açılır.
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
                  {application.business_type ? <span>Tür: {BUSINESS_TYPE_LABELS[application.business_type]}</span> : null}
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
                <p className="mt-1 text-sm text-muted">Profilinizi düzenlemek için profil bilgileri sayfasına geçebilirsiniz.</p>
                <Link to="/ayarlar/profil" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}>
                  Profil ve mağaza bilgilerine git →
                </Link>
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
          <form onSubmit={onApplicationSubmit} className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Store className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Kurumsal Başvuru Formu</h2>
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
    </AccountShell>
  );
}
