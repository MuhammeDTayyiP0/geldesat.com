import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { MAX_TEMPLATE_LENGTH, MAX_TEMPLATES } from "@/lib/chat-shared";
import { errorText } from "@/lib/error-text";
import { getChatTemplates, saveChatTemplates } from "@/lib/server/chat";
import { formatNumber, formatPrice } from "@/lib/utils";

const REPORT_REASONS = [
  "Dolandırıcılık şüphesi",
  "Hakaret veya taciz",
  "Spam / reklam",
  "Uygunsuz içerik",
  "Diğer",
];

function roundOfferAmount(raw: number): number {
  if (raw >= 1000) return Math.round(raw / 100) * 100;
  if (raw >= 100) return Math.round(raw / 10) * 10;
  return Math.round(raw);
}

function suggestedOfferChips(listingPrice: number | null): Array<{ percent: number; amount: number }> {
  if (!listingPrice) return [];
  const seen = new Set<number>();
  const chips: Array<{ percent: number; amount: number }> = [];
  for (const percent of [5, 10, 15]) {
    const amount = roundOfferAmount((listingPrice * (100 - percent)) / 100);
    if (amount > 0 && amount < listingPrice && !seen.has(amount)) {
      seen.add(amount);
      chips.push({ percent, amount });
    }
  }
  return chips;
}

export function OfferDialog({
  open,
  counter,
  onOpenChange,
  listingPrice,
  listingCurrency,
  onSend,
}: {
  open: boolean;
  counter?: boolean;
  onOpenChange: (o: boolean) => void;
  listingPrice: number | null;
  listingCurrency?: string;
  onSend: (amount: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = Number(value) || 0;
  const currencyLabel = listingCurrency === "USD" ? "$" : listingCurrency === "EUR" ? "€" : "TL";
  const offerChips = suggestedOfferChips(listingPrice);
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
              toast.error(errorText(err, "Teklif gönderilemedi"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{counter ? "Karşı teklif ver" : "Fiyat teklifi ver"}</DialogTitle>
            <DialogDescription>
              {listingPrice ? <>İlan fiyatı {formatPrice(listingPrice, listingCurrency)}. </> : null}
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
                {currencyLabel}
              </span>
            </div>
            {offerChips.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {offerChips.map(({ percent, amount: suggested }) => (
                  <button
                    key={suggested}
                    type="button"
                    onClick={() => setValue(String(suggested))}
                    className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-elevated"
                  >
                    %{percent} indirim · {formatPrice(suggested, listingCurrency)}
                  </button>
                ))}
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

export function ReportDialog({
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
              toast.error(errorText(err, "Şikayet gönderilemedi"));
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
export function TemplatesDialog({
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
      toast.error(errorText(err, "Kaydedilemedi"));
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
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-solid/10 hover:text-danger"
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
