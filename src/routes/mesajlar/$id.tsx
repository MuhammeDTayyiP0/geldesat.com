import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Ban,
  Check,
  CheckCheck,
  ChevronLeft,
  ExternalLink,
  Flag,
  ImageIcon,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  blockUser,
  unblockUser,
  getThread,
  markThreadRead,
  pollThread,
  reportListing,
  sendMessage,
} from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { formatPrice, LISTING_PHOTO_MSG, pingInbox, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/mesajlar/$id")({ component: Thread });

type Msg = { id: string; sender_id: string; content: string; created_at: string; read_at: string | null };

const QUICK_REPLIES = [
  "Merhaba, ilan hâlâ güncel mi?",
  "Fiyatta pazarlık payı var mı?",
  "Nerede buluşabiliriz?",
  "Son fiyatınız nedir?",
  "Kargo ile gönderim yapıyor musunuz?",
];

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
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);
  const [listingId, setListingId] = useState("");
  const [otherId, setOtherId] = useState("");
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSafetyNotice, setShowSafetyNotice] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const lastRef = useRef<string | undefined>(undefined);
  const stickRef = useRef(true);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const initialHeight = window.innerHeight;
    const syncViewport = () => {
      document.documentElement.style.setProperty("--chat-viewport-height", `${Math.round(viewport.height)}px`);
      document.documentElement.style.setProperty("--chat-viewport-offset", `${Math.round(viewport.offsetTop)}px`);
      const inputFocused = document.activeElement === box.current;
      const keyboardOpen = inputFocused && viewport.height < initialHeight - 100;
      document.documentElement.style.setProperty(
        "--chat-bottom-inset",
        keyboardOpen ? "0px" : "env(safe-area-inset-bottom, 0px)",
      );
    };

    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      document.documentElement.style.removeProperty("--chat-viewport-height");
      document.documentElement.style.removeProperty("--chat-viewport-offset");
      document.documentElement.style.removeProperty("--chat-bottom-inset");
    };
  }, []);

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
        setOtherAvatar((t.conversation as { other_avatar?: string | null }).other_avatar ?? null);
        setOtherLastSeen((t.conversation as { other_last_seen?: string | null }).other_last_seen ?? null);
        setListingId(t.conversation.listing_id);
        setOtherId(t.conversation.buyer_id === userId ? t.conversation.seller_id : t.conversation.buyer_id);
        setBlockedByMe(Boolean(t.blockedByMe));
        setBlockedByOther(Boolean(t.blockedByOther));
        setMessages(t.messages);
        lastRef.current = t.messages.at(-1)?.created_at;
        stickRef.current = true;
        setLoading(false);
        pingInbox();

        // Mobilde zorla klavye açılmasını engelle; sadece masaüstünde otomatik odaklan
        if (typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          requestAnimationFrame(() => box.current?.focus());
        }
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

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void markThreadRead({ data: { conversationId: id } }).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

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
    const nextH = Math.min(el.scrollHeight, 128);
    el.style.height = `${nextH}px`;
    if (scroller.current && stickRef.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
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
      if (typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        requestAnimationFrame(() => box.current?.focus());
      }
    }
  }

  if (isPending) return <BrandSpinner fullPage text="Sohbet yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  let lastDay = "";
  let lastSender = "";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* 1. Üst Başlık: Kullanıcı Profili ve Eylemler */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2.5 shadow-2xs">
        <Link
          to="/mesajlar"
          className="grid size-10 place-items-center rounded-xl hover:bg-elevated md:hidden text-fg transition-colors"
          aria-label="Gelen kutusu"
        >
          <ChevronLeft className="size-6" />
        </Link>

        {loading ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-elevated" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-28 animate-pulse rounded bg-elevated" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-elevated" />
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative size-10 shrink-0">
              {otherAvatar ? (
                <img
                  src={otherAvatar}
                  alt=""
                  className="size-10 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-elevated to-border/80 text-sm font-bold text-fg ring-1 ring-border/50">
                  {other.slice(0, 1).toLocaleUpperCase("tr")}
                </div>
              )}
              <span
                className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-surface bg-ok"
                title="Aktif"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-fg">{other}</p>
              <p className="truncate text-[11px] text-muted">
                {otherLastSeen ? `Son görülme: ${timeAgo(otherLastSeen)}` : "GeldeSat Üyesi"}
              </p>
            </div>
          </div>
        )}

        {otherId ? (
          <div className="flex shrink-0 items-center gap-1">
            {listingId ? (
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg"
                aria-label="Şikayet et"
                title="Konuşmayı şikayet et"
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
              className={`grid size-9 place-items-center rounded-lg transition-colors hover:bg-elevated ${
                blockedByMe ? "text-danger" : "text-muted hover:text-fg"
              }`}
              aria-label={blockedByMe ? "Engeli kaldır" : "Engelle"}
              title={blockedByMe ? "Engeli kaldır" : "Engelle"}
              onClick={() => void handleToggleBlock()}
            >
              {blockedByMe ? <ShieldCheck className="size-4" /> : <Ban className="size-4" />}
            </button>
          </div>
        ) : null}
      </div>

      {/* 2. İlan Mini Kartı (Kullanıcı isminden ayrı, bağımsız kart) */}
      {slug ? (
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-surface/90 px-3 py-2 text-xs backdrop-blur-xs">
          <Link
            to="/ilan/$slug"
            params={{ slug }}
            className="flex min-w-0 flex-1 items-center gap-2.5 hover:opacity-85 transition-opacity"
          >
            {image ? (
              <img
                src={image}
                alt=""
                className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-border"
              />
            ) : (
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated text-xs font-semibold text-muted">
                İlan
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-fg">{title}</p>
              {price != null ? (
                <p className="text-xs font-bold text-primary tabular-nums">{formatPrice(price)}</p>
              ) : null}
            </div>
          </Link>
          <Link
            to="/ilan/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated/60 px-2.5 py-1 text-[11px] font-semibold text-fg transition-colors hover:bg-elevated"
          >
            <span>İlanı Gör</span>
            <ExternalLink className="size-3 text-muted" />
          </Link>
        </div>
      ) : null}

      {/* 3. Güvenlik ve Dolandırıcılık Uyarı Şeridi */}
      {showSafetyNotice ? (
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-xl border border-warn/30 bg-warn/8 px-3 py-2 text-xs text-warn shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="size-4 shrink-0 text-warn" />
            <span className="truncate text-[11px] font-medium">
              Güvenliğiniz için kapora göndermeyin ve site dışı ödeme bağlantılarına tıklamayın.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSafetyNotice(false)}
            className="shrink-0 rounded p-1 text-muted hover:text-fg hover:bg-warn/15 transition-colors"
            aria-label="Uyarıyı kapat"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* 4. Mesaj Akış Alanı */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto px-3 py-4"
        aria-live="polite"
      >
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center py-12">
            <BrandSpinner size="md" text="Mesajlar yükleniyor…" />
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-danger">{error}</p>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-muted">Henüz mesaj yok.</p>
            <p className="mt-1 text-xs text-subtle">Aşağıdaki hazır sorulardan birini seçebilir veya yazmaya başlayabilirsiniz.</p>
          </div>
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
              <div key={m.id} className={clustered ? "mt-1.5" : "mt-3.5"}>
                {showDay ? (
                  <div className="my-3.5 flex justify-center">
                    <span className="rounded-full border border-border/60 bg-elevated/90 px-3 py-0.5 text-[11px] font-semibold text-muted shadow-2xs backdrop-blur-xs">
                      {day}
                    </span>
                  </div>
                ) : null}

                <div className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && !clustered ? (
                    <div className="relative size-7 shrink-0 -mb-0.5">
                      {otherAvatar ? (
                        <img
                          src={otherAvatar}
                          alt=""
                          className="size-7 rounded-full object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="grid size-7 place-items-center rounded-full bg-elevated text-[11px] font-bold text-fg ring-1 ring-border/50">
                          {other.slice(0, 1).toLocaleUpperCase("tr")}
                        </div>
                      )}
                    </div>
                  ) : !mine ? (
                    <div className="size-7 shrink-0" aria-hidden="true" />
                  ) : null}

                  <div
                    className={`max-w-[min(85%,26rem)] px-3.5 py-2.5 text-sm break-words shadow-2xs ${
                      mine
                        ? `bg-primary text-primary-fg ${
                            clustered ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-br-xs"
                          }`
                        : `border border-border/80 bg-surface text-fg ${
                            clustered ? "rounded-2xl rounded-bl-sm" : "rounded-2xl rounded-bl-xs"
                          }`
                    } ${pending ? "opacity-75" : ""}`}
                  >
                    {m.content === LISTING_PHOTO_MSG && image ? (
                      <div className="space-y-1">
                        <img
                          src={image}
                          alt="İlan görseli"
                          className="max-h-56 w-full rounded-xl object-cover ring-1 ring-border/40"
                        />
                        <p className="text-[11px] opacity-80">İlan görseli</p>
                      </div>
                    ) : m.content === LISTING_PHOTO_MSG ? (
                      <p>İlan görseli</p>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    )}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[11px] select-none ${
                        mine ? "text-primary-fg/80" : "text-subtle"
                      }`}
                    >
                      <span>{clock(m.created_at)}</span>
                      {mine ? (
                        m.read_at ? (
                          <span
                            className="flex items-center text-cyan-200"
                            title={`Okundu: ${clock(m.read_at)}`}
                          >
                            <CheckCheck className="size-3.5" aria-label="Görüldü" />
                          </span>
                        ) : (
                          <span
                            className="flex items-center text-primary-fg/70"
                            title={pending ? "Gönderiliyor" : "İletildi"}
                          >
                            <Check className="size-3.5" aria-label={pending ? "Gönderiliyor" : "İletildi"} />
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Hızlı Cevap Çipleri (Mobilde yazmayı hızlandırır) */}
      {messages.length <= 4 && !blockedByMe && !blockedByOther ? (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-1.5 scrollbar-none border-t border-border/40 bg-surface/50">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setText(q);
                if (box.current) {
                  box.current.focus();
                  grow(box.current);
                }
              }}
              className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg shadow-2xs hover:bg-elevated hover:border-primary/40 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      {/* 6. Mesaj Gönderme Formu & Klavye / Safe-Area Desteği */}
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
          <p className="text-sm font-medium text-muted">
            Bu kullanıcı sizinle iletişimi kısıtladı. Mesaj gönderemezsiniz.
          </p>
        </div>
      ) : (
        <form
          className="chat-composer flex items-end gap-2 border-t border-border bg-surface p-2.5"
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
              title="İlan fotoğrafını mesaja ekle"
              disabled={busy || Boolean(error)}
              onClick={() => void submit(LISTING_PHOTO_MSG)}
              className="size-11 shrink-0 rounded-xl"
            >
              <ImageIcon className="size-4 text-muted hover:text-fg" />
            </Button>
          ) : null}

          <textarea
            ref={box}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              grow(e.target);
            }}
            onFocus={() => {
              // Klavyenin açılma animasyonunu bekleyip mesaj listesini en alta kaydır
              setTimeout(() => {
                if (scroller.current) {
                  scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
                }
              }, 180);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Mesajınızı yazın…"
            maxLength={2000}
            rows={1}
            disabled={Boolean(error)}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-base md:text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
          />

          <Button
            type="submit"
            size="icon"
            disabled={busy || !text.trim() || Boolean(error)}
            aria-label="Gönder"
            className="size-11 shrink-0 rounded-xl"
          >
            <Send className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
