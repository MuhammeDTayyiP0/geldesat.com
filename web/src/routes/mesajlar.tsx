import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, Mail, MailOpen, MessageCircle, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { archiveConversation, deleteConversation, listConversations, markConversationUnread } from "@/lib/server/chat";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { DropdownMenu, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChatAvatar, ConfirmDialog, MenuContent, MenuItem } from "@/components/chat/ChatUi";
import { inboxTime, previewText } from "@/lib/chat-shared";
import { photoSrc } from "@/lib/images";
import { cn, formatPrice } from "@/lib/utils";

export const Route = createFileRoute("/mesajlar")({
  head: () => ({ meta: [{ title: "Mesajlarım | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: MessagesLayout,
});

type Conv = Awaited<ReturnType<typeof listConversations>>[number];
type Tab = "all" | "buying" | "selling" | "unread" | "archived";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "buying", label: "Alıyorum" },
  { key: "selling", label: "Satıyorum" },
  { key: "unread", label: "Okunmamış" },
  { key: "archived", label: "Arşiv" },
];

const LISTING_STATE: Record<string, string> = { SOLD: "Satıldı", INACTIVE: "Yayında değil", REMOVED: "İlan kaldırıldı", PENDING: "Onayda" };

function MessagesLayout() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Conv | null>(null);
  const activeId = useRouterState({
    select: (s) => (s.matches.find((x) => x.routeId === "/mesajlar/$id")?.params as { id?: string } | undefined)?.id,
  });
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => {
    if (!user) return;
    let stop = false;
    let pending: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const next = await listConversations();
        if (stop) return;
        setRows(next);
        setErr("");
      } catch {
        if (!stop) setErr("Konuşmalar yüklenemedi.");
      } finally {
        if (!stop) setLoaded(true);
      }
    }
    /** Coalesce bursts of inbox events into one reload. */
    const reloadSoon = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => void load(), 500);
    };
    void load();

    const on = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string; conversationId?: string; message?: { sender_id: string; content: string; kind?: string; created_at: string } }>).detail;
      if (detail?.type === "new_message" && detail.message && detail.conversationId) {
        const { conversationId, message } = detail;
        let known = false;
        setRows((prev) => {
          const idx = prev.findIndex((c) => c.id === conversationId);
          if (idx === -1) return prev;
          known = true;
          const item = prev[idx];
          const updated: Conv = {
            ...item,
            last_content: message.content,
            last_kind: message.kind ?? "text",
            last_deleted: false,
            last_sender_id: message.sender_id,
            updated_at: message.created_at,
            archived: false,
            unread: item.id === activeRef.current ? 0 : item.unread + 1,
          };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        });
        if (!known) reloadSoon();
        return;
      }
      reloadSoon();
    };
    window.addEventListener("geldesat:inbox", on);
    // Live updates come over the shared chat stream; this is only a safety net.
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => {
      stop = true;
      if (pending) clearTimeout(pending);
      window.removeEventListener("geldesat:inbox", on);
      window.clearInterval(tick);
    };
  }, [user]);

  const counts = useMemo(() => {
    const live = rows.filter((c) => !c.archived);
    return {
      all: live.length,
      buying: live.filter((c) => c.role === "buying").length,
      selling: live.filter((c) => c.role === "selling").length,
      unread: live.filter((c) => (c.unread > 0 || c.marked_unread) && c.id !== activeId).length,
      archived: rows.length - live.length,
    };
  }, [rows, activeId]);

  const filtered = useMemo(() => {
    let list = tab === "archived" ? rows.filter((c) => c.archived) : rows.filter((c) => !c.archived);
    if (tab === "buying" || tab === "selling") list = list.filter((c) => c.role === tab);
    if (tab === "unread") list = list.filter((c) => c.unread > 0 || c.marked_unread);
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return list;
    return list.filter(
      (c) =>
        c.other_name.toLocaleLowerCase("tr").includes(s) ||
        c.listing_title.toLocaleLowerCase("tr").includes(s) ||
        c.last_content.toLocaleLowerCase("tr").includes(s),
    );
  }, [rows, q, tab]);

  if (isPending) return <BrandSpinner fullPage text="Mesajlarınız yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  async function act(c: Conv, run: () => Promise<unknown>, patch: Partial<Conv>, done: string) {
    setRows((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    try {
      await run();
      toast.success(done);
    } catch (e) {
      setRows((prev) => prev.map((x) => (x.id === c.id ? c : x)));
      toast.error(e instanceof Error ? e.message : "İşlem başarısız oldu");
    }
  }

  return (
    <div data-chat-pane={activeId ? "thread" : "list"} className="flex min-h-0 flex-1 overflow-hidden border-t border-border bg-bg">
      <aside className="chat-list flex w-full shrink-0 flex-col border-r border-border bg-surface md:w-84 lg:w-96">
        <div className="space-y-2.5 border-b border-border px-3.5 pb-2.5 pt-3.5">
          <h1 className="text-lg font-bold tracking-tight">Mesajlar</h1>
          {rows.length > 0 ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Kişi, ilan veya mesaj ara"
                  aria-label="Konuşmalarda ara"
                  className="h-10 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm"
                />
              </div>
              <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Sohbet filtresi">
                {TABS.filter((t) => t.key !== "archived" || counts.archived > 0).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                      tab === t.key ? "border-primary bg-primary text-primary-fg" : "border-border text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    {t.label}
                    {counts[t.key] > 0 && t.key !== "all" ? (
                      <span className={cn("rounded-full px-1.5 text-[10px] leading-4", tab === t.key ? "bg-white/25" : "bg-elevated")}>{counts[t.key]}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {!loaded ? (
          <div className="flex justify-center px-4 py-16">
            <BrandSpinner size="sm" text="Sohbetler yükleniyor…" />
          </div>
        ) : err ? (
          <p className="p-6 text-center text-sm text-danger">{err}</p>
        ) : rows.length === 0 ? (
          <div className="m-4 rounded-2xl border border-dashed border-border p-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-elevated">
              <MessageCircle className="size-6 text-muted" />
            </span>
            <p className="mt-3 text-sm font-semibold">Henüz mesajınız yok</p>
            <p className="mt-1 text-xs text-muted">İlgilendiğiniz bir ilanın sayfasından satıcıya soru sorabilirsiniz.</p>
            <Link to="/search" className="mt-4 inline-flex rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90">
              İlanlara göz atın
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted">{q ? "Aramanızla eşleşen sohbet yok." : "Bu bölümde sohbet yok."}</p>
            {tab !== "all" || q ? (
              <button
                type="button"
                onClick={() => {
                  setTab("all");
                  setQ("");
                }}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Tüm sohbetleri göster
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-auto pb-24 md:pb-0">
            {filtered.map((c) => {
              const on = c.id === activeId;
              const unread = on ? 0 : c.unread;
              const flagged = !on && (unread > 0 || c.marked_unread);
              const text = previewText(c.last_kind, c.last_content, c.last_deleted);
              const preview = !c.last_content ? "Mesaj yok" : c.last_sender_id === user.id ? `Siz: ${text}` : text;
              const listingState = LISTING_STATE[c.listing_status];
              return (
                <li key={c.id} className="group relative border-b border-border/60">
                  <Link
                    to="/mesajlar/$id"
                    params={{ id: c.id }}
                    className={cn(
                      "flex items-center gap-3 py-3 pl-3 pr-11 transition-colors hover:bg-elevated/60",
                      on && "bg-primary/6 shadow-[inset_3px_0_0_var(--color-primary)]",
                    )}
                  >
                    <ChatAvatar src={c.other_avatar} name={c.other_name} online={c.other_online} closed={c.other_closed} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate text-[15px]", flagged ? "font-bold" : "font-medium", c.other_closed && "text-muted")}>{c.other_name}</p>
                        <span className={cn("shrink-0 text-[11px] tabular-nums", flagged ? "font-semibold text-primary" : "text-subtle")}>
                          {inboxTime(c.updated_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                        <span className={cn("shrink-0 rounded px-1 text-[10px] font-semibold", c.role === "selling" ? "bg-ok/10 text-ok" : "bg-primary/10 text-primary")}>
                          {c.role === "selling" ? "Satış" : "Alış"}
                        </span>
                        <span className="truncate">{c.listing_title}</span>
                        {listingState ? <span className="shrink-0 text-warn">· {listingState}</span> : c.price ? <span className="shrink-0 tabular-nums">· {formatPrice(c.price)}</span> : null}
                      </p>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className={cn("truncate text-[13px]", flagged ? "font-semibold text-fg" : "text-muted", c.last_deleted && "italic")}>{preview}</p>
                        {unread > 0 ? (
                          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-fg">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : flagged ? (
                          <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="Okunmadı olarak işaretli" />
                        ) : null}
                      </div>
                    </div>
                    {c.listing_image ? (
                      <img src={photoSrc(c.listing_image, 240)} alt="" className="hidden size-11 shrink-0 rounded-lg object-cover ring-1 ring-border sm:block" />
                    ) : null}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`${c.other_name} sohbeti için seçenekler`}
                      className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted opacity-100 hover:bg-elevated hover:text-fg data-[state=open]:bg-elevated md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <MenuContent align="end">
                      {flagged ? (
                        <MenuItem onSelect={() => void act(c, () => markConversationUnread({ data: { conversationId: c.id, unread: false } }), { marked_unread: false }, "Okundu olarak işaretlendi")}>
                          <MailOpen /> Okundu işaretle
                        </MenuItem>
                      ) : (
                        <MenuItem onSelect={() => void act(c, () => markConversationUnread({ data: { conversationId: c.id, unread: true } }), { marked_unread: true }, "Okunmadı olarak işaretlendi")}>
                          <Mail /> Okunmadı işaretle
                        </MenuItem>
                      )}
                      <MenuItem
                        onSelect={() =>
                          void act(
                            c,
                            () => archiveConversation({ data: { conversationId: c.id, archived: !c.archived } }),
                            { archived: !c.archived },
                            c.archived ? "Arşivden çıkarıldı" : "Arşivlendi",
                          )
                        }
                      >
                        {c.archived ? <ArchiveRestore /> : <Archive />} {c.archived ? "Arşivden çıkar" : "Arşivle"}
                      </MenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <MenuItem danger onSelect={() => setConfirmDelete(c)}>
                        <Trash2 /> Sohbeti sil
                      </MenuItem>
                    </MenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <section className="chat-thread flex min-w-0 flex-1 flex-col">
        <Outlet />
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Sohbet silinsin mi?"
        body="Sohbet sadece sizin mesaj kutunuzdan kalkar; karşı taraf görmeye devam eder. Yeni bir mesaj gelirse sohbet geri açılır."
        confirmLabel="Sohbeti sil"
        danger
        onConfirm={async () => {
          const c = confirmDelete;
          if (!c) return;
          try {
            await deleteConversation({ data: { conversationId: c.id } });
            setRows((prev) => prev.filter((x) => x.id !== c.id));
            toast.success("Sohbet silindi");
            if (c.id === activeId) void navigate({ to: "/mesajlar" });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Sohbet silinemedi");
          }
        }}
      />
    </div>
  );
}
