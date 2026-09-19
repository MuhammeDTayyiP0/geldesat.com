import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  adminCreditOrders,
  adminDeleteUser,
  adminListings,
  adminOverview,
  adminReports,
  adminUsers,
  deleteListing,
  resolveCreditOrder,
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
import { PhoneInput } from "@/components/ui/phone-input";
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
import { cleanPhone, formatDate, formatPhone, formatPrice, listingStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import type { CategoryRow } from "@/lib/server/helpers";
import {
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Check,
  X,
  Filter,
  LayoutDashboard,
  Package,
  Users,
  CreditCard,
  FolderTree,
  Settings,
  Search,
  Trash2,
  Eye,
  ArrowLeft,
  Menu,
  Clock,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/admin")({ component: Admin });

const TABS = [
  { id: "ozet", label: "Genel Bakış", icon: LayoutDashboard },
  { id: "ilan", label: "İlan Moderasyonu", icon: Package },
  { id: "uye", label: "Kullanıcı Yönetimi", icon: Users },
  { id: "finans", label: "Doping & Finans", icon: CreditCard },
  { id: "sikayet", label: "Şikayet Masası", icon: ShieldAlert },
  { id: "kategori", label: "Kategori Ağacı", icon: FolderTree },
  { id: "site", label: "Site Ayarları", icon: Settings },
] as const;

type Tab = (typeof TABS)[number]["id"];

type ListingStatusFilter = "ALL" | "PENDING" | "ACTIVE" | "REJECTED";
type UserRoleFilter = "ALL" | "ADMIN" | "USER";
type CreditOrderStatusFilter = "ALL" | "PENDING" | "PAID" | "REJECTED";
type ReportStatusFilter = "ALL" | "OPEN" | "CLOSED";

const QUICK_REJECT_REASONS = [
  "Yasaklı veya mevzuata aykırı ürün/içerik",
  "Hatalı, eksik veya uyumsuz kategori seçimi",
  "Yanıltıcı veya sembolik fiyat girişi",
  "Görseller yetersiz, kalitesiz veya telifli",
  "Başlık veya açıklamada iletişim bilgisi kural ihlali",
];

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("ozet");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  // Listings state
  const [listings, setListings] = useState<Awaited<ReturnType<typeof adminListings>>>([]);
  const [listingFilter, setListingFilter] = useState<ListingStatusFilter>("ALL");
  const [listingSearch, setListingSearch] = useState("");

  // Users state
  const [users, setUsers] = useState<Awaited<ReturnType<typeof adminUsers>>>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>("ALL");

  // Finance / Credit orders state
  const [creditOrders, setCreditOrders] = useState<Awaited<ReturnType<typeof adminCreditOrders>>>([]);
  const [creditOrderFilter, setCreditOrderFilter] = useState<CreditOrderStatusFilter>("ALL");

  // Reports state
  const [reports, setReports] = useState<Awaited<ReturnType<typeof adminReports>>>([]);
  const [reportFilter, setReportFilter] = useState<ReportStatusFilter>("ALL");

  // Categories & Settings
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [company, setCompany] = useState("GeldeSat");
  const [supportEmail, setSupportEmail] = useState("destek@geldesat.com");
  const [supportPhone, setSupportPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [savingSite, setSavingSite] = useState(false);

  const [err, setErr] = useState("");

  // Modal / Action target states
  const [rejectingListing, setRejectingListing] = useState<Awaited<ReturnType<typeof adminListings>>[number] | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const [deletingListing, setDeletingListing] = useState<Awaited<ReturnType<typeof adminListings>>[number] | null>(null);
  const [previewListing, setPreviewListing] = useState<Awaited<ReturnType<typeof adminListings>>[number] | null>(null);

  const [deletingUser, setDeletingUser] = useState<{
    userId: string;
    displayName: string;
    listingCount: number;
  } | null>(null);

  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    userId: string;
    displayName: string;
    currentRole: string;
    newRole: "ADMIN" | "USER";
  } | null>(null);

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
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
    if (tab === "ozet") {
      void loadOverview();
      void fetchListings("PENDING");
      void adminReports().then(setReports);
      void adminCreditOrders().then(setCreditOrders);
    } else if (tab === "ilan") {
      void fetchListings(listingFilter);
    } else if (tab === "uye") {
      void adminUsers().then(setUsers);
    } else if (tab === "finans") {
      void adminCreditOrders().then(setCreditOrders);
    } else if (tab === "sikayet") {
      void adminReports().then(setReports);
    } else if (tab === "kategori") {
      void listCategories().then((d) => setCats(d.categories));
    } else if (tab === "site") {
      void getSiteSettings().then((s) => {
        setCompany(s.company_name);
        setSupportEmail(s.support_email);
        setSupportPhone(formatPhone(s.support_phone));
        setBankName(s.bank_name || "");
        setAccountHolder(s.account_holder || "");
        setIban(s.iban || "");
      });
    }
  }, [tab, userId, err, listingFilter]);

  // Approve listing handler
  async function handleApproveListing(id: string) {
    setIsSubmittingAction(true);
    try {
      await setListingStatus({ data: { id, status: "ACTIVE" } });
      toast.success("İlan başarıyla onaylandı ve yayına alındı.");
      await fetchListings(listingFilter);
      void loadOverview();
      if (previewListing?.id === id) {
        setPreviewListing((prev) => (prev ? { ...prev, status: "ACTIVE" } : null));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Onaylama sırasında bir hata oluştu.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Reject listing handler
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
      if (previewListing?.id === rejectingListing.id) {
        setPreviewListing((prev) => (prev ? { ...prev, status: "REJECTED" } : null));
      }
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

  // Delete listing handler
  async function handleConfirmDeleteListing() {
    if (!deletingListing) return;
    setIsSubmittingAction(true);
    try {
      await deleteListing({ data: { id: deletingListing.id } });
      toast.success("İlan kalıcı olarak silindi.");
      if (previewListing?.id === deletingListing.id) {
        setPreviewListing(null);
      }
      setDeletingListing(null);
      await fetchListings(listingFilter);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İlan silinemedi.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Delete user handler
  async function handleConfirmDeleteUser() {
    if (!deletingUser) return;
    setIsSubmittingAction(true);
    try {
      await adminDeleteUser({
        data: {
          userId: deletingUser.userId,
          deleteListings: true,
        },
      });
      toast.success(`${deletingUser.displayName} adlı kullanıcı ve tüm verileri silindi.`);
      setDeletingUser(null);
      await adminUsers().then(setUsers);
      await fetchListings(listingFilter);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kullanıcı silinemedi.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Role change handler
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

  // Credit order resolve handler
  async function handleResolveCreditOrder(id: string, status: "PAID" | "REJECTED") {
    setIsSubmittingAction(true);
    try {
      await resolveCreditOrder({ data: { id, status } });
      toast.success(status === "PAID" ? "Havale onaylandı ve doping kredisi yüklendi." : "Talep reddedildi.");
      await adminCreditOrders().then(setCreditOrders);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Filtered listings
  const filteredListings = useMemo(() => {
    const q = listingSearch.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => {
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchId = l.id.toLowerCase().includes(q);
      const matchSeller = (l.seller_name || "").toLowerCase().includes(q);
      const matchCat = (l.category_name || "").toLowerCase().includes(q);
      return matchTitle || matchId || matchSeller || matchCat;
    });
  }, [listings, listingSearch]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) return false;
      if (!q) return true;
      const matchName = u.display_name.toLowerCase().includes(q);
      const matchEmail = (u.email || "").toLowerCase().includes(q);
      const matchPhone = (u.phone || "").toLowerCase().includes(q);
      const matchCity = (u.city || "").toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchCity;
    });
  }, [users, userSearch, userRoleFilter]);

  // Filtered credit orders
  const filteredCreditOrders = useMemo(() => {
    if (creditOrderFilter === "ALL") return creditOrders;
    return creditOrders.filter((o) => o.status === creditOrderFilter);
  }, [creditOrders, creditOrderFilter]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (reportFilter === "ALL") return reports;
    return reports.filter((r) => r.status === reportFilter);
  }, [reports, reportFilter]);

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Yönetim konsolu yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;

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

  const pendingListingsCount = stats?.pending ?? 0;
  const openReportsCount = stats?.reports ?? 0;
  const pendingOrdersCount = stats?.credit_orders ?? 0;

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col md:flex-row text-fg">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between border-b border-border bg-surface px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-ink text-surface font-bold text-sm">
            GS
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight block">GeldeSat Admin</span>
            <span className="text-[10px] text-muted font-medium">Yönetim Konsolu</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="text-muted hover:text-fg p-1.5 rounded-lg border border-border">
            <ArrowLeft className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-border bg-surface text-fg"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`w-full md:w-64 bg-surface border-r border-border md:sticky md:top-0 md:h-screen flex flex-col shrink-0 z-20 transition-all duration-200 ${
          mobileMenuOpen ? "block border-b md:border-b-0" : "hidden md:flex"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-border hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-ink text-surface font-bold shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-tight">Yönetim Paneli</h1>
              <p className="text-xs text-muted">Operasyon & Moderasyon</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            const badgeCount =
              item.id === "ilan"
                ? pendingListingsCount
                : item.id === "sikayet"
                  ? openReportsCount
                  : item.id === "finans"
                    ? pendingOrdersCount
                    : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-ink text-surface shadow-xs"
                    : "text-muted hover:text-fg hover:bg-elevated/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`size-4.5 shrink-0 ${isActive ? "text-surface" : "text-muted"}`} />
                  <span>{item.label}</span>
                </div>
                {badgeCount > 0 && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-surface/25 text-surface"
                        : item.id === "ilan"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : item.id === "sikayet"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-elevated/50 border border-border/60">
            <div className="size-8 rounded-full bg-ink/10 text-ink flex items-center justify-center font-bold text-xs">
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : "AD"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{user?.displayName || "Yönetici"}</p>
              <p className="text-[11px] text-muted truncate">{user?.primaryEmail || "Admin Hesabı"}</p>
            </div>
          </div>
          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border text-muted hover:text-fg hover:bg-elevated transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Kullanıcı Arayüzüne Dön</span>
          </Link>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
        {/* Top View Banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted mb-1">
              <span>Admin</span>
              <ChevronRight className="size-3" />
              <span className="font-semibold text-fg">
                {TABS.find((t) => t.id === tab)?.label}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {tab === "ozet" && "Genel Bakış & İstatistikler"}
              {tab === "ilan" && "İlan Moderasyon Merkezi"}
              {tab === "uye" && "Kullanıcı & Hesap Yönetimi"}
              {tab === "finans" && "Doping & Finans İşlemleri"}
              {tab === "sikayet" && "Şikayet ve Bildirim Masası"}
              {tab === "kategori" && "Kategori Hiyerarşi Ağacı"}
              {tab === "site" && "Site Ayarları & İletişim Bilgileri"}
            </h2>
          </div>

          {/* Quick status counters */}
          <div className="flex items-center gap-2 flex-wrap">
            {pendingListingsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTab("ilan");
                  setListingFilter("PENDING");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-medium hover:bg-amber-500/20 transition-colors"
              >
                <Clock className="size-3.5" />
                <span>{pendingListingsCount} Onay Bekleyen İlan</span>
              </button>
            )}
            {pendingOrdersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTab("finans");
                  setCreditOrderFilter("PENDING");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 text-xs font-medium hover:bg-purple-500/20 transition-colors"
              >
                <CreditCard className="size-3.5" />
                <span>{pendingOrdersCount} Bekleyen Havale</span>
              </button>
            )}
            {openReportsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTab("sikayet");
                  setReportFilter("OPEN");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-xs font-medium hover:bg-rose-500/20 transition-colors"
              >
                <ShieldAlert className="size-3.5" />
                <span>{openReportsCount} Açık Şikayet</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: GENEL BAKIŞ (DASHBOARD) */}
        {tab === "ozet" && (
          <div className="space-y-6">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div
                onClick={() => {
                  setTab("ilan");
                  setListingFilter("ALL");
                }}
                className="rounded-xl border border-border bg-surface p-4.5 cursor-pointer transition-all hover:shadow-md hover:border-ink/20"
              >
                <div className="flex items-center justify-between text-muted">
                  <span className="text-xs font-medium">Toplam İlan</span>
                  <Package className="size-4 text-blue-600" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                  {stats?.listings ?? 0}
                </p>
                <span className="text-[11px] text-muted block mt-1">Platform geneli</span>
              </div>

              <div
                onClick={() => {
                  setTab("ilan");
                  setListingFilter("PENDING");
                }}
                className="rounded-xl border border-border bg-surface p-4.5 cursor-pointer transition-all hover:shadow-md hover:border-amber-500/30"
              >
                <div className="flex items-center justify-between text-muted">
                  <span className="text-xs font-medium">Onay Bekleyen</span>
                  <Clock className="size-4 text-amber-600" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 tabular-nums">
                  {stats?.pending ?? 0}
                </p>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-1">
                  İnceleme kuyruğu
                </span>
              </div>

              <div
                onClick={() => {
                  setTab("ilan");
                  setListingFilter("ACTIVE");
                }}
                className="rounded-xl border border-border bg-surface p-4.5 cursor-pointer transition-all hover:shadow-md hover:border-emerald-500/30"
              >
                <div className="flex items-center justify-between text-muted">
                  <span className="text-xs font-medium">Yayında</span>
                  <Check className="size-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 tabular-nums">
                  {stats?.active ?? 0}
                </p>
                <span className="text-[11px] text-muted block mt-1">Aktif listelenen</span>
              </div>

              <div
                onClick={() => {
                  setTab("uye");
                }}
                className="rounded-xl border border-border bg-surface p-4.5 cursor-pointer transition-all hover:shadow-md hover:border-ink/20"
              >
                <div className="flex items-center justify-between text-muted">
                  <span className="text-xs font-medium">Kayıtlı Üye</span>
                  <Users className="size-4 text-indigo-600" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                  {stats?.users ?? 0}
                </p>
                <span className="text-[11px] text-muted block mt-1">Toplam profil</span>
              </div>

              <div
                onClick={() => {
                  setTab("finans");
                  setCreditOrderFilter("PENDING");
                }}
                className="rounded-xl border border-border bg-surface p-4.5 cursor-pointer transition-all hover:shadow-md hover:border-purple-500/30"
              >
                <div className="flex items-center justify-between text-muted">
                  <span className="text-xs font-medium">Bekleyen Havale</span>
                  <CreditCard className="size-4 text-purple-600" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-purple-600 tabular-nums">
                  {stats?.credit_orders ?? 0}
                </p>
                <span className="text-[11px] text-purple-700 dark:text-purple-400 block mt-1">
                  Doping talebi
                </span>
              </div>

              <div
                onClick={() => {
                  setTab("sikayet");
                  setReportFilter("OPEN");
                }}
                className="rounded-xl border border-border bg-surface p-4.5 cursor-pointer transition-all hover:shadow-md hover:border-rose-500/30"
              >
                <div className="flex items-center justify-between text-muted">
                  <span className="text-xs font-medium">Açık Şikayet</span>
                  <ShieldAlert className="size-4 text-rose-600" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600 tabular-nums">
                  {stats?.reports ?? 0}
                </p>
                <span className="text-[11px] text-rose-700 dark:text-rose-400 block mt-1">
                  Müdahale gerekebilir
                </span>
              </div>
            </div>

            {/* Quick Pending Listings Table Preview */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4.5 text-amber-600" />
                  <h3 className="font-semibold text-sm">Onay Bekleyen Son İlanlar</h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => {
                    setTab("ilan");
                    setListingFilter("PENDING");
                  }}
                >
                  Tümünü Gör ({pendingListingsCount})
                </Button>
              </div>

              {listings.filter((l) => l.status === "PENDING").length === 0 ? (
                <div className="p-8 text-center text-muted text-sm">
                  Şu anda onay bekleyen yeni bir ilan bulunmuyor.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {listings
                    .filter((l) => l.status === "PENDING")
                    .slice(0, 5)
                    .map((l) => (
                      <div key={l.id} className="p-4 flex items-center justify-between gap-4 hover:bg-elevated/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {l.images && l.images[0] ? (
                            <img
                              src={l.images[0]}
                              alt=""
                              className="size-11 rounded-lg object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="size-11 rounded-lg bg-muted/20 border border-border flex items-center justify-center text-[10px] text-muted shrink-0">
                              Foto Yok
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setPreviewListing(l)}
                              className="font-medium text-sm hover:underline text-left truncate block text-fg"
                            >
                              {l.title}
                            </button>
                            <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                              <span>{l.category_name || "Kategori"}</span>
                              <span>·</span>
                              <span>{formatPrice(l.price)}</span>
                              <span>·</span>
                              <span>{l.seller_name || "Satıcı"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => setPreviewListing(l)}
                          >
                            <Eye className="size-3.5 mr-1" /> İncele
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isSubmittingAction}
                            onClick={() => void handleApproveListing(l.id)}
                          >
                            <Check className="size-3.5 mr-1" /> Onayla
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950"
                            disabled={isSubmittingAction}
                            onClick={() => {
                              setRejectingListing(l);
                              setSelectedReason(QUICK_REJECT_REASONS[0]);
                              setCustomReason("");
                            }}
                          >
                            <X className="size-3.5 mr-1" /> Reddet
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Two column grid for quick tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bekleyen Havale Talepleri */}
              <div className="rounded-xl border border-border bg-surface p-4.5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <CreditCard className="size-4 text-purple-600" />
                    Bekleyen Havale Ödemeleri
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => setTab("finans")}
                  >
                    Detaylar
                  </Button>
                </div>
                {creditOrders.filter((o) => o.status === "PENDING").length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">
                    Onay bekleyen havale siparişi bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {creditOrders
                      .filter((o) => o.status === "PENDING")
                      .slice(0, 3)
                      .map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-elevated/40 text-xs"
                        >
                          <div>
                            <span className="font-medium text-fg block">{o.buyer_name}</span>
                            <span className="text-muted">
                              {o.sku} ({o.credits} Kredi) · {formatPrice(o.price)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => void handleResolveCreditOrder(o.id, "PAID")}
                          >
                            Onayla
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Bekleyen Açık Şikayetler */}
              <div className="rounded-xl border border-border bg-surface p-4.5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ShieldAlert className="size-4 text-rose-600" />
                    Son Açık Şikayetler
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => setTab("sikayet")}
                  >
                    Detaylar
                  </Button>
                </div>
                {reports.filter((r) => r.status === "OPEN").length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">
                    Açık veya çözülmemiş şikayet bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reports
                      .filter((r) => r.status === "OPEN")
                      .slice(0, 3)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-elevated/40 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-medium text-fg block truncate">{r.title}</span>
                            <span className="text-rose-600 dark:text-rose-400 block font-medium">
                              {r.reason}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs shrink-0"
                            onClick={() => {
                              setTab("sikayet");
                              setReportFilter("OPEN");
                            }}
                          >
                            İncele
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: İLAN MODERASYONU */}
        {tab === "ilan" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border shadow-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    listingFilter === "ALL" ? "bg-ink text-surface" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setListingFilter("ALL")}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    listingFilter === "PENDING"
                      ? "bg-amber-600 text-white"
                      : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setListingFilter("PENDING")}
                >
                  Onay Bekleyenler
                  {pendingListingsCount > 0 && (
                    <span className="size-2 rounded-full bg-amber-400" />
                  )}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    listingFilter === "ACTIVE"
                      ? "bg-emerald-600 text-white"
                      : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setListingFilter("ACTIVE")}
                >
                  Yayındakiler
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    listingFilter === "REJECTED"
                      ? "bg-rose-600 text-white"
                      : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setListingFilter("REJECTED")}
                >
                  Reddedilenler
                </button>
              </div>

              <div className="relative min-w-[240px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
                <Input
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  placeholder="Başlık, satıcı veya İlan No ara..."
                  className="pl-8 h-8.5 text-xs"
                />
              </div>
            </div>

            {/* Listings Count Info */}
            <div className="flex items-center justify-between text-xs text-muted px-1">
              <span>Toplam {filteredListings.length} ilan gösteriliyor</span>
              {listingSearch && (
                <button
                  type="button"
                  onClick={() => setListingSearch("")}
                  className="text-primary hover:underline"
                >
                  Aramayı Temizle
                </button>
              )}
            </div>

            {/* Listings Table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted bg-elevated/40">
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
                  {filteredListings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-muted">
                        Arama veya filtreleme kriterlerine uygun ilan bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredListings.map((l) => (
                      <tr key={l.id} className="transition-colors hover:bg-elevated/40">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            {l.images && l.images[0] ? (
                              <img
                                src={l.images[0]}
                                alt=""
                                className="size-11 shrink-0 rounded-lg object-cover border border-border"
                              />
                            ) : (
                              <div className="size-11 shrink-0 rounded-lg bg-muted/20 border border-border flex items-center justify-center text-[10px] text-muted">
                                Foto Yok
                              </div>
                            )}
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setPreviewListing(l)}
                                className="font-medium hover:underline text-fg text-left block truncate max-w-[220px]"
                              >
                                {l.title}
                              </button>
                              <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
                                <span>No: {l.id.slice(0, 8)}</span>
                                <span>·</span>
                                <span>{l.city || "Şehir yok"}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-muted text-xs">{l.category_name ?? "—"}</td>
                        <td className="p-3.5">
                          <Link
                            to="/satici/$id"
                            params={{ id: l.user_id }}
                            target="_blank"
                            className="hover:underline text-fg font-medium text-xs inline-flex items-center gap-1"
                          >
                            <span>{l.seller_name || "Üye"}</span>
                            <ExternalLink className="size-2.5 text-muted" />
                          </Link>
                        </td>
                        <td className="p-3.5 font-medium tabular-nums text-xs">{formatPrice(l.price)}</td>
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
                        <td className="p-3.5 text-xs text-muted tabular-nums">
                          {formatDate(l.created_at)}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Hızlı Önizle */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs"
                              title="Detaylı Önizle"
                              onClick={() => setPreviewListing(l)}
                            >
                              <Eye className="size-3.5" />
                            </Button>

                            {/* Onayla */}
                            {l.status !== "ACTIVE" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border-emerald-300 dark:hover:bg-emerald-950"
                                disabled={isSubmittingAction}
                                onClick={() => void handleApproveListing(l.id)}
                              >
                                <Check className="size-3.5 mr-1" /> Onay
                              </Button>
                            )}

                            {/* Reddet */}
                            {l.status !== "REJECTED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 border-rose-300 dark:hover:bg-rose-950"
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

                            {/* İlanı Sil (Admin Delete) */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                              title="İlanı Kalıcı Olarak Sil"
                              disabled={isSubmittingAction}
                              onClick={() => setDeletingListing(l)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: KULLANICI YÖNETİMİ (ÜYE SİLME & ROL DEĞİŞİMİ) */}
        {tab === "uye" && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border shadow-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    userRoleFilter === "ALL" ? "bg-ink text-surface" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setUserRoleFilter("ALL")}
                >
                  Tüm Roller
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    userRoleFilter === "ADMIN" ? "bg-ink text-surface" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setUserRoleFilter("ADMIN")}
                >
                  Yöneticiler (ADMIN)
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    userRoleFilter === "USER" ? "bg-ink text-surface" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setUserRoleFilter("USER")}
                >
                  Normal Üyeler (USER)
                </button>
              </div>

              <div className="relative min-w-[260px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="İsim, e-posta, telefon veya şehir ara..."
                  className="pl-8 h-8.5 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted px-1">
              <span>Toplam {filteredUsers.length} üye listeleniyor</span>
              {userSearch && (
                <button
                  type="button"
                  onClick={() => setUserSearch("")}
                  className="text-primary hover:underline"
                >
                  Aramayı Temizle
                </button>
              )}
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted bg-elevated/40">
                  <tr>
                    <th className="p-3.5">Kullanıcı</th>
                    <th className="p-3.5">İletişim</th>
                    <th className="p-3.5">Rol</th>
                    <th className="p-3.5">İlan Sayısı</th>
                    <th className="p-3.5">Şehir</th>
                    <th className="p-3.5">Kayıt Tarihi</th>
                    <th className="p-3.5 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-muted">
                        Arama kriterlerinize uygun kullanıcı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.user_id === user?.id;
                      return (
                        <tr key={u.user_id} className="transition-colors hover:bg-elevated/40">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="size-9 rounded-full bg-ink/10 text-ink flex items-center justify-center font-bold text-xs shrink-0">
                                {u.display_name ? u.display_name.slice(0, 2).toUpperCase() : "U"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    to="/satici/$id"
                                    params={{ id: u.user_id }}
                                    target="_blank"
                                    className="font-medium hover:underline text-fg text-xs inline-flex items-center gap-1"
                                  >
                                    <span className="truncate max-w-[150px]">{u.display_name || "İsimsiz Üye"}</span>
                                    <ExternalLink className="size-2.5 text-muted" />
                                  </Link>
                                  {isSelf && (
                                    <Badge tone="ink" className="text-[10px] px-1.5 py-0">
                                      Siz
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-mono text-[11px] text-muted block">ID: {u.user_id.slice(0, 8)}</span>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 text-xs">
                            <div className="space-y-0.5">
                              {u.email ? (
                                <div className="flex items-center gap-1 text-fg">
                                  <Mail className="size-3 text-muted" />
                                  <span>{u.email}</span>
                                </div>
                              ) : (
                                <span className="text-muted">E-posta yok</span>
                              )}
                              {u.phone && (
                                <div className="flex items-center gap-1 text-muted">
                                  <Phone className="size-3 text-subtle" />
                                  <span className="font-mono tabular-nums">{formatPhone(u.phone)}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <Badge tone={u.role === "ADMIN" ? "ink" : "muted"}>
                              {u.role === "ADMIN" ? "Yönetici (ADMIN)" : "Üye (USER)"}
                            </Badge>
                          </td>

                          <td className="p-3.5 text-xs">
                            {u.listing_count > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setTab("ilan");
                                  setListingSearch(u.display_name);
                                }}
                                className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                              >
                                <span>{u.listing_count} İlan</span>
                              </button>
                            ) : (
                              <span className="text-muted">0 İlan</span>
                            )}
                          </td>

                          <td className="p-3.5 text-xs text-muted">
                            {u.city || "—"}
                          </td>

                          <td className="p-3.5 text-xs text-muted tabular-nums">
                            {formatDate(u.created_at)}
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Rol Değiştir */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs"
                                disabled={isSelf}
                                title={isSelf ? "Kendi yetkinizi değiştiremezsiniz" : "Rol Değiştir"}
                                onClick={() => {
                                  setRoleChangeTarget({
                                    userId: u.user_id,
                                    displayName: u.display_name,
                                    currentRole: u.role,
                                    newRole: u.role === "ADMIN" ? "USER" : "ADMIN",
                                  });
                                }}
                              >
                                {u.role === "ADMIN" ? "Yöneticilikten Al" : "Yönetici Yap"}
                              </Button>

                              {/* Üyeyi Sil */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                                disabled={isSelf || isSubmittingAction}
                                title={isSelf ? "Kendinizi silemezsiniz" : "Üyeyi Kalıcı Olarak Sil"}
                                onClick={() => {
                                  if (u.role === "ADMIN") {
                                    toast.error("Yönetici rolündeki hesaplar doğrudan silinemez. Önce rolünü 'USER' yapınız.");
                                    return;
                                  }
                                  setDeletingUser({
                                    userId: u.user_id,
                                    displayName: u.display_name,
                                    listingCount: u.listing_count,
                                  });
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DOPİNG & FİNANS (HAVALE / EFT ONAY MASASI) */}
        {tab === "finans" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between bg-surface p-3.5 rounded-xl border border-border shadow-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    creditOrderFilter === "ALL" ? "bg-ink text-surface" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setCreditOrderFilter("ALL")}
                >
                  Tüm Talepler
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    creditOrderFilter === "PENDING"
                      ? "bg-purple-600 text-white"
                      : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setCreditOrderFilter("PENDING")}
                >
                  Onay Bekleyenler
                  {pendingOrdersCount > 0 && (
                    <span className="size-2 rounded-full bg-purple-300" />
                  )}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    creditOrderFilter === "PAID"
                      ? "bg-emerald-600 text-white"
                      : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setCreditOrderFilter("PAID")}
                >
                  Onaylananlar (PAID)
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    creditOrderFilter === "REJECTED"
                      ? "bg-rose-600 text-white"
                      : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setCreditOrderFilter("REJECTED")}
                >
                  Reddedilenler
                </button>
              </div>

              <div className="text-xs text-muted">
                Toplam {filteredCreditOrders.length} işlem kaydı
              </div>
            </div>

            {/* Credit Orders Table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted bg-elevated/40">
                  <tr>
                    <th className="p-3.5">Talep No / Sipariş</th>
                    <th className="p-3.5">Alıcı Üye</th>
                    <th className="p-3.5">Paket (SKU)</th>
                    <th className="p-3.5">Kredi Miktarı</th>
                    <th className="p-3.5">Tutar (TRY)</th>
                    <th className="p-3.5">Durum</th>
                    <th className="p-3.5">Tarih</th>
                    <th className="p-3.5 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCreditOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-muted">
                        Kriterlere uygun havale/kredi siparişi bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredCreditOrders.map((o) => (
                      <tr key={o.id} className="transition-colors hover:bg-elevated/40">
                        <td className="p-3.5 font-mono text-xs text-muted">
                          #{o.id.slice(0, 8)}
                        </td>
                        <td className="p-3.5 font-medium text-xs">
                          <Link
                            to="/satici/$id"
                            params={{ id: o.user_id }}
                            target="_blank"
                            className="hover:underline text-fg inline-flex items-center gap-1"
                          >
                            <span>{o.buyer_name}</span>
                            <ExternalLink className="size-2.5 text-muted" />
                          </Link>
                        </td>
                        <td className="p-3.5 text-xs text-muted font-mono">{o.sku}</td>
                        <td className="p-3.5 font-semibold text-xs tabular-nums text-purple-700 dark:text-purple-400">
                          {o.credits} Doping Kredisi
                        </td>
                        <td className="p-3.5 font-bold text-xs tabular-nums">{formatPrice(o.price)}</td>
                        <td className="p-3.5">
                          <Badge
                            tone={
                              o.status === "PAID"
                                ? "ok"
                                : o.status === "PENDING"
                                  ? "warn"
                                  : "danger"
                            }
                          >
                            {o.status === "PAID"
                              ? "Onaylandı"
                              : o.status === "PENDING"
                                ? "Havale Bekliyor"
                                : "Reddedildi"}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-xs text-muted tabular-nums">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="p-3.5 text-right">
                          {o.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={isSubmittingAction}
                                onClick={() => void handleResolveCreditOrder(o.id, "PAID")}
                              >
                                <Check className="size-3.5 mr-1" /> Onayla
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950"
                                disabled={isSubmittingAction}
                                onClick={() => void handleResolveCreditOrder(o.id, "REJECTED")}
                              >
                                <X className="size-3.5 mr-1" /> Reddet
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">İşlem Tamam</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: ŞİKAYET MASASI (RAPORLAR) */}
        {tab === "sikayet" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between bg-surface p-3.5 rounded-xl border border-border shadow-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    reportFilter === "ALL" ? "bg-ink text-surface" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setReportFilter("ALL")}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    reportFilter === "OPEN" ? "bg-rose-600 text-white" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setReportFilter("OPEN")}
                >
                  Açık Şikayetler
                  {openReportsCount > 0 && (
                    <span className="size-2 rounded-full bg-rose-300" />
                  )}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    reportFilter === "CLOSED" ? "bg-ink text-surface" : "text-muted hover:text-fg hover:bg-elevated"
                  }`}
                  onClick={() => setReportFilter("CLOSED")}
                >
                  Kapatılanlar
                </button>
              </div>

              <div className="text-xs text-muted">
                Toplam {filteredReports.length} bildirim kaydı
              </div>
            </div>

            {/* Reports List */}
            {filteredReports.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted text-sm shadow-xs">
                Kriterlere uygun şikayet bildirimi bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border bg-surface p-5 text-sm space-y-3.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone={r.status === "OPEN" ? "danger" : "muted"}>
                            {r.reason}
                          </Badge>
                          <span className="text-xs text-muted tabular-nums">
                            {formatDate(r.created_at)}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <span className="text-xs text-muted">Şikayet Edilen İlan: </span>
                          <Link
                            to="/ilan/$slug"
                            params={{ slug: r.slug }}
                            target="_blank"
                            className="font-medium hover:underline text-fg inline-flex items-center gap-1"
                          >
                            <span>{r.title}</span>
                            <ExternalLink className="size-3 text-muted" />
                          </Link>
                        </div>

                        <p className="text-xs text-muted mt-1">
                          Şikayet Eden: <span className="text-fg font-medium">{r.reporter_name}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.status === "OPEN" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() =>
                              resolveReport({ data: { id: r.id, status: "CLOSED" } }).then(() => {
                                toast.success("Şikayet kapatıldı");
                                void adminReports().then(setReports);
                                void loadOverview();
                              })
                            }
                          >
                            Şikayeti Kapat
                          </Button>
                        ) : (
                          <Badge tone="muted">Kapatıldı</Badge>
                        )}
                      </div>
                    </div>

                    {r.details && (
                      <div className="rounded-lg bg-elevated/70 p-3 text-xs border border-border">
                        <span className="font-semibold text-fg">Şikayet Detayı: </span>
                        <span className="text-muted">{r.details}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: KATEGORİ AĞACI */}
        {tab === "kategori" && (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Kategori Hiyerarşi Ağacı</h3>
              <p className="text-xs text-muted mt-0.5">
                Kategorileri düzenleyin, yeni alt kategoriler ekleyin veya silin.
              </p>
            </div>
            <CategoryAdminTree
              categories={cats}
              onRefresh={() => listCategories().then((d) => setCats(d.categories))}
            />
          </div>
        )}

        {/* TAB 7: SİTE AYARLARI */}
        {tab === "site" && (
          <form
            className="max-w-2xl space-y-6 rounded-xl border border-border bg-surface p-6 shadow-xs"
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
                  support_phone: cleanPhone(supportPhone),
                },
              })
                .then(() => toast.success("Site ayarları başarıyla kaydedildi."))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Kaydedilemedi."))
                .finally(() => setSavingSite(false));
            }}
          >
            <div>
              <h3 className="text-base font-semibold">Platform & İletişim Bilgileri</h3>
              <p className="text-xs text-muted mt-0.5">
                Bu bilgiler web sitesinin alt bilgi, iletişim ve destek alanlarında görüntülenir.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Firma / Platform Unvanı</Label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={80}
                  required
                  className="mt-1.5"
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
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Destek Telefon Numarası</Label>
                <PhoneInput
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="border-t border-border pt-5 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-fg">Banka & Havale Bilgileri (İsteğe Bağlı)</h4>
                <p className="text-xs text-muted mt-0.5">
                  Doping havale/EFT ödemeleri için kullanıcılara gösterilecek resmi banka hesap bilgilerini buradan güncelleyebilirsiniz.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <Label>Banka Adı (Opsiyonel)</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Örn: Ziraat Bankası"
                    maxLength={80}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Hesap Sahibi (Opsiyonel)</Label>
                  <Input
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Örn: GeldeSat Bilişim A.Ş."
                    maxLength={80}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>IBAN Numarası (Opsiyonel)</Label>
                  <Input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="TR..."
                    maxLength={40}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={savingSite} className="w-full sm:w-auto">
              {savingSite ? "Kaydediliyor…" : "Ayarları Kaydet"}
            </Button>
          </form>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODALS & DIALOGS */}
      {/* ========================================================================= */}

      {/* 1. HIZLI İLAN ÖNİZLEME MODALI */}
      <Dialog
        open={Boolean(previewListing)}
        onOpenChange={(open) => {
          if (!open) setPreviewListing(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <Badge
                tone={
                  previewListing?.status === "ACTIVE"
                    ? "ok"
                    : previewListing?.status === "PENDING"
                      ? "warn"
                      : previewListing?.status === "REJECTED"
                        ? "danger"
                        : "muted"
                }
              >
                {previewListing ? listingStatusLabel(previewListing.status) : ""}
              </Badge>
              <span className="text-xs font-mono text-muted">ID: {previewListing?.id}</span>
            </div>
            <DialogTitle className="text-lg font-bold mt-2 text-left">
              {previewListing?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-left">
              Kategori: <strong className="text-fg">{previewListing?.category_name || "—"}</strong> ·
              Fiyat: <strong className="text-fg">{previewListing ? formatPrice(previewListing.price) : ""}</strong> ·
              Şehir: <strong className="text-fg">{previewListing?.city || "—"} / {previewListing?.district || "—"}</strong>
            </DialogDescription>
          </DialogHeader>

          {/* Photos gallery */}
          <div className="space-y-3 py-2">
            {previewListing?.images && previewListing.images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {previewListing.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt=""
                    className="h-28 w-full object-cover rounded-lg border border-border"
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted border border-dashed rounded-lg">
                Fotoğraf yüklenmemiş.
              </div>
            )}

            {/* Description */}
            <div className="rounded-lg bg-elevated/50 p-3.5 border border-border text-xs space-y-1">
              <span className="font-semibold text-fg block">İlan Açıklaması:</span>
              <p className="text-muted whitespace-pre-wrap leading-relaxed">
                {previewListing?.description || "Açıklama girilmemiş."}
              </p>
            </div>

            {/* Attributes */}
            {previewListing?.attrs && Object.keys(previewListing.attrs).length > 0 && (
              <div className="rounded-lg border border-border p-3 text-xs space-y-1.5">
                <span className="font-semibold text-fg block">Özellikler:</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(previewListing.attrs).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-border/50 pb-1">
                      <span className="text-muted">{k}:</span>
                      <span className="font-medium text-fg">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seller Contact */}
            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <span>
                Satıcı: <strong className="text-fg">{previewListing?.seller_name || "Üye"}</strong>
              </span>
              <Link
                to="/ilan/$slug"
                params={{ slug: previewListing?.slug || "" }}
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>İlanı Sitede Aç</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewListing(null)}
            >
              Kapat
            </Button>
            {previewListing && previewListing.status !== "ACTIVE" && (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isSubmittingAction}
                onClick={() => void handleApproveListing(previewListing.id)}
              >
                <Check className="size-3.5 mr-1" /> Onayla ve Yayına Al
              </Button>
            )}
            {previewListing && previewListing.status !== "REJECTED" && (
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={isSubmittingAction}
                onClick={() => {
                  setRejectingListing(previewListing);
                  setSelectedReason(QUICK_REJECT_REASONS[0]);
                  setCustomReason("");
                }}
              >
                <X className="size-3.5 mr-1" /> Reddet
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. İLAN REDDETME DİYALOĞU */}
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
            <DialogTitle className="text-rose-600 flex items-center gap-2 text-left">
              <AlertTriangle className="size-5 shrink-0" />
              İlanı Reddet
            </DialogTitle>
            <DialogDescription className="text-xs text-left">
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

      {/* 3. İLAN SİLME ONAY MODALI */}
      <AlertDialog
        open={Boolean(deletingListing)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingAction) setDeletingListing(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="size-5 shrink-0" />
              İlanı Silmek İstediğinize Emin misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              <strong>"{deletingListing?.title}"</strong> (No: {deletingListing?.id.slice(0, 8)}) başlıklı ilan sistemden ve veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingAction}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isSubmittingAction}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteListing();
              }}
            >
              {isSubmittingAction ? "Siliniyor…" : "Evet, İlanı Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 4. ÜYE SİLME ONAY MODALI */}
      <AlertDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingAction) setDeletingUser(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="size-5 shrink-0" />
              Kullanıcı Hesabını Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2 leading-relaxed">
              <p>
                <strong>"{deletingUser?.displayName}"</strong> adlı kullanıcıyı kalıcı olarak silmek üzeresiniz.
              </p>
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-700 dark:text-red-400">
                <p className="font-semibold mb-1">Bu işlem kapsamında:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Kullanıcının hesabı ve giriş oturumları kapatılacaktır.</li>
                  <li>Kullanıcıya ait {deletingUser?.listingCount ?? 0} adet ilan ve fotoğraflar silinecektir.</li>
                  <li>Mesajlar, bildirimler ve favoriler veritabanından temizlenecektir.</li>
                </ul>
              </div>
              <p className="text-muted">Bu işlem kesin ve geri alınamaz. Devam etmek istiyor musunuz?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingAction}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isSubmittingAction}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteUser();
              }}
            >
              {isSubmittingAction ? "Kullanıcı Siliniyor…" : "Evet, Hesabı ve Verileri Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 5. KULLANICI ROL DEĞİŞİMİ MODALI */}
      <AlertDialog
        open={Boolean(roleChangeTarget)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingRole) setRoleChangeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcı Rolü Değiştirilsin mi?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
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
