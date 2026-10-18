import { useState } from "react";
import { AlertTriangle, Check, CheckCheck, Clock3, Copy, Flag, HandCoins, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MenuContent, MenuItem } from "@/components/chat/ChatUi";
import { chatImageUrl, DELETE_WINDOW_MS, linkify, messageRisk, type ChatMessage } from "@/lib/chat-shared";
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
};

/**
 * One chat message: text (links clickable, scam patterns flagged), photo,
 * offer card or deleted placeholder, with time, delivery state and actions.
 */
export function MessageBubble({
  m,
  mine,
  pending,
  failed,
  listingImage,
  isSeller,
  onDelete,
  onReport,
  onRespondOffer,
  onRetry,
  onOpenImage,
}: {
  m: ChatMessage;
  mine: boolean;
  pending?: boolean;
  failed?: boolean;
  listingImage: string | null;
  isSeller: boolean;
  onDelete: () => void;
  onReport: () => void;
  onRespondOffer: (accept: boolean) => Promise<void>;
  onRetry?: () => void;
  onOpenImage: (src: string) => void;
}) {
  const [offerBusy, setOfferBusy] = useState(false);
  const risk = !m.deleted && m.kind === "text" ? messageRisk(m.content) : null;
  const canDelete = mine && !m.deleted && !pending && Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS;
  const offer = m.kind === "offer" && m.meta ? m.meta : null;

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
  ) : offer ? (
    <div className="min-w-52">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
        <HandCoins className="size-4" /> Fiyat teklifi
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatPrice(offer.amount ?? 0)}</p>
      <p className={cn("mt-1 text-xs font-semibold", mine ? "text-primary-fg/90" : OFFER_STATE[offer.status ?? "pending"]?.tone)}>
        {OFFER_STATE[offer.status ?? "pending"]?.label}
      </p>
      {isSeller && !mine && offer.status === "pending" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={offerBusy}
            onClick={async () => {
              setOfferBusy(true);
              await onRespondOffer(false).finally(() => setOfferBusy(false));
            }}
            className="h-9 rounded-lg border border-border bg-surface text-sm font-semibold text-fg hover:bg-elevated disabled:opacity-50"
          >
            Reddet
          </button>
          <button
            type="button"
            disabled={offerBusy}
            onClick={async () => {
              setOfferBusy(true);
              await onRespondOffer(true).finally(() => setOfferBusy(false));
            }}
            className="h-9 rounded-lg bg-ok text-sm font-semibold text-white hover:bg-ok/90 disabled:opacity-50"
          >
            Kabul et
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
            "rounded-2xl px-3.5 py-2 text-[15px] shadow-2xs md:text-sm",
            mine ? "rounded-br-md bg-primary text-primary-fg" : "rounded-bl-md border border-border/80 bg-surface text-fg",
            offer && !mine && "border-warn/40 bg-warn/5",
            pending && "opacity-70",
            failed && "ring-2 ring-danger/60",
          )}
        >
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
