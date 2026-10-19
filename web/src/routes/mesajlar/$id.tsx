import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Archive,
  Ban,
  ChevronLeft,
  ExternalLink,
  Flag,
  HandCoins,
  ImageIcon,
  ImagePlus,
  Mail,
  MapPin,
  MessageSquareText,
  MoreVertical,
  Paperclip,
  Send,
  ShieldAlert,
  ShieldCheck,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  archiveConversation,
  deleteConversation,
  deleteMessage,
  getChatTemplates,
  getThread,
  loadAroundMessage,
  loadOlderMessages,
  markConversationUnread,
  markThreadRead,
  pollThread,
  reportConversation,
  respondOffer,
  saveChatTemplates,
  searchMessages,
  sendLocation,
  sendMessage,
  sendOffer,
  sendTyping,
} from "@/lib/server/chat";
import { blockUser, unblockUser } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { ChatAvatar, ConfirmDialog, MenuContent, MenuItem } from "@/components/chat/ChatUi";
import { LocationPicker } from "@/components/chat/LocationPicker";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  BUYER_QUICK_REPLIES,
  MAX_TEMPLATE_LENGTH,
  MAX_TEMPLATES,
  previewText,
  SELLER_QUICK_REPLIES,
  type ChatMessage,
} from "@/lib/chat-shared";
import { checkPhotoFile, PHOTO_ACCEPT, photoSrc, preparePhoto } from "@/lib/images";
import { uploadChatPhoto } from "@/lib/listing-photos";
import { subscribeChatStream } from "@/lib/chat-stream";
import { cn, formatNumber, formatPrice, pingInbox, timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/mesajlar/$id")({ component: Thread });

type Thread = Awaited<ReturnType<typeof getThread>>;
type Msg = ChatMessage & { localState?: "pending" | "failed" };

const SAFETY_KEY = "geldesat:chat-safety-dismissed";
const REPORT_REASONS = [
  "Dolandırıcılık şüphesi",
  "Hakaret veya taciz",
  "Spam / reklam",
  "Uygunsuz içerik",
  "Diğer",
];
const LISTING_STATE: Record<string, string> = {
  SOLD: "Bu ilan satıldı.",
  INACTIVE: "Bu ilan şu an yayında değil.",
  PENDING: "Bu ilan onay bekliyor.",
  REJECTED: "Bu ilan yayından kaldırıldı.",
  REMOVED: "Bu ilan kaldırıldı.",
};

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

const visible = () => document.visibilityState === "visible";

function Thread() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const userId = user?.id;

  const [info, setInfo] = useState<Thread["conversation"] | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [typingUntil, setTypingUntil] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [safetyHidden, setSafetyHidden] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialog, setDialog] = useState<
    | null
    | "offer"
    | "location"
    | "templates"
    | "report"
    | "delete-chat"
    | "block"
    | { deleteMessage: string }
    | { reportMessage: string }
    | { counterTo: string }
  >(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Awaited<
    ReturnType<typeof searchMessages>
  > | null>(null);
  // Set after jumping to an old message: the newest messages are not loaded.
  const [detached, setDetached] = useState(false);
  const [newWhileDetached, setNewWhileDetached] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<string | undefined>(undefined);
  const stickRef = useRef(true);
  const lastTypingSent = useRef(0);
  const prependAnchor = useRef<{ height: number; top: number } | null>(null);
  const detachedRef = useRef(false);
  detachedRef.current = detached;

  const canMessage = Boolean(info) && !info?.other_closed && !blockedByMe && !blockedByOther;
  const isSeller = info?.role === "selling";
  const typing = typingUntil > Date.now();

  // Keep the composer above the on-screen keyboard on phones.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const initialHeight = window.innerHeight;
    const sync = () => {
      const root = document.documentElement.style;
      root.setProperty("--chat-viewport-height", `${Math.round(viewport.height)}px`);
      root.setProperty("--chat-viewport-offset", `${Math.round(viewport.offsetTop)}px`);
      const keyboardOpen =
        document.activeElement === box.current && viewport.height < initialHeight - 100;
      root.setProperty(
        "--chat-bottom-inset",
        keyboardOpen ? "0px" : "env(safe-area-inset-bottom, 0px)",
      );
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      for (const k of ["--chat-viewport-height", "--chat-viewport-offset", "--chat-bottom-inset"])
        document.documentElement.style.removeProperty(k);
    };
  }, []);

  useEffect(() => {
    try {
      setSafetyHidden(localStorage.getItem(SAFETY_KEY) === "1");
    } catch {
      setSafetyHidden(false);
    }
  }, []);

  /** Merge server messages into the list, replacing optimistic copies and updated versions. */
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      let next = prev;
      for (const m of incoming) {
        if (byId.has(m.id)) {
          next = next.map((x) => (x.id === m.id ? { ...m } : x));
        } else {
          next = [...next, m];
        }
      }
      const last = [...next].reverse().find((m) => !m.localState);
      if (last) lastRef.current = last.created_at;
      return next;
    });
  }, []);

  const markRead = useCallback(
    (messageIds?: string[]) => {
      if (!visible()) return;
      void markThreadRead({ data: { conversationId: id, messageIds } })
        .then(() => pingInbox())
        .catch(() => undefined);
    },
    [id],
  );

  useEffect(() => {
    if (!userId) return;
    let stop = false;
    setMessages([]);
    setInfo(null);
    setError("");
    setLoading(true);
    setTypingUntil(0);
    setDetached(false);
    setNewWhileDetached(false);
    lastRef.current = undefined;

    getThread({ data: { conversationId: id } })
      .then((t) => {
        if (stop) return;
        setInfo(t.conversation);
        setMessages(t.messages);
        setHasMore(t.hasMore);
        setFirstUnreadId(t.firstUnreadId);
        setBlockedByMe(t.blockedByMe);
        setBlockedByOther(t.blockedByOther);
        setOnline(t.conversation.other_online);
        setLastSeen(t.conversation.other_last_seen);
        lastRef.current = t.messages.at(-1)?.created_at ?? new Date().toISOString();
        stickRef.current = true;
        setLoading(false);
        markRead();
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches)
          requestAnimationFrame(() => box.current?.focus());
      })
      .catch((e) => {
        if (stop) return;
        setError(e instanceof Error ? e.message : "Sohbet açılamadı");
        setLoading(false);
      });

    const unsubscribe = subscribeChatStream((data) => {
      if (stop) return;
      if ((data.type === "message" || data.type === "message_update") && data.message) {
        const m = data.message as ChatMessage;
        // While an older stretch is shown, new messages would leave a gap; offer a jump back instead.
        if (data.type === "message" && detachedRef.current) setNewWhileDetached(true);
        else merge([m]);
        if (data.type === "message") {
          if (m.sender_id !== userId) {
            setTypingUntil(0);
            setOnline(true);
            markRead([m.id]);
          }
        }
      } else if (data.type === "read" && Array.isArray(data.reads)) {
        const map = new Map(
          (data.reads as { id: string; read_at: string }[]).map((r) => [r.id, r.read_at]),
        );
        setMessages((prev) =>
          prev.map((m) => (map.has(m.id) ? { ...m, read_at: map.get(m.id)! } : m)),
        );
      } else if (data.type === "typing" && data.userId !== userId) {
        setTypingUntil(Date.now() + 4000);
        setOnline(true);
      }
    }, id);

    const onVisible = () => {
      if (visible()) markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Safety net for missed live events (and presence refresh).
    const timer = window.setInterval(() => {
      if (!visible() || !lastRef.current || detachedRef.current) return;
      pollThread({ data: { conversationId: id, after: lastRef.current } })
        .then((extra) => {
          if (stop) return;
          merge(extra.messages);
          if (extra.reads.length) {
            const map = new Map(extra.reads.map((r) => [r.id, r.read_at]));
            setMessages((prev) =>
              prev.map((m) => (map.has(m.id) ? { ...m, read_at: map.get(m.id)! } : m)),
            );
          }
          setOnline(extra.other_online);
          setLastSeen(extra.other_last_seen);
        })
        .catch(() => undefined);
    }, 30_000);

    return () => {
      stop = true;
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [id, userId, merge, markRead, reloadKey]);

  // Re-render when the typing indicator expires.
  useEffect(() => {
    if (!typingUntil) return;
    const t = setTimeout(() => forceTick((n) => n + 1), Math.max(0, typingUntil - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [typingUntil]);

  // Stick to the bottom for new messages; keep position when older ones are prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prependAnchor.current) {
      el.scrollTop = el.scrollHeight - prependAnchor.current.height + prependAnchor.current.top;
      prependAnchor.current = null;
    } else if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, typing]);

  async function loadOlder() {
    if (loadingOlder || !hasMore) return;
    const oldest = messages.find((m) => !m.localState);
    const el = scroller.current;
    if (!oldest || !el) return;
    setLoadingOlder(true);
    try {
      const res = await loadOlderMessages({
        data: { conversationId: id, before: oldest.created_at },
      });
      prependAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((prev) => [
        ...res.messages.filter((m) => !prev.some((p) => p.id === m.id)),
        ...prev,
      ]);
      setHasMore(res.hasMore);
    } catch {
      toast.error("Eski mesajlar yüklenemedi");
    } finally {
      setLoadingOlder(false);
    }
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 120) void loadOlder();
  }

  /** Scroll to a message, loading the stretch around it first if needed, and flash it. */
  async function jumpTo(messageId: string) {
    const flash = () => {
      setHighlightId(messageId);
      requestAnimationFrame(() =>
        document
          .getElementById(`msg-${messageId}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      setTimeout(() => setHighlightId((h) => (h === messageId ? null : h)), 2200);
    };
    stickRef.current = false;
    if (messages.some((m) => m.id === messageId)) return flash();
    try {
      const res = await loadAroundMessage({ data: { conversationId: id, messageId } });
      setMessages(res.messages);
      setHasMore(res.hasMoreBefore);
      setDetached(res.hasMoreAfter);
      setFirstUnreadId(null);
      setTimeout(flash, 50);
    } catch {
      toast.error("Mesaj bulunamadı");
    }
  }

  function backToLatest() {
    setReloadKey((k) => k + 1);
  }

  async function runSearch(q: string) {
    setSearchQ(q);
    if (q.trim().length < 2) return setSearchResults(null);
    try {
      setSearchResults(await searchMessages({ data: { conversationId: id, q: q.trim() } }));
    } catch {
      setSearchResults([]);
    }
  }

  const nameOf = (senderId: string) =>
    senderId === user?.id ? "Siz" : (info?.other_name ?? "Karşı taraf");

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function onType(value: string) {
    setText(value);
    if (value && Date.now() - lastTypingSent.current > 3000) {
      lastTypingSent.current = Date.now();
      void sendTyping({ data: { conversationId: id } }).catch(() => undefined);
    }
  }

  /** Optimistic send; several messages can be in flight at once. */
  async function send(
    content: string,
    tempId = `tmp_${crypto.randomUUID().slice(0, 12)}`,
    quoted: Msg | null = null,
  ) {
    if (!user || !canMessage) return;
    if (detached) backToLatest();
    const optimistic: Msg = {
      id: tempId,
      sender_id: user.id,
      content,
      kind: "text",
      meta: null,
      deleted: false,
      reply: quoted
        ? { id: quoted.id, sender_id: quoted.sender_id, content: quoted.content, kind: quoted.kind }
        : null,
      created_at: new Date().toISOString(),
      read_at: null,
      localState: "pending",
    };
    stickRef.current = true;
    setFirstUnreadId(null);
    setMessages((prev) => [...prev.filter((m) => m.id !== tempId), optimistic]);
    try {
      const sent = await sendMessage({
        data: { conversationId: id, content, replyTo: quoted?.id },
      });
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId && m.id !== sent.id);
        return [...without, sent];
      });
      lastRef.current = sent.created_at;
      pingInbox();
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, localState: "failed" } : m)),
      );
      toast.error(err instanceof Error ? err.message : "Mesaj gönderilemedi");
    }
  }

  function submit() {
    const content = text.trim();
    if (!content) return;
    setText("");
    if (box.current) box.current.style.height = "auto";
    const quoted = replyTo;
    setReplyTo(null);
    void send(content, undefined, quoted);
  }

  /** Send up to 5 photos, one after another, in the order picked. */
  async function sendPhotos(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (files.length > 5)
      toast.warning("Tek seferde en fazla 5 fotoğraf gönderilebilir; ilk 5'i gönderiliyor.");
    setUploading(true);
    try {
      for (const file of files.slice(0, 5)) {
        const problem = checkPhotoFile(file);
        if (problem) {
          toast.error(`${file.name}: ${problem}`);
          continue;
        }
        try {
          const msg = (await uploadChatPhoto(id, await preparePhoto(file))) as ChatMessage;
          stickRef.current = true;
          merge([msg]);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Fotoğraf gönderilemedi");
        }
      }
      pingInbox();
    } finally {
      setUploading(false);
    }
  }

  async function toggleBlock() {
    if (!info) return;
    try {
      if (blockedByMe) {
        await unblockUser({ data: { userId: info.other_id } });
        setBlockedByMe(false);
        toast.success("Engel kaldırıldı");
      } else {
        await blockUser({ data: { userId: info.other_id } });
        setBlockedByMe(true);
        toast.success("Kullanıcı engellendi");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız oldu");
    }
  }

  if (isPending) return <BrandSpinner fullPage text="Sohbet yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  const listingNote = info ? LISTING_STATE[info.listing_status] : undefined;
  const statusLine = !info
    ? ""
    : info.other_closed
      ? "Hesap kapatıldı"
      : typing
        ? "yazıyor…"
        : online
          ? "Çevrimiçi"
          : lastSeen
            ? `Son görülme ${timeAgo(lastSeen)}`
            : "";
  const quickReplies = isSeller ? SELLER_QUICK_REPLIES : BUYER_QUICK_REPLIES;

  let lastDay = "";
  let lastSender = "";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-bg"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Header: person, status, actions */}
      <header className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2 sm:px-3">
        <Link
          to="/mesajlar"
          aria-label="Mesajlara dön"
          className="grid size-10 place-items-center rounded-full hover:bg-elevated md:hidden"
        >
          <ChevronLeft className="size-6" />
        </Link>
        {info ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {info.other_closed ? (
              <ChatAvatar src={null} name={info.other_name} closed className="size-10" />
            ) : (
              <Link
                to="/satici/$id"
                params={{ id: info.other_id }}
                aria-label={`${info.other_name} profili`}
              >
                <ChatAvatar
                  src={info.other_avatar}
                  name={info.other_name}
                  online={online}
                  className="size-10"
                />
              </Link>
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{info.other_name}</p>
              <p
                className={cn(
                  "truncate text-xs",
                  typing ? "font-medium text-primary" : online ? "text-ok" : "text-muted",
                )}
              >
                {statusLine || " "}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-10 animate-pulse rounded-full bg-elevated" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-elevated" />
          </div>
        )}
        {info ? (
          <button
            type="button"
            aria-label="Sohbette ara"
            aria-pressed={searchOpen}
            onClick={() => {
              setSearchOpen((o) => !o);
              setSearchResults(null);
              setSearchQ("");
            }}
            className={cn(
              "grid size-10 place-items-center rounded-full hover:bg-elevated",
              searchOpen ? "text-primary" : "text-muted hover:text-fg",
            )}
          >
            <Search className="size-5" />
          </button>
        ) : null}
        {info ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Sohbet seçenekleri"
              className="grid size-10 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg"
            >
              <MoreVertical className="size-5" />
            </DropdownMenuTrigger>
            <MenuContent align="end">
              {info.listing_slug ? (
                <MenuItem
                  onSelect={() =>
                    void navigate({ to: "/ilan/$slug", params: { slug: info.listing_slug } })
                  }
                >
                  <ExternalLink /> İlanı gör
                </MenuItem>
              ) : null}
              <MenuItem
                onSelect={() =>
                  void markConversationUnread({ data: { conversationId: id, unread: true } }).then(
                    () => {
                      pingInbox();
                      void navigate({ to: "/mesajlar" });
                    },
                  )
                }
              >
                <Mail /> Okunmadı işaretle
              </MenuItem>
              <MenuItem
                onSelect={() =>
                  void archiveConversation({ data: { conversationId: id, archived: true } }).then(
                    () => {
                      toast.success("Sohbet arşivlendi");
                      pingInbox();
                      void navigate({ to: "/mesajlar" });
                    },
                  )
                }
              >
                <Archive /> Arşivle
              </MenuItem>
              <DropdownMenuSeparator className="bg-border" />
              {!info.other_closed ? (
                <MenuItem onSelect={() => (blockedByMe ? void toggleBlock() : setDialog("block"))}>
                  {blockedByMe ? <ShieldCheck /> : <Ban />}{" "}
                  {blockedByMe ? "Engeli kaldır" : "Engelle"}
                </MenuItem>
              ) : null}
              <MenuItem danger onSelect={() => setDialog("report")}>
                <Flag /> Şikayet et
              </MenuItem>
              <MenuItem danger onSelect={() => setDialog("delete-chat")}>
                <Trash2 /> Sohbeti sil
              </MenuItem>
            </MenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {searchOpen ? (
        <div className="relative border-b border-border bg-surface px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => void runSearch(e.target.value)}
              placeholder="Bu sohbette ara"
              aria-label="Bu sohbette ara"
              className="h-10 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm"
            />
          </div>
          {searchResults ? (
            <ul className="absolute inset-x-3 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-surface shadow-lift">
              {searchResults.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted">Sonuç yok.</li>
              ) : (
                searchResults.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchResults(null);
                        void jumpTo(r.id);
                      }}
                      className="block w-full border-b border-border/60 px-3 py-2 text-left hover:bg-elevated"
                    >
                      <span className="flex justify-between gap-2 text-xs text-muted">
                        <span className="font-semibold">{nameOf(r.sender_id)}</span>
                        <span>{new Date(r.created_at).toLocaleDateString("tr-TR")}</span>
                      </span>
                      <span className="line-clamp-2 text-sm">{r.content}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Listing strip */}
      {info && (info.listing_slug || info.listing_title) ? (
        <div className="flex items-center gap-3 border-b border-border/70 bg-surface/95 px-3 py-2">
          {info.listing_image ? (
            <img
              src={photoSrc(info.listing_image, 240)}
              alt=""
              className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-border"
            />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated text-muted">
              <ImageIcon className="size-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{info.listing_title}</p>
            <p className="text-xs">
              {info.listing_price != null ? (
                <span className="font-semibold tabular-nums text-primary">
                  {formatPrice(info.listing_price)}
                </span>
              ) : null}
              <span className="text-muted">
                {" "}
                · {isSeller ? "Sizin ilanınız" : "Satıcıyla yazışıyorsunuz"}
              </span>
            </p>
          </div>
          {info.listing_slug ? (
            <Link
              to="/ilan/$slug"
              params={{ slug: info.listing_slug }}
              className="hidden shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-elevated sm:inline-flex"
            >
              İlanı gör <ExternalLink className="size-3" />
            </Link>
          ) : null}
        </div>
      ) : null}
      {listingNote ? (
        <p className="border-b border-warn/30 bg-warn/8 px-4 py-1.5 text-center text-xs font-medium text-warn">
          {listingNote}
        </p>
      ) : null}

      {/* Messages */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Mesajlar"
      >
        {!safetyHidden && info ? (
          <div className="mx-auto mb-3 flex max-w-lg items-start gap-2 rounded-xl border border-warn/30 bg-warn/8 px-3 py-2 text-xs text-warn">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">
              Ürünü görmeden kapora göndermeyin, ödemeyi ve yazışmayı GeldeSat dışına taşımayın.
            </span>
            <button
              type="button"
              onClick={() => {
                setSafetyHidden(true);
                try {
                  localStorage.setItem(SAFETY_KEY, "1");
                } catch {
                  /* private mode */
                }
              }}
              className="-m-1 rounded p-1 hover:bg-warn/15"
              aria-label="Uyarıyı kapat"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {hasMore ? (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="rounded-full bg-elevated px-3 py-1 text-xs font-medium text-muted hover:text-fg"
            >
              {loadingOlder ? "Yükleniyor…" : "Önceki mesajları yükle"}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <BrandSpinner size="md" text="Mesajlar yükleniyor…" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Link
              to="/mesajlar"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Mesajlara dön
            </Link>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            Henüz mesaj yok. Aşağıdan yazmaya başlayabilirsiniz.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user.id;
            const day = dayLabel(m.created_at);
            const showDay = day !== lastDay;
            const clustered = !showDay && lastSender === m.sender_id;
            lastDay = day;
            lastSender = m.sender_id;
            return (
              <div key={m.id} id={`msg-${m.id}`} className={clustered ? "mt-1" : "mt-3"}>
                {showDay ? (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-elevated px-3 py-0.5 text-[11px] font-semibold text-muted">
                      {day}
                    </span>
                  </div>
                ) : null}
                {m.id === firstUnreadId && !detached ? (
                  <div className="my-3 flex items-center gap-3 text-[11px] font-semibold text-primary">
                    <span className="h-px flex-1 bg-primary/30" /> Yeni mesajlar{" "}
                    <span className="h-px flex-1 bg-primary/30" />
                  </div>
                ) : null}
                <MessageBubble
                  m={m}
                  mine={mine}
                  pending={m.localState === "pending"}
                  failed={m.localState === "failed"}
                  highlighted={highlightId === m.id}
                  listingImage={info?.listing_image ? photoSrc(info.listing_image, 800) : null}
                  nameOf={nameOf}
                  onReply={() => {
                    setReplyTo(m);
                    box.current?.focus();
                  }}
                  onJumpTo={(target) => void jumpTo(target)}
                  onCounterOffer={() => setDialog({ counterTo: m.id })}
                  onDelete={() => setDialog({ deleteMessage: m.id })}
                  onReport={() => setDialog({ reportMessage: m.id })}
                  onRespondOffer={async (accept) => {
                    try {
                      merge([await respondOffer({ data: { messageId: m.id, accept } })]);
                      toast.success(accept ? "Teklif kabul edildi" : "Teklif reddedildi");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "İşlem başarısız oldu");
                    }
                  }}
                  onRetry={() =>
                    void send(
                      m.content,
                      m.id,
                      m.reply ? (messages.find((x) => x.id === m.reply!.id) ?? null) : null,
                    )
                  }
                  onOpenImage={setLightbox}
                />
              </div>
            );
          })
        )}
        {typing ? (
          <div className="mt-3 flex">
            <span
              className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/80 bg-surface px-3.5 py-3"
              aria-label="yazıyor"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-subtle"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      {detached ? (
        <div className="flex justify-center border-t border-border/50 bg-surface/60 py-2">
          <button
            type="button"
            onClick={backToLatest}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-fg shadow"
          >
            {newWhileDetached ? "Yeni mesajlar var · En yeniye git" : "En yeni mesajlara git"}
          </button>
        </div>
      ) : null}

      {/* Quick replies */}
      {canMessage && messages.length <= 3 && !loading && !detached ? (
        <div className="flex gap-1.5 overflow-x-auto border-t border-border/50 bg-surface/60 px-3 py-2 [scrollbar-width:none]">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void send(q)}
              className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:bg-elevated"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      {/* Composer, or why you can't write */}
      {!info || loading ? null : info.other_closed ? (
        <p className="border-t border-border bg-surface px-4 py-4 text-center text-sm text-muted">
          Bu kullanıcı hesabını kapattı. Yeni mesaj gönderilemez.
        </p>
      ) : blockedByMe ? (
        <div className="flex flex-col items-center gap-2 border-t border-border bg-surface px-4 py-4 text-center">
          <p className="text-sm text-muted">Bu kullanıcıyı engellediniz.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void toggleBlock()}>
            Engeli kaldır
          </Button>
        </div>
      ) : blockedByOther ? (
        <p className="border-t border-border bg-surface px-4 py-4 text-center text-sm text-muted">
          Bu kullanıcı sizinle iletişimi kısıtladı.
        </p>
      ) : (
        <div className="border-t border-border bg-surface">
          {replyTo ? (
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
              <div className="min-w-0 flex-1 border-l-4 border-primary pl-2 text-xs">
                <p className="font-semibold text-primary">
                  {nameOf(replyTo.sender_id)} yanıtlanıyor
                </p>
                <p className="truncate text-muted">
                  {previewText(replyTo.kind, replyTo.content, replyTo.deleted)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Yanıtı iptal et"
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-elevated"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
          <form
            className="chat-composer flex items-end gap-2 p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept={PHOTO_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                void sendPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Ekle"
                disabled={uploading}
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-border text-muted hover:bg-elevated hover:text-fg disabled:opacity-50"
              >
                {uploading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-transparent" />
                ) : (
                  <Paperclip className="size-5" />
                )}
              </DropdownMenuTrigger>
              <MenuContent align="start" side="top">
                <MenuItem onSelect={() => fileRef.current?.click()}>
                  <ImagePlus /> Fotoğraf gönder
                </MenuItem>
                <MenuItem onSelect={() => setDialog("location")}>
                  <MapPin /> Konum paylaş
                </MenuItem>
                <MenuItem onSelect={() => setDialog("templates")}>
                  <MessageSquareText /> Hazır cevaplar
                </MenuItem>
                {!isSeller && info.listing_status === "ACTIVE" ? (
                  <MenuItem onSelect={() => setDialog("offer")}>
                    <HandCoins /> Fiyat teklifi ver
                  </MenuItem>
                ) : null}
              </MenuContent>
            </DropdownMenu>
            <textarea
              ref={box}
              value={text}
              onChange={(e) => {
                onType(e.target.value);
                grow(e.target);
              }}
              onFocus={() =>
                setTimeout(
                  () =>
                    scroller.current?.scrollTo({
                      top: scroller.current.scrollHeight,
                      behavior: "smooth",
                    }),
                  180,
                )
              }
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Mesaj yazın…"
              aria-label="Mesaj"
              maxLength={2000}
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-base leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!text.trim()}
              aria-label="Gönder"
              className="size-11 shrink-0 rounded-xl"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}

      {info ? (
        <OfferDialog
          open={
            dialog === "offer" ||
            (typeof dialog === "object" && dialog !== null && "counterTo" in dialog)
          }
          counter={typeof dialog === "object" && dialog !== null && "counterTo" in dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          listingPrice={info.listing_price}
          onSend={async (amount) => {
            const counterTo =
              typeof dialog === "object" && dialog && "counterTo" in dialog
                ? dialog.counterTo
                : undefined;
            const msg = await sendOffer({ data: { conversationId: id, amount, counterTo } });
            stickRef.current = true;
            merge([msg]);
            pingInbox();
            toast.success("Teklifiniz gönderildi");
          }}
        />
      ) : null}

      <LocationPicker
        open={dialog === "location"}
        onOpenChange={(o) => !o && setDialog(null)}
        onSend={async (place) => {
          const msg = await sendLocation({ data: { conversationId: id, ...place } });
          stickRef.current = true;
          merge([msg]);
          pingInbox();
        }}
      />

      <TemplatesDialog
        open={dialog === "templates"}
        onOpenChange={(o) => !o && setDialog(null)}
        onPick={(t) => {
          setText(t);
          setDialog(null);
          requestAnimationFrame(() => {
            if (box.current) {
              box.current.focus();
              grow(box.current);
            }
          });
        }}
      />

      <ReportDialog
        open={
          dialog === "report" ||
          (typeof dialog === "object" && dialog !== null && "reportMessage" in dialog)
        }
        onOpenChange={(o) => !o && setDialog(null)}
        onSend={async (reason, details) => {
          const messageId =
            typeof dialog === "object" && dialog && "reportMessage" in dialog
              ? dialog.reportMessage
              : undefined;
          await reportConversation({ data: { conversationId: id, messageId, reason, details } });
          toast.success("Şikayetiniz incelemeye alındı");
        }}
      />

      <ConfirmDialog
        open={dialog === "delete-chat"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Sohbet silinsin mi?"
        body="Sohbet sadece sizin mesaj kutunuzdan kalkar; karşı taraf görmeye devam eder."
        confirmLabel="Sohbeti sil"
        danger
        onConfirm={async () => {
          try {
            await deleteConversation({ data: { conversationId: id } });
            pingInbox();
            toast.success("Sohbet silindi");
            void navigate({ to: "/mesajlar" });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Sohbet silinemedi");
          }
        }}
      />

      <ConfirmDialog
        open={dialog === "block"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${info?.other_name ?? "Kullanıcı"} engellensin mi?`}
        body="Birbirinize mesaj gönderemezsiniz. Engeli istediğiniz zaman Ayarlar › Engellenenler'den kaldırabilirsiniz."
        confirmLabel="Engelle"
        danger
        onConfirm={toggleBlock}
      />

      <ConfirmDialog
        open={typeof dialog === "object" && dialog !== null && "deleteMessage" in dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mesaj herkesten silinsin mi?"
        body="Mesaj iki taraf için de “Bu mesaj silindi” olarak görünür."
        confirmLabel="Herkesten sil"
        danger
        onConfirm={async () => {
          if (typeof dialog !== "object" || !dialog || !("deleteMessage" in dialog)) return;
          try {
            merge([await deleteMessage({ data: { messageId: dialog.deleteMessage } })]);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Mesaj silinemedi");
          }
        }}
      />

      <Dialog open={Boolean(lightbox)} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-[calc(100%-1rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">Fotoğraf</DialogTitle>
          {lightbox ? (
            <img src={lightbox} alt="" className="max-h-[85dvh] w-full rounded-xl object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferDialog({
  open,
  counter,
  onOpenChange,
  listingPrice,
  onSend,
}: {
  open: boolean;
  counter?: boolean;
  onOpenChange: (o: boolean) => void;
  listingPrice: number | null;
  onSend: (amount: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = Number(value) || 0;
  useEffect(() => {
    if (open) setValue("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (amount < 1) return;
            setBusy(true);
            try {
              await onSend(amount);
              onOpenChange(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Teklif gönderilemedi");
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{counter ? "Karşı teklif ver" : "Fiyat teklifi ver"}</DialogTitle>
            <DialogDescription>
              {listingPrice ? <>İlan fiyatı {formatPrice(listingPrice)}. </> : null}
              {counter
                ? "Gelen teklif yerine kendi fiyatınızı önerin; karşı taraf kabul edebilir, reddedebilir veya yeniden teklif verebilir."
                : "Karşı taraf teklifinizi kabul edebilir, reddedebilir veya karşı teklif verebilir; yeni teklif öncekinin yerine geçer."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="offer-amount">Teklifiniz</Label>
            <div className="relative">
              <Input
                id="offer-amount"
                inputMode="numeric"
                autoFocus
                value={value ? formatNumber(value) : ""}
                onChange={(e) =>
                  setValue(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10))
                }
                placeholder="0"
                className="pr-12 text-lg font-semibold tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm font-semibold text-muted">
                TL
              </span>
            </div>
            {listingPrice ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[5, 10, 15].map((p) => {
                  const suggested = Math.round((listingPrice * (100 - p)) / 100 / 100) * 100;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValue(String(suggested))}
                      className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-elevated"
                    >
                      %{p} indirim · {formatPrice(suggested)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={busy || amount < 1}>
              {busy ? "Gönderiliyor…" : counter ? "Karşı teklifi gönder" : "Teklifi gönder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSend: (reason: string, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSend(reason, details.trim());
              setDetails("");
              onOpenChange(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Şikayet gönderilemedi");
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Şikayet et</DialogTitle>
            <DialogDescription>
              Yöneticilerimiz bu sohbetteki ilgili mesajları inceleyecek.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="rep-reason">Sebep</Label>
            <Select id="rep-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rep-details">Ayrıntı (isteğe bağlı)</Label>
            <Textarea
              id="rep-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? "Gönderiliyor…" : "Şikayeti gönder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/** Saved replies: pick one into the composer, add or remove them. */
function TemplatesDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (text: string) => void;
}) {
  const [items, setItems] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setDraft("");
    getChatTemplates()
      .then(setItems)
      .catch(() => setItems([]));
  }, [open]);

  async function save(next: string[]) {
    setBusy(true);
    try {
      setItems(await saveChatTemplates({ data: { templates: next } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hazır cevaplar</DialogTitle>
          <DialogDescription>
            Sık yazdığınız cevapları kaydedin, tek dokunuşla mesaja ekleyin.
          </DialogDescription>
        </DialogHeader>
        {items === null ? (
          <p className="text-sm text-muted">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl bg-elevated/60 p-3 text-sm text-muted">
            Henüz hazır cevabınız yok. Aşağıdan ekleyebilirsiniz.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-auto">
            {items.map((t, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl border border-border p-2">
                <button
                  type="button"
                  onClick={() => onPick(t)}
                  className="min-w-0 flex-1 text-left text-sm hover:text-primary"
                >
                  {t}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(items.filter((_, j) => j !== i))}
                  aria-label="Hazır cevabı sil"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {items && items.length < MAX_TEMPLATES ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              setDraft("");
              void save([...items, t]);
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_TEMPLATE_LENGTH))}
              placeholder="Yeni hazır cevap"
            />
            <Button type="submit" disabled={busy || !draft.trim()}>
              Ekle
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
