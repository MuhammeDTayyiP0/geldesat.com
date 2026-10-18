import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EyeOff, Globe, Users } from "lucide-react";
import { toast } from "sonner";
import { getAccountSettings, updatePrivacySettings } from "@/lib/server/settings";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { PhoneVisibility } from "@/lib/notification-prefs";
import { cn } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/gizlilik")({
  head: () => ({ meta: [{ title: "Gizlilik | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PrivacySettings,
});

const PHONE_OPTIONS: Array<{ value: PhoneVisibility; title: string; body: string; icon: typeof Globe }> = [
  { value: "everyone", title: "Herkes", body: "Giriş yapmayan ziyaretçiler de “Telefonu göster” ile numaranızı görebilir.", icon: Globe },
  { value: "members", title: "Sadece üyeler", body: "Numaranızı yalnızca giriş yapmış kullanıcılar görebilir. (Önerilen)", icon: Users },
  { value: "hidden", title: "Kimse", body: "Numaranız gösterilmez; alıcılar size yalnızca mesajla ulaşır.", icon: EyeOff },
];

function PrivacySettings() {
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<{ phone_visibility: PhoneVisibility; show_whatsapp: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAccountSettings()
      .then((s) => setState({ phone_visibility: s.phone_visibility, show_whatsapp: s.show_whatsapp }))
      .catch(() => toast.error("Ayarlar yüklenemedi"));
  }, [user]);

  if (isPending || (user && !state)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !state) return <RedirectToSignIn />;

  // Each change saves at once, like a phone's settings app; failures roll back.
  async function save(next: typeof state & object) {
    const prev = state;
    setState(next);
    setBusy(true);
    try {
      await updatePrivacySettings({ data: next });
      toast.success("Kaydedildi");
    } catch (err) {
      setState(prev);
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Gizlilik" description="İletişim bilgilerinizin kimlere görüneceğini seçin.">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">Telefon numaramı kimler görebilir?</h2>
          <p className="mt-1 text-sm text-muted">Tüm ilanlarınız için geçerlidir. İlana özel girdiğiniz numara da bu ayara uyar.</p>
          <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Telefon görünürlüğü">
            {PHONE_OPTIONS.map(({ value, title, body, icon: Icon }) => {
              const on = state.phone_visibility === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => !on && void save({ ...state, phone_visibility: value })}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                    on ? "border-primary bg-primary/5" : "border-border hover:bg-elevated/60",
                  )}
                >
                  <Icon className={cn("mt-0.5 size-5 shrink-0", on ? "text-primary" : "text-muted")} />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{body}</span>
                  </span>
                  <span className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2", on ? "border-primary" : "border-border")}>
                    {on ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div>
            <h2 className="text-base font-semibold">WhatsApp ile iletişim</h2>
            <p className="mt-1 text-sm text-muted">Numaranız gösterildiğinde ilanlarda “WhatsApp ile yaz” butonu da çıksın.</p>
          </div>
          <ToggleSwitch
            label="WhatsApp ile iletişim"
            checked={state.show_whatsapp && state.phone_visibility !== "hidden"}
            disabled={busy || state.phone_visibility === "hidden"}
            onChange={(v) => void save({ ...state, show_whatsapp: v })}
          />
        </section>
      </div>
    </AccountShell>
  );
}
