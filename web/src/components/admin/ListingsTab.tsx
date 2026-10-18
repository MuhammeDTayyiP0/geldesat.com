import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate, formatPrice, listingStatusLabel } from "@/lib/utils";
import { ExternalLink, Check, X, Search, Trash2, Eye } from "lucide-react";
import { QUICK_REJECT_REASONS } from "./shared";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — TAB 2: İLAN MODERASYONU. */
export function ListingsTab({ panel }: { panel: AdminPanel }) {
  const {
    listingFilter,
    setListingFilter,
    listingSearch,
    setListingSearch,
    setRejectingListing,
    setSelectedReason,
    setCustomReason,
    setDeletingListing,
    setPreviewListing,
    isSubmittingAction,
    handleApproveListing,
    filteredListings,
    pendingListingsCount,
  } = panel;
  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              listingFilter === "ALL"
                ? "bg-ink text-surface"
                : "text-muted hover:text-fg hover:bg-elevated"
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
            {pendingListingsCount > 0 && <span className="size-2 rounded-full bg-amber-400" />}
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
  );
}
