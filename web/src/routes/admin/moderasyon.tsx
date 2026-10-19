import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, ChevronUp, ExternalLink, FolderInput, Keyboard, ListChecks, PanelRightOpen, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import { cn } from "@/lib/utils";
import { adminListingDetail, adminListingsAction, adminListListings } from "@/lib/server/admin/listings";
import { REJECT_REASONS, useListingActions, useRunner, useSheets } from "@/components/admin/hooks";
import { age, dateTime, money, n, relative } from "@/components/admin/format";
import { Avatar, Card, EmptyState, ErrorState, Kbd, MiniStat, PageHeader, Pill, Spinner, Thumb } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/moderasyon")({
  component: ModerationPage,
});

function ModerationPage() {
  const queue = useQuery({
    queryKey: ["admin", "moderation-queue"],
    queryFn: () => adminListListings({ data: { status: "PENDING", sort: "oldest", page: 1, pageSize: 100, flag: "none" } }),
    refetchInterval: 60_000,
  });
  const rows = useMemo(() => queue.data?.rows ?? [], [queue.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [handled, setHandled] = useState(0);

  // Keep a valid selection as the queue changes.
  useEffect(() => {
    if (!rows.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((r) => r.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  const position = rows.findIndex((r) => r.id === selectedId);

  function step(dir: 1 | -1) {
    if (!rows.length) return;
    const next = rows[Math.min(rows.length - 1, Math.max(0, position + dir))];
    if (next) setSelectedId(next.id);
  }

  /** After a decision the next listing in line opens. */
  function advanceFrom(id: string) {
    const i = rows.findIndex((r) => r.id === id);
    const next = rows[i + 1] ?? rows[i - 1];
    setSelectedId(next && next.id !== id ? next.id : null);
    setHandled((h) => h + 1);
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        icon={ListChecks}
        title="Onay kuyruğu"
        description={
          queue.data
            ? `${n(queue.data.total)} ilan onay bekliyor${rows[0] ? ` · en eskisi ${age(rows[0].created_at)}dır bekliyor` : ""}${handled ? ` · bu oturumda ${handled} karar` : ""}`
            : "Bekleyen ilanlar yükleniyor…"
        }
        actions={<ShortcutHelp />}
      />

      {queue.error ? (
        <Card>
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
        </Card>
      ) : queue.isLoading ? (
        <Card className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <Spinner /> Kuyruk yükleniyor…
        </Card>
      ) : !rows.length ? (
        <Card>
          <EmptyState icon={Check} title="Tebrikler, kuyruk boş!" description="Onay bekleyen ilan kalmadı. Yeni ilanlar geldikçe burada görünecek." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <ul className="divide-y divide-border">
              {rows.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", r.id === selectedId ? "bg-primary/8 ring-1 ring-inset ring-primary/30" : "hover:bg-elevated/60")}
                  >
                    <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-subtle">{i + 1}</span>
                    <Thumb src={r.cover ? photoSrc(r.cover, 240) : null} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", r.id === selectedId ? "font-semibold text-primary" : "font-medium")}>{r.title}</p>
                      <p className="truncate text-[11px] text-muted">
                        {r.seller_name} · <span className={cn(Date.now() - new Date(r.created_at).getTime() > 86_400_000 ? "font-semibold text-danger" : "text-warn")}>{age(r.created_at)}</span>
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {queue.data && queue.data.total > rows.length ? <p className="border-t border-border px-3 py-2 text-center text-[11px] text-muted">İlk {rows.length} ilan gösteriliyor</p> : null}
          </Card>

          {selectedId ? (
            <Reviewer key={selectedId} id={selectedId} position={position + 1} total={queue.data?.total ?? rows.length} onStep={step} onDecided={advanceFrom} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function Reviewer({ id, position, total, onStep, onDecided }: { id: string; position: number; total: number; onStep: (d: 1 | -1) => void; onDecided: (id: string) => void }) {
  const q = useQuery({ queryKey: ["admin", "listing", id], queryFn: () => adminListingDetail({ data: { id } }) });
  const { run, busy } = useRunner();
  const { act } = useListingActions();
  const { openListing, openUser } = useSheets();
  const [photo, setPhoto] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLInputElement>(null);

  async function decide(action: "approve" | "reject", why?: string) {
    const r = await run(
      () => adminListingsAction({ data: { ids: [id], action, reason: why, notify: true } }),
      action === "approve" ? "İlan onaylandı ve yayına alındı." : "İlan reddedildi; satıcıya bildirildi.",
    );
    if (r) onDecided(id);
  }

  // Keyboard shortcuts while no text field has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        if (e.key === "Escape") setRejecting(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || busy) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        void decide("approve");
      } else if (key === "r") {
        e.preventDefault();
        setRejecting(true);
        setTimeout(() => reasonRef.current?.focus(), 0);
      } else if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        onStep(1);
      } else if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        onStep(-1);
      } else if (e.key === "ArrowRight") {
        setPhoto((p) => p + 1);
      } else if (e.key === "ArrowLeft") {
        setPhoto((p) => Math.max(0, p - 1));
      } else if (rejecting && /^[1-7]$/.test(e.key)) {
        const preset = REJECT_REASONS[Number(e.key) - 1];
        if (preset) void decide("reject", preset);
      } else if (key === "c") {
        void act([id], "move");
      } else if (key === "e") {
        openListing(id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (q.isLoading) {
    return (
      <Card className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
        <Spinner /> İlan yükleniyor…
      </Card>
    );
  }
  if (q.error || !q.data) {
    return (
      <Card>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Card>
    );
  }

  const d = q.data;
  const l = d.listing;
  const images = l.images;
  const current = images.length ? images[Math.min(photo, images.length - 1)] : null;
  const s = d.seller;
  const firstTime = s && s.listings_total <= 1;

  return (
    <div className="min-w-0 space-y-4 pb-24">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted">
          <span className="font-semibold text-fg">
            {position} / {n(total)}
          </span>
          <span>·</span>
          <span className="font-mono">#{l.listing_no}</span>
          <span>·</span>
          <span>{dateTime(l.created_at)} ({relative(l.created_at)})</span>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onStep(-1)} aria-label="Önceki ilan">
              <ChevronUp className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onStep(1)} aria-label="Sonraki ilan">
              <ChevronDown className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openListing(id)}>
              <PanelRightOpen className="size-4" /> Ayrıntı
            </Button>
            <a href={`/ilan/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted hover:bg-elevated hover:text-fg">
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="border-b border-border bg-ink/[0.03] p-4 xl:border-b-0 xl:border-r">
            {current ? (
              <>
                <a href={photoSrc(current, 800)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border bg-black/5">
                  <img src={photoSrc(current, 800)} alt="" className="mx-auto aspect-[4/3] w-full object-contain" />
                </a>
                {images.length > 1 ? (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                    {images.map((img, i) => (
                      <button
                        key={img + i}
                        type="button"
                        onClick={() => setPhoto(i)}
                        className={cn("shrink-0 overflow-hidden rounded-lg border-2", i === Math.min(photo, images.length - 1) ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
                      >
                        <img src={photoSrc(img, 240)} alt="" className="size-14 object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">Fotoğraf yok</div>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs text-muted">{d.path.map((p) => p.name).join(" › ")}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug">{l.title}</h2>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{money(l.price, l.currency)}</p>
              <p className="mt-1 text-sm text-muted">{[l.city, l.district, l.neighborhood].filter(Boolean).join(" / ")}</p>
            </div>

            {Object.keys(l.attrs).length ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-elevated/50 p-3 text-xs">
                {Object.entries(l.attrs).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="truncate text-right font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border p-3 text-sm leading-relaxed">{l.description}</div>

            {s ? (
              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.display_name} src={s.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openUser(s.user_id)} className="truncate text-sm font-semibold hover:text-primary hover:underline">
                      {s.display_name}
                    </button>
                    <p className="truncate text-xs text-muted">
                      {s.email ?? "—"} · üyelik {relative(s.created_at)}
                    </p>
                  </div>
                  {firstTime ? <Pill tone="primary">İlk ilanı</Pill> : null}
                  {s.banned ? <Pill tone="danger">Askıda</Pill> : null}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  <MiniStat label="İlan" value={n(s.listings_total)} />
                  <MiniStat label="Yayında" value={n(s.listings_active)} />
                  <MiniStat label="Red" value={n(s.listings_rejected)} tone={s.listings_rejected ? "warn" : undefined} />
                  <MiniStat label="Şikayet" value={n(s.reports_against)} tone={s.reports_against ? "danger" : undefined} />
                </div>
                {!s.email_verified || s.listings_rejected >= 2 || s.reports_against > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {!s.email_verified ? (
                      <li className="flex items-center gap-1.5 text-warn">
                        <AlertTriangle className="size-3.5" /> E-posta doğrulanmamış
                      </li>
                    ) : null}
                    {s.listings_rejected >= 2 ? (
                      <li className="flex items-center gap-1.5 text-warn">
                        <AlertTriangle className="size-3.5" /> Daha önce {s.listings_rejected} ilanı reddedilmiş
                      </li>
                    ) : null}
                    {s.reports_against > 0 ? (
                      <li className="flex items-center gap-1.5 text-danger">
                        <ShieldAlert className="size-3.5" /> İlanları hakkında {s.reports_against} şikayet var
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="sticky bottom-4 z-20 rounded-2xl border border-border bg-surface/95 p-3 shadow-xl backdrop-blur">
        {rejecting ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((r, i) => (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => void decide("reject", r)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-left text-xs hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
                >
                  <Kbd>{i + 1}</Kbd> {r}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (reason.trim()) void decide("reject", reason.trim());
              }}
            >
              <input ref={reasonRef} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Başka bir gerekçe yazın ve Enter'a basın…" className="h-9 flex-1 rounded-lg border border-border px-3 text-sm outline-none focus:border-danger focus:ring-2 focus:ring-danger/15" />
              <Button type="submit" size="sm" variant="danger" disabled={busy || !reason.trim()}>
                Reddet
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(false)}>
                Vazgeç
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button className="bg-ok text-white hover:bg-ok/90" disabled={busy} onClick={() => void decide("approve")}>
              {busy ? <Spinner /> : <Check className="size-4" />} Onayla <Kbd>A</Kbd>
            </Button>
            <Button variant="outline" className="text-danger" disabled={busy} onClick={() => setRejecting(true)}>
              <X className="size-4" /> Reddet <Kbd>R</Kbd>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void act([id], "move")}>
              <FolderInput className="size-4" /> Kategori düzelt <Kbd>C</Kbd>
            </Button>
            <Button variant="ghost" className="ml-auto" onClick={() => onStep(1)}>
              Atla <Kbd>J</Kbd>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
        <Keyboard className="size-4" /> Kısayollar
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-border bg-surface p-3 text-xs shadow-xl">
          {[
            ["A", "Onayla"],
            ["R", "Reddet (1-7 hazır gerekçe)"],
            ["J / ↓", "Sonraki ilan"],
            ["K / ↑", "Önceki ilan"],
            ["← →", "Fotoğraflar arasında gez"],
            ["C", "Kategoriyi düzelt"],
            ["E", "Ayrıntı panelini aç"],
            ["Esc", "Ret formunu kapat"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-1">
              <span className="text-muted">{v}</span>
              <Kbd>{k}</Kbd>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
