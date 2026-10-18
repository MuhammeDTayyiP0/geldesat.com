import { photoSrc } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { ShieldAlert, Check, X, Package, Users, CreditCard, Eye, Clock } from "lucide-react";
import { QUICK_REJECT_REASONS } from "./shared";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — TAB 1: GENEL BAKIŞ (DASHBOARD). */
export function OverviewTab({ panel }: { panel: AdminPanel }) {
  const {
    setTab,
    stats,
    listings,
    setListingFilter,
    creditOrders,
    setCreditOrderFilter,
    reports,
    setReportFilter,
    setRejectingListing,
    setSelectedReason,
    setCustomReason,
    setPreviewListing,
    isSubmittingAction,
    handleApproveListing,
    handleResolveCreditOrder,
    pendingListingsCount,
  } = panel;
  return (
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
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{stats?.users ?? 0}</p>
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
                <div
                  key={l.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-elevated/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {l.images && l.images[0] ? (
                      <img
                        src={photoSrc(l.images[0], 240)}
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
  );
}
