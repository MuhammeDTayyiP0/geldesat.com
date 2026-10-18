import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/hesap")({
  head: () => ({ meta: [{ title: "Verilerim ve hesabım | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AccountData,
});

const CONFIRM_WORD = "SİL";

function AccountData() {
  const { user, isPending } = useCurrentUserState();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    authClient
      .listAccounts()
      .then(({ data }) => setHasPassword(Boolean(data?.some((a) => a.providerId === "credential"))))
      .catch(() => setHasPassword(true));
  }, [user]);

  if (isPending) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  return (
    <AccountShell title="Verilerim ve hesabım" description="Kişisel verilerinizi indirin veya hesabınızı kapatın.">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">Verilerimi indir</h2>
          <p className="mt-1 text-sm text-muted">
            Profiliniz, ilanlarınız, mesajlarınız, favorileriniz, değerlendirmeleriniz ve bildirimleriniz tek bir dosya (JSON) olarak
            indirilir. KVKK kapsamındaki bilgi edinme hakkınızdır.
          </p>
          <a href="/api/hesap/verilerim" download className="mt-4 inline-block">
            <Button type="button" variant="outline">
              <Download className="size-4" /> Verilerimi indir
            </Button>
          </a>
        </section>

        <section className="rounded-2xl border border-danger/30 bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold text-danger">Hesabı sil</h2>
          <p className="mt-1 text-sm text-muted">Hesabınız ve ona bağlı her şey kalıcı olarak silinir:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Tüm ilanlarınız ve fotoğrafları</li>
            <li>Mesajlaşmalarınız (karşı taraftaki kopyalar dahil)</li>
            <li>Favorileriniz, değerlendirmeleriniz, bildirimleriniz ve mağazanız</li>
          </ul>
          <p className="mt-3 text-sm text-muted">Bu işlem geri alınamaz. Silmeden önce verilerinizi indirmenizi öneririz.</p>
          <Button type="button" variant="danger" className="mt-4" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" /> Hesabımı sil
          </Button>
        </section>
      </div>

      <DeleteDialog open={open} onOpenChange={setOpen} needsPassword={hasPassword !== false} />
    </AccountShell>
  );
}

function DeleteDialog({ open, onOpenChange, needsPassword }: { open: boolean; onOpenChange: (o: boolean) => void; needsPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = word.trim().toLocaleUpperCase("tr") === CONFIRM_WORD && (!needsPassword || password.length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      const { error } = await authClient.deleteUser(needsPassword ? { password } : {});
      if (error) {
        const msg =
          error.code === "INVALID_PASSWORD"
            ? "Şifre hatalı."
            : error.code === "SESSION_EXPIRED"
              ? "Güvenliğiniz için tekrar giriş yapıp yeniden deneyin."
              : error.message || "Hesap silinemedi.";
        throw new Error(msg);
      }
      toast.success("Hesabınız silindi. Görüşmek üzere.");
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hesap silinemedi");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="border-border bg-surface">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Hesabınız kalıcı olarak silinsin mi?</DialogTitle>
            <DialogDescription>Tüm ilanlarınız, mesajlarınız ve verileriniz silinir. Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          {needsPassword ? (
            <div>
              <Label htmlFor="del-password">Şifreniz</Label>
              <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          ) : null}
          <div>
            <Label htmlFor="del-word">
              Onaylamak için <span className="font-bold">{CONFIRM_WORD}</span> yazın
            </Label>
            <Input id="del-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" variant="danger" disabled={!ready || busy}>
              {busy ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
