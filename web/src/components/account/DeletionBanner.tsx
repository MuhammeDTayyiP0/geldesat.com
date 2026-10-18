import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDeletionStatus, restoreMyAccount } from "@/lib/server/settings";
import { Button } from "@/components/ui/button";

/** Shown to a signed-in user whose account is in the 30-day deletion grace period. */
export function DeletionBanner() {
  const { user } = useCurrentUserState();
  const router = useRouter();
  const [purgeAt, setPurgeAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return setPurgeAt(null);
    let alive = true;
    getDeletionStatus()
      .then((s) => alive && setPurgeAt(s.purgeAt))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);

  if (!purgeAt) return null;
  const date = new Date(purgeAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  async function restore() {
    setBusy(true);
    try {
      await restoreMyAccount();
      setPurgeAt(null);
      toast.success("Hesabınız geri alındı. İlanlarınız eski durumuna döndü.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hesap geri alınamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alert" className="border-b border-danger/30 bg-danger/8 px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-danger">
          Hesabınız silinme sürecinde. <span className="font-semibold">{date}</span> tarihinde kalıcı olarak silinecek; ilanlarınız şu an
          gizli.
        </p>
        <Button size="sm" disabled={busy} onClick={() => void restore()}>
          {busy ? "Geri alınıyor…" : "Hesabımı geri al"}
        </Button>
      </div>
    </div>
  );
}
