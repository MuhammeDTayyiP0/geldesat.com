import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { requestMyAccountDeletion } from "@/lib/server/settings";
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
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold">1</span>
              <span>
                <span className="font-medium">Hemen:</span> <span className="text-muted">oturumunuz kapanır, profiliniz, ilanlarınız ve mağazanız gizlenir.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold">2</span>
              <span>
                <span className="font-medium">30 gün içinde:</span>{" "}
                <span className="text-muted">tekrar giriş yapıp “Hesabımı geri al” derseniz her şey eski haline döner.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold">3</span>
              <span>
                <span className="font-medium">30 gün sonra:</span>{" "}
                <span className="text-muted">
                  hesabınız, ilanlarınız, fotoğraflarınız, favorileriniz, bildirimleriniz ve mağazanız kalıcı olarak silinir.
                </span>
              </span>
            </li>
          </ol>
          <p className="mt-4 rounded-xl bg-elevated/70 p-3 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-fg">Mesajlar:</span> yazıştığınız kişiler kendi sohbet geçmişlerini görmeye devam eder; siz
            “Silinmiş kullanıcı” olarak görünürsünüz. Bir sohbet iki taraftan da kalktığında (silindiğinde veya hesaplar kapandığında) 60 gün daha
            kimseye gösterilmeden saklanır, ardından tamamen silinir. Yazdığınız satıcı değerlendirmeleri de “Silinmiş kullanıcı” adıyla kalır.
          </p>
          <p className="mt-3 text-sm text-muted">Silmeden önce verilerinizi indirmenizi öneririz.</p>
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
      await requestMyAccountDeletion({ data: needsPassword ? { password } : {} });
      // The server already ended every session; clear this browser's cookies too.
      await authClient.signOut().catch(() => undefined);
      toast.success("Hesabınız 30 gün içinde silinecek. Bu sürede giriş yaparak geri alabilirsiniz.");
      setTimeout(() => (window.location.href = "/"), 1200);
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
            <DialogTitle>Hesabınız silinsin mi?</DialogTitle>
            <DialogDescription>Hesabınız hemen gizlenir ve 30 gün sonra kalıcı olarak silinir. Bu süre içinde giriş yaparak geri alabilirsiniz.</DialogDescription>
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
              {busy ? "İşleniyor…" : "Hesabımı sil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
