import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { isAdminSession } from "@/lib/server/account";
import { NotFound } from "@/components/common/NotFound";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import {
  ShieldAlert,
  CreditCard,
  ArrowLeft,
  Menu,
  Clock,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { TABS } from "@/components/admin/shared";
import { useAdminPanel } from "@/components/admin/use-admin-panel";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { ListingsTab } from "@/components/admin/ListingsTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { FinanceTab } from "@/components/admin/FinanceTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { CategoriesTab } from "@/components/admin/CategoriesTab";
import { SiteSettingsTab } from "@/components/admin/SiteSettingsTab";
import { AdminDialogs } from "@/components/admin/AdminDialogs";

export const Route = createFileRoute("/admin")({
  // Non-admins (including signed-out visitors) get a plain 404 so the panel's existence isn't revealed.
  beforeLoad: async () => {
    if (!(await isAdminSession())) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Yönetici Paneli | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const panel = useAdminPanel();
  const {
    user,
    isPending,
    tab,
    setTab,
    mobileMenuOpen,
    setMobileMenuOpen,
    stats,
    setListingFilter,
    setCreditOrderFilter,
    setReportFilter,
    err,
    pendingListingsCount,
    openReportsCount,
    pendingOrdersCount,
  } = panel;

  if (isPending || (!stats && !err)) {
    return <BrandSpinner fullPage text="Yönetim konsolu yükleniyor…" />;
  }

  if (!user || err) return <NotFound />;

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
                  <Icon
                    className={`size-4.5 shrink-0 ${isActive ? "text-surface" : "text-muted"}`}
                  />
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
              <p className="text-[11px] text-muted truncate">
                {user?.primaryEmail || "Admin Hesabı"}
              </p>
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
              <span className="font-semibold text-fg">{TABS.find((t) => t.id === tab)?.label}</span>
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

        {tab === "ozet" && <OverviewTab panel={panel} />}

        {tab === "ilan" && <ListingsTab panel={panel} />}

        {tab === "uye" && <UsersTab panel={panel} />}

        {tab === "finans" && <FinanceTab panel={panel} />}

        {tab === "sikayet" && <ReportsTab panel={panel} />}

        {tab === "kategori" && <CategoriesTab panel={panel} />}

        {tab === "site" && <SiteSettingsTab panel={panel} />}
      </main>

      <AdminDialogs panel={panel} />
    </div>
  );
}
