import { Link } from "@tanstack/react-router";
import { adminReports, resolveReport } from "@/lib/server/account";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — TAB 5: ŞİKAYET MASASI (RAPORLAR). */
export function ReportsTab({ panel }: { panel: AdminPanel }) {
  const {
    setReports,
    reportFilter,
    setReportFilter,
    loadOverview,
    filteredReports,
    openReportsCount,
  } = panel;
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-surface p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              reportFilter === "ALL"
                ? "bg-ink text-surface"
                : "text-muted hover:text-fg hover:bg-elevated"
            }`}
            onClick={() => setReportFilter("ALL")}
          >
            Tümü
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              reportFilter === "OPEN"
                ? "bg-rose-600 text-white"
                : "text-muted hover:text-fg hover:bg-elevated"
            }`}
            onClick={() => setReportFilter("OPEN")}
          >
            Açık Şikayetler
            {openReportsCount > 0 && <span className="size-2 rounded-full bg-rose-300" />}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              reportFilter === "CLOSED"
                ? "bg-ink text-surface"
                : "text-muted hover:text-fg hover:bg-elevated"
            }`}
            onClick={() => setReportFilter("CLOSED")}
          >
            Kapatılanlar
          </button>
        </div>

        <div className="text-xs text-muted">Toplam {filteredReports.length} bildirim kaydı</div>
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
                    <Badge tone={r.status === "OPEN" ? "danger" : "muted"}>{r.reason}</Badge>
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
  );
}
