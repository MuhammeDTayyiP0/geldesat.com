import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminListings,
  adminOverview,
  adminReports,
  adminUsers,
  resolveReport,
  saveSiteSettings,
  setListingStatus,
  setUserRole,
} from "@/lib/server/account";
import { getSiteSettings, listCategories } from "@/lib/server/catalog";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryAdminTree } from "@/components/listing/CategoryAdminTree";
import { formatDate, formatPrice, listingStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import type { CategoryRow } from "@/lib/server/helpers";
import {
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Check,
  X,
  Filter,
} from "lucide-react";

export const Route = createFileRoute("/admin")({ component: Admin });

const STAT_LABELS: Record<string, string> = {
  listings: "Toplam ilan",
  pending: "Onay bekleyen",
  active: "Yayında",
  users: "Üye",
  reports: "Açık şikayet",
  stores: "Mağaza",
};

const TABS = ["ozet", "ilan", "sikayet", "uye", "kategori", "site"] as const;
type Tab = (typeof TABS)[number];

type ListingStatusFilter = "ALL" | "PENDING" | "ACTIVE" | "REJECTED";

const QUICK_REJECT_REASONS = [
  "Yasaklı veya mevzuata aykırı ürün/içerik",
  "Hatalı, eksik veya uyumsuz kategori seçimi",
  "Yanıltıcı veya sembolik fiyat girişi",
  "Görseller yetersiz, kalitesiz veya telifli",
  "Başlık veya açıklamada iletişim bilgisi kural ihlali",
];

function tabLabel(t: Tab) {
  return t === "ozet"
    ? "Özet"
    : t === "ilan"
      ? "İlanlar"
      : t === "sikayet"
        ? "Şikayetler"
        : t === "uye"
          ? "Üyeler"
          : t === "kategori"
            ? "Kategoriler"
            : "Site Ayarları";
}

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("ozet");
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [listings, setListings] = useState<Awaited<ReturnType<typeof adminListings>>>([]);
  const [listingFilter, setListingFilter] = useState<ListingStatusFilter>("ALL");
  const [reports, setReports] = useState<Awaited<ReturnType<typeof adminReports>>>([]);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof adminUsers>>>([]);
  
  // Site settings state (IBAN and bank info are optional and won't be wiped)
  const [company, setCompany] = useState("GeldeSat");
  const [supportEmail, setSupportEmail] = useState("destek@geldesat.com");
  const [supportPhone, setSupportPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [savingSite, setSavingSite] = useState(false);

  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [err, setErr] = useState("");

  // Rejection modal state
  const [rejectingListing, setRejectingListing] = useState<Awaited<ReturnType<typeof adminListings>>[number] | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Role change confirmation state
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    userId: string;
    displayName: string;
    currentRole: string;
    newRole: "ADMIN" | "USER";
  } | null>(null);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  async function loadOverview() {
    try {
      const s = await adminOverview();
      setStats(s as Record<string, number>);
      setErr("");
    } catch {
      setErr("Yönetici değilsiniz veya oturumunuz sonlandı.");
    }
  }

  const userId = user?.id;
  useEffect(() => {
    if (userId) void loadOverview();
  }, [userId]);

  function fetchListings(statusFilter: ListingStatusFilter) {
    const statusParam = statusFilter === "ALL" ? undefined : statusFilter;
    return adminListings({ data: { status: statusParam } }).then(setListings);
  }

  useEffect(() => {
    if (!userId || err) return;
    if (tab === "ilan") {
      void fetchListings(listingFilter);
    }
    if (tab === "sikayet") void adminReports().then(setReports);
    if (tab === "uye") void adminUsers().then(setUsers);
    if (tab === "kategori") {
      void listCategories().then((d) => setCats(d.categories));
    }
    if (tab === "site") {
      void getSiteSettings().then((s) => {
        setCompany(s.company_name);
        setSupportEmail(s.support_email);
        setSupportPhone(s.support_phone);
        setBankName(s.bank_name || "");
        setAccountHolder(s.account_holder || "");
        setIban(s.iban || "");
      });
    }
  }, [tab, userId, err, listingFilter]);

  async function handleApproveListing(id: string) {
    setIsSubmittingAction(true);
    try {
      await setListingStatus({ data: { id, status: "ACTIVE" } });
      toast.success("İlan başarıyla onaylandı ve yayına alındı.");
      await fetchListings(listingFilter);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Onaylama sırasında bir hata oluştu.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleConfirmReject() {
    if (!rejectingListing) return;
    const finalReason = customReason.trim() || selectedReason || "İlan yayın politikalarına uygun bulunmadı.";
    setIsSubmittingAction(true);
    try {
      await setListingStatus({
        data: {
          id: rejectingListing.id,
          status: "REJECTED",
          reason: finalReason,
        },
      });
      toast.success("İlan reddedildi ve satıcıya gerekçeli bildirim gönderildi.");
      setRejectingListing(null);
      setSelectedReason("");
      setCustomReason("");
      await fetchListings(listingFilter);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reddetme sırasında bir hata oluştu.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleConfirmRoleChange() {
    if (!roleChangeTarget) return;
    setIsSubmittingRole(true);
    try {
      await setUserRole({
        data: {
          userId: roleChangeTarget.userId,
          role: roleChangeTarget.newRole,
        },
      });
      toast.success(`${roleChangeTarget.displayName} kullanıcısının rolü ${roleChangeTarget.newRole} olarak güncellendi.`);
      setRoleChangeTarget(null);
      await adminUsers().then(setUsers);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rol değiştirilemedi.");
    } finally {
      setIsSubmittingRole(false);
    }
  }

  if (isPending) return <p className="p-10 text-center text-muted">Yükleniyor…</p>;
  if (!user) return <RedirectToSignIn />;
  
  // Professional 403 Forbidden Screen
  if (err) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <ShieldAlert className="size-8" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Yetkisiz Erişim</h1>
          <p className="mt-2 text-sm text-muted">
            {err || "Bu sayfaya yalnızca yönetici yetkisine sahip hesaplar erişebilir."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/">
              <Button variant="ink" className="w-full sm:w-auto">
                Ana Sayfaya Dön
              </Button>
            </Link>
            <Link to="/profil">
              <Button variant="outline" className="w-full sm:w-auto">
                Profilime Git
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yönetim Paneli</h1>
          <p className="text-sm text-muted">Site operasyonları, ilan moderasyonu ve üye yönetimi</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "ink" : "outline"} onClick={() => setTab(t)}>
            {tabLabel(t)}
          </Button>
        ))}
      </div>

      {/* Özet Sekmesi */}
      {tab === "ozet" && stats ? (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Object.entries(stats)
              .filter(([k]) => STAT_LABELS[k])
              .map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {STAT_LABELS[k] ?? k}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight">{v}</p>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* İlanlar Sekmesi */}
      {tab === "ilan" ? (
        <div className="mt-6 space-y-4">
          {/* Durum Filtreleri */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface p-1 text-xs">
              <Filter className="ml-2 size-3.5 text-muted" />
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  listingFilter === "ALL" ? "bg-ink text-surface" : "text-muted hover:text-fg"
                }`}
                onClick={() => setListingFilter("ALL")}
              >
                Tümü
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  listingFilter === "PENDING" ? "bg-amber-600 text-white" : "text-muted hover:text-fg"
                }`}
                onClick={() => setListingFilter("PENDING")}
              >
                Onay Bekleyenler
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  listingFilter === "ACTIVE" ? "bg-emerald-600 text-white" : "text-muted hover:text-fg"
                }`}
                onClick={() => setListingFilter("ACTIVE")}
              >
                Yayındakiler
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  listingFilter === "REJECTED" ? "bg-rose-600 text-white" : "text-muted hover:text-fg"
                }`}
                onClick={() => setListingFilter("REJECTED")}
              >
                Reddedilenler
              </button>
            </div>
            <p className="text-xs text-muted tabular-nums">Toplam {listings.length} ilan gösteriliyor</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="p-3.5">İlan</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5">Satıcı</th>
                  <th className="p-3.5">Fiyat</th>
                  <th className="p-3.5">Durum</th>
                  <th className="p-3.5">Tarih</th>
                  <th className="p-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      Bu filtreye uygun ilan bulunamadı.
                    </td>
                  </tr>
                ) : (
                  listings.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-elevated/40">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          {l.images && l.images[0] ? (
                            <img
                              src={l.images[0]}
                              alt=""
                              className="size-10 shrink-0 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="size-10 shrink-0 rounded-lg bg-muted/20 border border-border flex items-center justify-center text-xs text-muted">
                              Foto Yok
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              to="/ilan/$slug"
                              params={{ slug: l.slug }}
                              target="_blank"
                              className="inline-flex items-center gap-1 font-medium hover:underline text-fg"
                            >
                              <span className="truncate max-w-[220px]">{l.title}</span>
                              <ExternalLink className="size-3 text-muted shrink-0" />
                            </Link>
                            <p className="text-xs font-mono text-muted">No: {l.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-muted">{l.category_name ?? "—"}</td>
                      <td className="p-3.5">
                        <Link to="/satici/$id" params={{ id: l.user_id }} target="_blank" className="hover:underline text-fg font-medium">
                          {l.seller_name || "Üye"}
                        </Link>
                      </td>
                      <td className="p-3.5 font-medium tabular-nums">{formatPrice(l.price)}</td>
                      <td className="p-3.5">
                        <Badge
                          tone={
                            l.status === "ACTIVE"
                              ? "ok"
                              : l.status === "PENDING"
                                ? "warn"
                                : l.status === "REJECTED"
                                  ? "danger"
                                  : "muted"
                          }
                        >
                          {listingStatusLabel(l.status)}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-xs text-muted tabular-nums">{formatDate(l.created_at)}</td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to="/ilan-ver" search={{ id: l.id }} target="_blank">
                            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                              Düzenle
                            </Button>
                          </Link>
                          {l.status !== "ACTIVE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border-emerald-300"
                              disabled={isSubmittingAction}
                              onClick={() => void handleApproveListing(l.id)}
                            >
                              <Check className="size-3.5 mr-1" /> Onay
                            </Button>
                          )}
                          {l.status !== "REJECTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 border-rose-300"
                              disabled={isSubmittingAction}
                              onClick={() => {
                                setRejectingListing(l);
                                setSelectedReason(QUICK_REJECT_REASONS[0]);
                                setCustomReason("");
                              }}
                            >
                              <X className="size-3.5 mr-1" /> Red
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Şikayetler Sekmesi */}
      {tab === "sikayet" ? (
        <div className="mt-6 space-y-3">
          {reports.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted">
              Bekleyen veya açık şikayet bulunmuyor.
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-surface p-5 text-sm space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="warn">
                        {r.reason}
                      </Badge>
                      <span className="text-xs text-muted tabular-nums">{formatDate(r.created_at)}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs text-muted">Şikayet Edilen İlan: </span>
                      <Link
                        to="/ilan/$slug"
                        params={{ slug: r.slug }}
                        target="_blank"
                        className="font-medium hover:underline text-fg inline-flex items-center gap-1"
                      >
                        {r.title}
                        <ExternalLink className="size-3 text-muted" />
                      </Link>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Şikayet Eden: <span className="text-fg font-medium">{r.reporter_name}</span>
                    </p>
                  </div>
                  {r.status === "OPEN" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        resolveReport({ data: { id: r.id, status: "CLOSED" } }).then(() => {
                          toast.success("Şikayet kapatıldı");
                          void adminReports().then(setReports);
                        })
                      }
                    >
                      Şikayeti Kapat
                    </Button>
                  ) : (
                    <Badge tone="muted">Kapatıldı</Badge>
                  )}
                </div>

                {r.details && (
                  <div className="rounded-lg bg-elevated p-3 text-xs text-subtle border border-border">
                    <span className="font-semibold text-fg">Şikayet Detayı: </span>
                    {r.details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* Üyeler Sekmesi */}
      {tab === "uye" ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {users.map((u) => {
              const isSelf = u.user_id === user?.id;
              return (
                <li key={u.user_id} className="flex flex-wrap items-center justify-between p-4 text-sm gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link to="/satici/$id" params={{ id: u.user_id }} target="_blank" className="font-medium hover:underline text-fg inline-flex items-center gap-1">
                        {u.display_name}
                        <ExternalLink className="size-3 text-muted" />
                      </Link>
                      {isSelf && (
                        <Badge tone="ink">
                          Siz
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      Rol: <span className="font-semibold text-fg">{u.role}</span> · {u.listing_count} ilan
                      {u.city ? ` · ${u.city}` : ""}
                      {u.created_at ? ` · Kayıt: ${formatDate(u.created_at)}` : ""}
                    </p>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSelf}
                      title={isSelf ? "Kendi yöneticilik rolünüzü değiştiremezsiniz" : "Rolü değiştir"}
                      onClick={() => {
                        setRoleChangeTarget({
                          userId: u.user_id,
                          displayName: u.display_name,
                          currentRole: u.role,
                          newRole: u.role === "ADMIN" ? "USER" : "ADMIN",
                        });
                      }}
                    >
                      {u.role === "ADMIN" ? "Yöneticilikten Çıkar (USER)" : "Yönetici Yap (ADMIN)"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Kategori Sekmesi */}
      {tab === "kategori" ? (
        <CategoryAdminTree
          categories={cats}
          onRefresh={() => listCategories().then((d) => setCats(d.categories))}
        />
      ) : null}

      {/* Site Ayarları Sekmesi (IBAN ve Banka İsteğe Bağlı) */}
      {tab === "site" ? (
        <form
          className="mt-6 max-w-xl space-y-5 rounded-xl border border-border bg-surface p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setSavingSite(true);
            saveSiteSettings({
              data: {
                company_name: company.trim() || "GeldeSat",
                iban: iban.trim(),
                bank_name: bankName.trim(),
                account_holder: accountHolder.trim(),
                support_email: supportEmail.trim() || "destek@geldesat.com",
                support_phone: supportPhone.trim(),
              },
            })
              .then(() => toast.success("Site ayarları başarıyla kaydedildi"))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Kaydedilemedi"))
              .finally(() => setSavingSite(false));
          }}
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Genel ve İletişim Bilgileri</h2>
            <p className="text-xs text-muted mt-1">Bu bilgiler web sitesinin alt bilgi ve destek alanlarında görüntülenir.</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Firma / Platform Unvanı</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={80}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Destek E-Posta Adresi</Label>
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                maxLength={80}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Destek Telefon Numarası</Label>
              <Input
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="05xx xxx xx xx"
                maxLength={20}
                className="mt-1"
              />
            </div>
          </div>

          {/* Opsiyonel Banka / Havale Bilgileri (İsteğe bağlı, boş bırakılabilir) */}
          <div className="border-t border-border pt-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-fg">Banka & Havale Bilgileri (İsteğe Bağlı)</h3>
              <p className="text-xs text-muted mt-0.5">
                Kullanmıyorsanız bu alanları tamamen boş bırakabilirsiniz. Boş bırakıldığında herhangi bir işlem yapılmaz veya zorunluluk istenmez.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Banka Adı (Opsiyonel)</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Örn: Ziraat Bankası"
                  maxLength={80}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Hesap Sahibi (Opsiyonel)</Label>
                <Input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Örn: GeldeSat Bilişim A.Ş."
                  maxLength={80}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>IBAN Numarası (Opsiyonel - Boş Bırakılabilir)</Label>
                <Input
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="TR..."
                  maxLength={40}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={savingSite} className="w-full sm:w-auto">
            {savingSite ? "Kaydediliyor…" : "Ayarları Kaydet"}
          </Button>
        </form>
      ) : null}

      {/* İlan Reddetme Sebebi Diyaloğu */}
      <Dialog
        open={Boolean(rejectingListing)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingAction) {
            setRejectingListing(null);
            setSelectedReason("");
            setCustomReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="size-5" />
              İlanı Reddet
            </DialogTitle>
            <DialogDescription>
              "{rejectingListing?.title}" başlıklı ilan reddedilecek. İlan sahibine gerekçeyi belirten bir bildirim iletilecektir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold text-muted">Hazır Reddetme Gerekçesi Seçin:</Label>
            <div className="space-y-1.5">
              {QUICK_REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedReason(r)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs border transition-colors ${
                    selectedReason === r
                      ? "border-rose-500 bg-rose-50 text-rose-900 font-medium dark:bg-rose-950 dark:text-rose-200"
                      : "border-border hover:bg-elevated text-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <Label className="text-xs font-semibold text-muted">Özel Açıklama / Not (İsteğe Bağlı):</Label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Satıcıya iletmek istediğiniz detaylı red açıklamasını buraya yazabilirsiniz..."
                className="mt-1.5 text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectingListing(null)}
              disabled={isSubmittingAction}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => void handleConfirmReject()}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction ? "İşleniyor…" : "Reddet ve Bildir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kullanıcı Rol Değişimi Onay Modalı */}
      <AlertDialog
        open={Boolean(roleChangeTarget)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingRole) {
            setRoleChangeTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcı Rolü Değiştirilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{roleChangeTarget?.displayName}</strong> adlı kullanıcının mevcut yetkisi{" "}
              <strong>{roleChangeTarget?.currentRole}</strong> iken{" "}
              <strong>{roleChangeTarget?.newRole}</strong> olarak güncellenecektir. Bu işlemi onaylıyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingRole}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmittingRole}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRoleChange();
              }}
            >
              {isSubmittingRole ? "Güncelleniyor…" : "Evet, Rolü Değiştir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
