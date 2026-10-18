import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/lib/utils";
import { ExternalLink, Check, X } from "lucide-react";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — TAB 4: DOPİNG & FİNANS (HAVALE / EFT ONAY MASASI). */
export function FinanceTab({ panel }: { panel: AdminPanel }) {
  const {
    creditOrderFilter,
    setCreditOrderFilter,
    isSubmittingAction,
    handleResolveCreditOrder,
    filteredCreditOrders,
    pendingOrdersCount,
  } = panel;
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-surface p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              creditOrderFilter === "ALL"
                ? "bg-ink text-surface"
                : "text-muted hover:text-fg hover:bg-elevated"
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
            {pendingOrdersCount > 0 && <span className="size-2 rounded-full bg-purple-300" />}
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

        <div className="text-xs text-muted">Toplam {filteredCreditOrders.length} işlem kaydı</div>
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
                  <td className="p-3.5 font-mono text-xs text-muted">#{o.id.slice(0, 8)}</td>
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
                      tone={o.status === "PAID" ? "ok" : o.status === "PENDING" ? "warn" : "danger"}
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
  );
}
