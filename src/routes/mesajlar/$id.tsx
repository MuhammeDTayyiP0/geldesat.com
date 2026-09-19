import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, Check, CheckCheck, ChevronLeft, Flag, ImageIcon, Send, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { blockUser, unblockUser, getThread, markThreadRead, pollThread, reportListing, sendMessage } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { formatPrice, LISTING_PHOTO_MSG, pingInbox } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/mesajlar/$id")({ component: Thread });

type Msg = { id: string; sender_id: string; content: string; created_at: string; read_at: string | null };

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === yday.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function clock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function Thread() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [other, setOther] = useState("Üye");
  const [listingId, setListingId] = useState("");
  const [otherId, setOtherId] = useState("");
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const lastRef = useRef<string | undefined>(undefined);
  const stickRef = useRef(true);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let stop = false;
    setMessages([]);
    setError("");
    setLoading(true);
    lastRef.current = undefined;

    void getThread({ data: { conversationId: id } })
      .then((t) => {
        if (stop) return;
        setTitle(t.conversation.listing_title);
        setSlug(t.conversation.listing_slug);
        setImage(t.conversation.listing_image);
        setPrice(t.conversation.listing_price);
        setOther(t.conversation.other_name);
        setListingId(t.conversation.listing_id);
        setOtherId(t.conversation.buyer_id === userId ? t.conversation.seller_id : t.conversation.buyer_id);
        setBlockedByMe(Boolean(t.blockedByMe));
        setBlockedByOther(Boolean(t.blockedByOther));
        setMessages(t.messages);
        lastRef.current = t.messages.at(-1)?.created_at;
        stickRef.current = true;
        setLoading(false);
        pingInbox();
        requestAnimationFrame(() => box.current?.focus());
      })
      .catch((e) => {
        if (stop) return;
        setError(e instanceof Error ? e.message : "Açılamadı");
        setLoading(false);
        toast.error(e instanceof Error ? e.message : "Açılamadı");
      });

    // Real-time SSE connection for sub-10ms instant message push & read updates
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/chat/stream?conversationId=${encodeURIComponent(id)}`);
      es.onmessage = (event) => {
        if (stop) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message" && data.message) {
            const m = data.message as Msg;
            setMessages((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev;
              const cleaned = prev.filter((x) => {
                if (x.id.startsWith("tmp_") && x.sender_id === m.sender_id && x.content === m.content) {
                  return false;
                }
                return true;
              });
              return [...cleaned, m];
            });
            lastRef.current = m.created_at;
            pingInbox();

            // Karşı taraftan gelen yeni mesaj ekrana düştüğünde ve sekme görünür durumdaysa ANINDA okundu onayı ilet!
            if (m.sender_id !== userId && document.visibilityState === "visible") {
              void markThreadRead({ data: { conversationId: id, messageIds: [m.id] } }).catch(() => undefined);
            }
          } else if (data.type === "read" && Array.isArray(data.reads)) {
            const reads = data.reads as { id: string; read_at: string }[];
            if (reads.length > 0) {
              const map = new Map(reads.map((r) => [r.id, r.read_at]));
              setMessages((prev) => prev.map((m) => (map.has(m.id) ? { ...m, read_at: map.get(m.id)! } : m)));
            }
          }
        } catch {
          // ignore keepalive or parse error
        }
      };
    } catch {
      // EventSource failed to create
    }

    // Sekmeye geri dönüldüğünde veya pencereye odaklanıldığında okunmamış mesajları hemen okundu yap
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void markThreadRead({ data: { conversationId: id } }).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    // Relaxed background fallback poll (every 15s) in case SSE is interrupted by client network
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void pollThread({ data: { conversationId: id, after: lastRef.current } })
        .then((extra) => {
          if (stop) return;
          const incoming = extra.messages;
          const reads = extra.reads;
          if (!incoming.length && !reads.length) return;
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const fresh = incoming.filter((m) => !ids.has(m.id));
            let next = fresh.length ? [...prev, ...fresh] : prev;
            if (fresh.length > 0) {
              const freshContents = new Set(fresh.map((m) => `${m.sender_id}:${m.content}`));
              next = next.filter((m) => !m.id.startsWith("tmp_") || !freshContents.has(`${m.sender_id}:${m.content}`));
            }
            if (reads.length) {
              const map = new Map(reads.map((r) => [r.id, r.read_at]));
              next = next.map((m) => (map.has(m.id) ? { ...m, read_at: map.get(m.id)! } : m));
            }
            const lastReal = [...next].reverse().find((m) => !m.id.startsWith("tmp_"));
            if (lastReal) lastRef.current = lastReal.created_at;
            return next;
          });
          if (incoming.length) pingInbox();
        })
        .catch(() => undefined);
    }, 15000);

    return () => {
      stop = true;
      if (es) {
        es.close();
      }
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [id, userId]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
  }

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  async function handleToggleBlock() {
    if (!otherId || busy) return;
    if (blockedByMe) {
      try {
        setBusy(true);
        await unblockUser({ data: { userId: otherId } });
        setBlockedByMe(false);
        toast.success(`${other} engelini kaldırdınız`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Engel kaldırılamadı");
      } finally {
        setBusy(false);
      }
    } else {
      if (!confirm(`${other} engellensin mi? Karşılıklı mesaj gönderemezsiniz.`)) return;
      try {
        setBusy(true);
        await blockUser({ data: { userId: otherId } });
        setBlockedByMe(true);
        toast.success("Kullanıcı engellendi");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Engellenemedi");
      } finally {
        setBusy(false);
      }
    }
  }

  async function submit(raw?: string) {
    const content = (raw ?? text).trim();
    if (!content || busy || !user || blockedByMe || blockedByOther) return;
    const tempId = `tmp_${crypto.randomUUID().slice(0, 12)}`;
    const optimistic: Msg = {
      id: tempId,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setBusy(true);
    if (!raw) setText("");
    stickRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    if (box.current) {
      box.current.style.height = "auto";
    }
    try {
      const sent = await sendMessage({ data: { conversationId: id, content } });
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId && m.id !== sent.id);
        return [...withoutTemp, sent];
      });
      lastRef.current = sent.created_at;
      pingInbox();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (!raw) setText(content);
      toast.error(err instanceof Error ? err.message : "Gönderilemedi");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => box.current?.focus());
    }
  }

  if (isPending) return <p className="p-10 text-center text-muted">Yükleniyor…</p>;
  if (!user) return <RedirectToSignIn />;

  let lastDay = "";
  let lastSender = "";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2">
        <Link
          to="/mesajlar"
          className="grid size-11 place-items-center rounded-md hover:bg-elevated md:hidden"
          aria-label="Gelen kutusu"
        >
          <ChevronLeft className="size-5" />
        </Link>
        {loading ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1">
            <div className="size-11 shrink-0 animate-pulse rounded-md bg-elevated" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-24 animate-pulse rounded bg-elevated" />
              <div className="h-3 w-40 animate-pulse rounded bg-elevated" />
            </div>
          </div>
        ) : slug ? (
          <Link to="/ilan/$slug" params={{ slug }} className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 hover:bg-elevated">
            {image ? (
              <img src={image} alt="" className="size-11 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="grid size-11 shrink-0 place-items-center rounded-md bg-elevated text-sm font-semibold">{other.slice(0, 1)}</div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{other}</p>
              <p className="truncate text-xs text-muted">{title}</p>
            </div>
            {price != null ? (
              <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-primary">{formatPrice(price)}</span>
            ) : null}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1">
            <div className="grid size-11 shrink-0 place-items-center rounded-md bg-elevated text-sm font-semibold">{other.slice(0, 1)}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{other}</p>
              <p className="truncate text-xs text-muted">{listingId ? (title || "İlan yayından kaldırıldı") : "Sohbet"}</p>
            </div>
          </div>
        )}
        {otherId ? (
          <div className="flex shrink-0 items-center gap-1">
            {listingId ? (
              <button
                type="button"
                className="grid size-11 place-items-center rounded-md hover:bg-elevated"
                aria-label="Şikayet et"
                title="Şikayet et"
                onClick={() => {
                  if (!confirm("Bu konuşmayı şikayet etmek istiyor musunuz?")) return;
                  void reportListing({ data: { listingId, reason: "Uygunsuz mesaj" } })
                    .then(() => toast.success("Şikayet alındı"))
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Gönderilemedi"));
                }}
              >
                <Flag className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              className={`grid size-11 place-items-center rounded-md hover:bg-elevated ${blockedByMe ? "text-danger" : ""}`}
              aria-label={blockedByMe ? "Engeli kaldır" : "Engelle"}
              title={blockedByMe ? "Engeli kaldır" : "Engelle"}
              onClick={() => void handleToggleBlock()}
            >
              {blockedByMe ? <ShieldCheck className="size-4" /> : <Ban className="size-4" />}
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto px-3 py-4"
        aria-live="polite"
      >
        {loading ? (
          <p className="py-12 text-center text-sm text-muted">Konuşma yükleniyor…</p>
        ) : error ? (
          <p className="py-12 text-center text-sm text-danger">{error}</p>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Henüz mesaj yok. Yazmaya başlayın.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user.id;
            const day = dayLabel(m.created_at);
            const showDay = day !== lastDay;
            const clustered = !showDay && lastSender === m.sender_id;
            lastDay = day;
            lastSender = m.sender_id;
            const pending = m.id.startsWith("tmp_");
            return (
              <div key={m.id} className={clustered ? "mt-1" : "mt-3"}>
                {showDay ? <p className="my-3 text-center text-xs font-medium text-subtle">{day}</p> : null}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[min(80%,24rem)] px-3 py-2 text-sm break-words ${
                      mine
                        ? `bg-primary text-primary-fg ${clustered ? "rounded-lg rounded-br-sm" : "rounded-lg rounded-br-md"}`
                        : `border border-border bg-surface ${clustered ? "rounded-lg rounded-bl-sm" : "rounded-lg rounded-bl-md"}`
                    } ${pending ? "opacity-70" : ""}`}
                  >
                    {m.content === LISTING_PHOTO_MSG && image ? (
                      <img src={image} alt="İlan görseli" className="max-h-48 w-full rounded-md object-cover" />
                    ) : m.content === LISTING_PHOTO_MSG ? (
                      <p>İlan görseli</p>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                    <p className={`mt-1 flex items-center justify-end gap-1 text-xs ${mine ? "text-primary-fg/70" : "text-subtle"}`}>
                      <span>{clock(m.created_at)}</span>
                      {mine ? (
                        m.read_at ? (
                          <span className="flex items-center text-sky-300 font-semibold drop-shadow-[0_0_2px_rgba(56,189,248,0.6)]" title={`Okundu: ${clock(m.read_at)}`}>
                            <CheckCheck className="size-3.5" aria-label="Görüldü" />
                          </span>
                        ) : (
                          <span className="flex items-center text-primary-fg/60" title={pending ? "Gönderiliyor" : "İletildi"}>
                            <Check className="size-3.5" aria-label={pending ? "Gönderiliyor" : "İletildi"} />
                          </span>
                        )
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {blockedByMe ? (
        <div className="flex flex-col items-center justify-center gap-2 border-t border-border bg-surface px-4 py-4 text-center">
          <p className="text-sm font-medium text-muted">Bu kullanıcıyı engellediniz.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handleToggleBlock()}
          >
            Engeli Kaldır
          </Button>
        </div>
      ) : blockedByOther ? (
        <div className="border-t border-border bg-surface px-4 py-4 text-center">
          <p className="text-sm font-medium text-muted">Bu kullanıcı sizinle iletişimi kısıtladı. Mesaj gönderemezsiniz.</p>
        </div>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-border bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {image ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="İlan fotoğrafını gönder"
              disabled={busy || Boolean(error)}
              onClick={() => void submit(LISTING_PHOTO_MSG)}
            >
              <ImageIcon className="size-4" />
            </Button>
          ) : null}
          <textarea
            ref={box}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              grow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Mesaj yazın"
            maxLength={2000}
            rows={1}
            disabled={Boolean(error)}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Button type="submit" size="icon" disabled={busy || !text.trim() || Boolean(error)} aria-label="Gönder">
            <Send className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
