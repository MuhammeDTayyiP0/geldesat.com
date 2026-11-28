import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { AccountShell } from "@/components/account/AccountShell";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errorText } from "@/lib/error-text";
import { submitFeedback } from "@/lib/server/settings";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/user-prefs";

export const Route = createFileRoute("/ayarlar/geri-bildirim")({
  head: () => ({ meta: [{ title: "Geri bildirim | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { user, isPending } = useCurrentUserState();
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (isPending) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      toast.error("Lütfen en az 10 karakter yazın.");
      return;
    }
    setBusy(true);
    try {
      await submitFeedback({
        data: {
          category,
          message: message.trim(),
          page_url: typeof window !== "undefined" ? window.location.href.slice(0, 300) : undefined,
          platform: "web",
        },
      });
      setSent(true);
      setMessage("");
      toast.success("Geri bildiriminiz için teşekkürler!");
    } catch (err) {
      toast.error(errorText(err, "Gönderilemedi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Geri bildirim / Sorun bildir" description="GeldeSat’ı geliştirmemize yardımcı olun; tüm mesajlar ekibimize ulaşır.">
      {sent ? (
        <div className="rounded-2xl border border-ok/30 bg-ok/10 p-6 text-center shadow-card">
          <CheckCircle2 className="mx-auto size-10 text-ok" />
          <h2 className="mt-3 text-base font-semibold">Mesajınız alındı</h2>
          <p className="mt-1 text-sm text-muted">Değerli geri bildiriminiz için teşekkür ederiz.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => setSent(false)}>
            Yeni mesaj gönder
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessageSquarePlus className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Konu seçin ve yazın</h2>
              <p className="mt-0.5 text-xs text-muted">Karşılaştığınız bir hatayı veya görmek istediğiniz bir özelliği paylaşın.</p>
            </div>
          </div>

          <div>
            <Label>Konu</Label>
            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border bg-bg text-muted hover:bg-elevated"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <Label htmlFor="fb-msg" className="mb-0">
                Mesajınız
              </Label>
              <span className="text-xs tabular-nums text-subtle">{message.length}/1500</span>
            </div>
            <Textarea
              id="fb-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1500))}
              placeholder="Detayları buraya yazabilirsiniz…"
              minLength={10}
              rows={5}
              required
            />
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit" disabled={busy || message.trim().length < 10}>
              {busy ? "Gönderiliyor…" : "Gönder"}
            </Button>
          </div>
        </form>
      )}
    </AccountShell>
  );
}
