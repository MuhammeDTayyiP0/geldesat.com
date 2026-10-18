import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { getAccountSettings, updateNotifyPrefs } from "@/lib/server/settings";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { NOTIFY_TYPES, type NotifyPrefs } from "@/lib/notification-prefs";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/bildirimler")({
  head: () => ({ meta: [{ title: "Bildirim tercihleri | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: NotificationSettings,
});

function NotificationSettings() {
  const { user, isPending } = useCurrentUserState();
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [pushDevices, setPushDevices] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAccountSettings()
      .then((s) => {
        setPrefs(s.notify_prefs);
        setPushDevices(s.push_devices);
      })
      .catch(() => toast.error("Tercihler yüklenemedi"));
  }, [user]);

  if (isPending || (user && !prefs)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !prefs) return <RedirectToSignIn />;

  async function setChannel(type: keyof NotifyPrefs, channel: "inapp" | "push", value: boolean) {
    if (!prefs) return;
    const prev = prefs;
    const next = { ...prefs, [type]: { ...prefs[type], [channel]: value } };
    setPrefs(next);
    setBusy(true);
    try {
      const res = await updateNotifyPrefs({ data: next });
      setPrefs(res.prefs);
    } catch (err) {
      setPrefs(prev);
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Bildirim tercihleri" description="Hangi durumlarda haber almak istediğinizi seçin.">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="hidden grid-cols-[1fr_88px_88px] items-end gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold text-muted sm:grid sm:px-6">
            <span>Bildirim</span>
            <span className="text-center">Site içi</span>
            <span className="text-center">Mobil uygulama</span>
          </div>
          <ul className="divide-y divide-border">
            {NOTIFY_TYPES.map((t) => {
              const p = prefs[t.type];
              const locked = "inappLocked" in t;
              return (
                <li key={t.type} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_88px_88px] sm:items-center sm:gap-2 sm:px-6">
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="mt-0.5 text-xs text-muted">{t.hint}</p>
                  </div>
                  <label className="flex items-center justify-between gap-3 text-sm sm:justify-center">
                    <span className="text-muted sm:hidden">Site içi</span>
                    <ToggleSwitch
                      label={`${t.label}: site içi bildirim`}
                      checked={p.inapp}
                      disabled={busy || locked}
                      onChange={(v) => void setChannel(t.type, "inapp", v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm sm:justify-center">
                    <span className="text-muted sm:hidden">Mobil uygulama</span>
                    <ToggleSwitch
                      label={`${t.label}: mobil uygulama bildirimi`}
                      checked={p.push}
                      disabled={busy}
                      onChange={(v) => void setChannel(t.type, "push", v)}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex gap-3 rounded-2xl bg-elevated/60 p-4 text-xs leading-relaxed text-muted">
          <Info className="size-4 shrink-0" />
          <p>
            İlan onay ve ret bildirimleri hesabınızın güvenliği için site içinde her zaman gösterilir.
            {pushDevices === 0
              ? " Mobil uygulama bildirimleri, GeldeSat uygulamasına giriş yapıp bildirimlere izin verdiğinizde gelir; şu an kayıtlı cihazınız yok."
              : ` Mobil bildirimler ${pushDevices} cihazınıza gönderilir.`}
          </p>
        </div>
      </div>
    </AccountShell>
  );
}
