import { useState } from "react";
import { AlertTriangle, Check, CheckCheck, Clock3, Copy, Flag, HandCoins, MapPin, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MenuContent, MenuItem } from "@/components/chat/ChatUi";
import { chatImageUrl, DELETE_WINDOW_MS, linkify, mapsUrl, messageRisk, previewText, type ChatMessage } from "@/lib/chat-shared";
import { cn, formatPrice, LISTING_PHOTO_MSG } from "@/lib/utils";

function clock(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

const OFFER_STATE: Record<string, { label: string; tone: string }> = {
  pending: { label: "Yanıt bekliyor", tone: "text-warn" },
  accepted: { label: "Kabul edildi", tone: "text-ok" },
  rejected: { label: "Reddedildi", tone: "text-danger" },
  withdrawn: { label: "Geri çekildi", tone: "text-muted" },
  countered: { label: "Karşı teklif verildi", tone: "text-muted" },
};

/**
 * One chat message: text (links clickable, scam patterns flagged), photo,
 * offer card, location card or deleted placeholder, with an optional quoted
 * reply, time, delivery state and actions.
 */
export function MessageBubble({
  m,
  mine,
  pending,
  failed,
  highlighted,
  listingImage,
  nameOf,
  onReply,
  onJumpTo,
  onDelete,
  onReport,
  onRespondOffer,
  onCounterOffer,
  onRetry,
  onOpenImage,
}: {
  m: ChatMessage;
  mine: boolean;
  pending?: boolean;
  failed?: boolean;
  highlighted?: boolean;
  listingImage: string | null;
  nameOf: (senderId: string) => string;
  onReply: () => void;
  onJumpTo: (messageId: string) => void;
  onDelete: () => void;
  onReport: () => void;
  onRespondOffer: (accept: boolean) => Promise<void>;
  onCounterOffer: () => void;
  onRetry?: () => void;
  onOpenImage: (src: string) => void;
}) {
  const [offerBusy, setOfferBusy] = useState(false);
  const risk = !m.deleted && m.kind === "text" ? messageRisk(m.content) : null;
  const canDelete = mine && !m.deleted && !pending && Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS;
  const offer = m.kind === "offer" && m.meta ? m.meta : null;
  const location = m.kind === "location" && m.meta ? m.meta : null;

  async function respond(accept: boolean) {
    setOfferBusy(true);
    await onRespondOffer(accept).finally(() => setOfferBusy(false));
  }

  const body = m.deleted ? (
    <p className="italic opacity-75">{m.content}</p>
  ) : m.kind === "image" && m.meta?.image_id ? (
    <button type="button" onClick={() => onOpenImage(chatImageUrl(m.meta!.image_id!))} className="-mx-1.5 -mt-1 block overflow-hidden rounded-xl">
      <img src={chatImageUrl(m.meta.image_id)} alt="Gönderilen fotoğraf" loading="lazy" className="max-h-72 w-full max-w-64 object-cover" />
    </button>
  ) : m.content === LISTING_PHOTO_MSG ? (
    listingImage ? (
      <button type="button" onClick={() => onOpenImage(listingImage)} className="-mx-1.5 -mt-1 block overflow-hidden rounded-xl">
        <img src={listingImage} alt="İlan görseli" className="max-h-56 w-full max-w-64 object-cover" />
      </button>
    ) : (
      <p className="italic opacity-80">İlan görseli</p>
    )
  ) : location ? (
    <a href={mapsUrl(location)} target="_blank" rel="noopener noreferrer" className="flex min-w-52 items-center gap-3">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", mine ? "bg-white/20" : "bg-primary/10 text-primary")}>
        <MapPin className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide opacity-80">Buluşma noktası</span>
        <span className="block break-words font-semibold">{location.label}</span>
        <span className="block text-xs underline underline-offset-2 opacity-80">Haritada aç</span>
      </span>
    </a>
  ) : offer ? (
    <div className="min-w-52">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
        <HandCoins className="size-4" /> {offer.counter ? "Karşı teklif" : "Fiyat teklifi"}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatPrice(offer.amount ?? 0)}</p>
      <p className={cn("mt-1 text-xs font-semibold", mine ? "text-primary-fg/90" : OFFER_STATE[offer.status ?? "pending"]?.tone)}>
        {OFFER_STATE[offer.status ?? "pending"]?.label}
      </p>
      {!mine && offer.status === "pending" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={offerBusy}
            onClick={() => void respond(false)}
            className="h-9 rounded-lg border border-border bg-surface text-sm font-semibold text-fg hover:bg-elevated disabled:opacity-50"
          >
            Reddet
          </button>
          <button
            type="button"
            disabled={offerBusy}
            onClick={() => void respond(true)}
            className="h-9 rounded-lg bg-ok text-sm font-semibold text-white hover:bg-ok/90 disabled:opacity-50"
          >
            Kabul et
          </button>
          <button
            type="button"
            disabled={offerBusy}
            onClick={onCounterOffer}
            className="col-span-2 h-9 rounded-lg border border-primary/30 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            Karşı teklif ver
          </button>
        </div>
      ) : null}
    </div>
  ) : (
    <p className="whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]">
      {linkify(m.content).map((part, i) =>
        part.href ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="underline underline-offset-2">
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );

  return (
    <div className={cn("group/msg flex items-center gap-1", mine ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("flex max-w-[min(82%,28rem)] flex-col", mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-[15px] shadow-2xs transition-shadow md:text-sm",
            mine ? "rounded-br-md bg-primary text-primary-fg" : "rounded-bl-md border border-border/80 bg-surface text-fg",
            offer && !mine && "border-warn/40 bg-warn/5",
            pending && "opacity-70",
            failed && "ring-2 ring-danger/60",
            highlighted && "ring-4 ring-warn/50",
          )}
        >
          {m.reply && !m.deleted ? (
            <button
              type="button"
              onClick={() => onJumpTo(m.reply!.id)}
              className={cn(
                "-mx-1 mb-1.5 block w-[calc(100%+0.5rem)] rounded-lg border-l-4 px-2 py-1 text-left text-xs",
                mine ? "border-white/70 bg-white/15" : "border-primary bg-elevated",
              )}
            >
              <span className="block font-semibold">{nameOf(m.reply.sender_id)}</span>
              <span className="line-clamp-2 opacity-90">{previewText(m.reply.kind, m.reply.content, false)}</span>
            </button>
          ) : null}
          {body}
          <div className={cn("mt-0.5 flex select-none items-center justify-end gap-1 text-[11px]", mine ? "text-primary-fg/75" : "text-subtle")}>
            <span>{clock(m.created_at)}</span>
            {mine && !m.deleted ? (
              failed ? (
                <span className="text-white">Gönderilemedi</span>
              ) : pending ? (
                <Clock3 className="size-3" aria-label="Gönderiliyor" />
              ) : m.read_at ? (
                <CheckCheck className="size-4 text-white" aria-label="Görüldü" />
              ) : (
                <Check className="size-3.5 opacity-80" aria-label="İletildi" />
              )
            ) : null}
          </div>
        </div>
        {risk ? (
          <p className="mt-1 flex max-w-xs items-start gap-1 text-[11px] font-medium text-warn">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> {risk}
          </p>
        ) : null}
        {failed && onRetry ? (
          <button type="button" onClick={onRetry} className="mt-1 text-[11px] font-semibold text-danger hover:underline">
            Tekrar dene
          </button>
        ) : null}
      </div>
      {!pending && !failed && !m.deleted ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Mesaj seçenekleri"
            className="grid size-7 shrink-0 place-items-center rounded-full text-subtle opacity-0 transition-opacity hover:bg-elevated hover:text-fg focus-visible:opacity-100 group-hover/msg:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-60"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <MenuContent align={mine ? "end" : "start"}>
            <MenuItem onSelect={onReply}>
              <Reply /> Yanıtla
            </MenuItem>
            {m.kind === "text" && m.content !== LISTING_PHOTO_MSG ? (
              <MenuItem onSelect={() => void navigator.clipboard?.writeText(m.content).catch(() => undefined)}>
                <Copy /> Kopyala
              </MenuItem>
            ) : null}
            {canDelete ? (
              <MenuItem danger onSelect={onDelete}>
                <Trash2 /> Herkesten sil
              </MenuItem>
            ) : null}
            {!mine ? (
              <MenuItem danger onSelect={onReport}>
                <Flag /> Bu mesajı şikayet et
              </MenuItem>
            ) : null}
          </MenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
