import { ErrorState } from "@/components/common/ErrorState";
import { createFileRoute } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useState, type FormEvent } from "react";
import { MessageSquareText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MAX_TEMPLATE_LENGTH, MAX_TEMPLATES } from "@/lib/chat-shared";
import { getChatTemplates, saveChatTemplates } from "@/lib/server/chat";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/sablonlar")({
  head: () => ({ meta: [{ title: "Hazır mesajlarım | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ChatTemplatesSettings,
});

function ChatTemplatesSettings() {
  const { user, isPending } = useCurrentUserState();
  const [items, setItems] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getChatTemplates()
      .then((list) => {
        if (!alive) return;
        setFailed(false);
        setItems(list);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [user, attempt]);

  if (failed && !items) {
    return (
      <AccountShell title="Hazır mesajlarım">
        <ErrorState
          message="Hazır mesajlarınız yüklenemedi."
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </AccountShell>
    );
  }
  if (isPending || (user && !items)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !items) return <RedirectToSignIn />;

  async function persist(next: string[]): Promise<boolean> {
    if (saving || !items) return false;
    setSaving(true);
    try {
      const saved = await saveChatTemplates({ data: { templates: next } });
      setItems(saved);
      return true;
    } catch (e) {
      toast.error(errorText(e, "Hazır mesajlar kaydedilemedi"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !items || items.length >= MAX_TEMPLATES) return;
    const ok = await persist([...items, trimmed]);
    if (ok) {
      setDraft("");
      toast.success("Hazır mesaj eklendi");
    }
  }

  async function handleRemove(index: number) {
    if (!items) return;
    const ok = await persist(items.filter((_, i) => i !== index));
    if (ok) toast.success("Hazır mesaj silindi");
  }

  return (
    <AccountShell
      title="Hazır mesajlarım"
      description="Sık yazdığınız mesajları kaydedin; sohbette tek tıkla gönderin."
    >
      <div className="space-y-5">
        <form onSubmit={(e) => void handleAdd(e)} className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="template-draft" className="mb-0">
              Yeni hazır mesaj
            </Label>
            <span className="text-xs tabular-nums text-subtle">
              {draft.length}/{MAX_TEMPLATE_LENGTH}
            </span>
          </div>
          <Textarea
            id="template-draft"
            rows={3}
            maxLength={MAX_TEMPLATE_LENGTH}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_TEMPLATE_LENGTH))}
            placeholder="Örn. Merhaba, ürün hâlâ satılık. Akşam 18:00’den sonra görüşebiliriz."
          />
          {items.length >= MAX_TEMPLATES ? (
            <p className="text-xs text-warn">En fazla {MAX_TEMPLATES} hazır mesaj kaydedebilirsiniz.</p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {items.length}/{MAX_TEMPLATES} mesaj kullanılıyor
            </span>
            <Button type="submit" disabled={!draft.trim() || items.length >= MAX_TEMPLATES || saving}>
              <Plus className="size-4" />
              {saving ? "Kaydediliyor…" : "Ekle"}
            </Button>
          </div>
        </form>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
            <MessageSquareText className="mx-auto size-8 text-subtle" />
            <p className="mt-3 text-sm text-muted">Henüz hazır mesajınız yok.</p>
            <p className="mt-1 text-xs text-subtle">Yukarıdaki alandan sık kullandığınız yanıtları ekleyebilirsiniz.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {items.map((text, index) => (
              <li key={`${index}-${text}`} className="flex items-start gap-3 px-4 py-3.5">
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{text}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void handleRemove(index)}
                  aria-label={`"${text.slice(0, 30)}" mesajını sil`}
                  className="shrink-0 text-muted hover:bg-danger-solid/10 hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccountShell>
  );
}
