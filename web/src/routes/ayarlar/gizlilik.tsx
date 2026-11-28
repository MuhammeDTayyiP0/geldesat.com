import { ErrorState } from "@/components/common/ErrorState";
import { createFileRoute } from "@tanstack/react-router";
import { errorText } from "@/lib/error-text";
import { useEffect, useState } from "react";
import { Ban, EyeOff, Globe, Users } from "lucide-react";
import { toast } from "sonner";
import { getAccountSettings, updatePrivacySettings } from "@/lib/server/settings";
import { listBlockedUsers } from "@/lib/server/chat";
import { unblockUser } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { PhoneVisibility } from "@/lib/notification-prefs";
import { cn, formatDate } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AccountShell, UserAvatar } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/gizlilik")({
  head: () => ({ meta: [{ title: "Gizlilik ve engellenenler | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PrivacySettings,
});

type BlockedRow = Awaited<ReturnType<typeof listBlockedUsers>>[number];

const PHONE_OPTIONS: Array<{ value: PhoneVisibility; title: string; body: string; icon: typeof Globe }> = [
  { value: "everyone", title: "Herkes", body: "Giriş yapmayan ziyaretçiler de “Telefonu göster” ile numaranızı görebilir.", icon: Globe },
  { value: "members", title: "Sadece üyeler", body: "Numaranızı yalnızca giriş yapmış kullanıcılar görebilir. (Önerilen)", icon: Users },
  { value: "hidden", title: "Kimse", body: "Numaranız gösterilmez; alıcılar size yalnızca mesajla ulaşır.", icon: EyeOff },
];

function PrivacySettings() {
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<{ phone_visibility: PhoneVisibility; show_whatsapp: boolean; read_receipts: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [blocked, setBlocked] = useState<BlockedRow[] | null>(null);
  const [blockedFailed, setBlockedFailed] = useState(false);
  const [blockedRetry, setBlockedRetry] = useState(0);
  const [unblockBusy, setUnblockBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getAccountSettings()
      .then((s) => setState({ phone_visibility: s.phone_visibility, show_whatsapp: s.show_whatsapp, read_receipts: s.read_receipts }))
      .catch(() => setFailed(true));
  }, [user, retry]);

  useEffect(() => {
    if (!user) return;
    listBlockedUsers()
      .then((rows) => {
        setBlockedFailed(false);
        setBlocked(rows);
      })
      .catch(() => setBlockedFailed(true));
  }, [user, blockedRetry]);

  if (failed) {
    return (
      <AccountShell title="Gizlilik ve engellenenler">
        <ErrorState
          message="Ayarlarınız yüklenemedi. Tekrar deneyin."
          onRetry={() => {
            setFailed(false);
            setRetry((r) => r + 1);
          }}
        />
      </AccountShell>
    );
  }
  if (isPending || (user && !state)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !state) return <RedirectToSignIn />;

  async function unblock(r: BlockedRow) {
    setUnblockBusy(r.id);
    try {
      await unblockUser({ data: { userId: r.id } });
      setBlocked((prev) => (prev ?? []).filter((x) => x.id !== r.id));
      toast.success(`${r.name} için engel kaldırıldı`);
    } catch (e) {
      toast.error(errorText(e, "Engel kaldırılamadı"));
    } finally {
      setUnblockBusy(null);
    }
  }

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
      toast.error(errorText(err, "Kaydedilemedi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Gizlilik ve engellenenler" description="İletişim bilgilerinizin kimlere görüneceğini ve engellenen kişileri yönetin.">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">Telefon numaramı kimler görebilir?</h2>
          <p className="mt-1 text-sm text-muted">Tüm ilanlarınız için geçerlidir. İlana özel girdiğiniz numara da bu ayara uyar.</p>
          <div className="mt-4 grid gap-2" aria-label="Telefon görünürlüğü">
            {PHONE_OPTIONS.map(({ value, title, body, icon: Icon }) => {
              const on = state.phone_visibility === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => !on && !busy && void save({ ...state, phone_visibility: value })}
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
                    {on ? <span className="size-2 rounded-full bg-primary-solid" /> : null}
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

        <section className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <div>
            <h2 className="text-base font-semibold">Okundu bilgisi</h2>
            <p className="mt-1 text-sm text-muted">
              Kapatırsanız mesajlarını okuduğunuz görülmez; karşılıklı olduğu için siz de başkalarının okuduğunu göremezsiniz.
            </p>
          </div>
          <ToggleSwitch label="Okundu bilgisi" checked={state.read_receipts} disabled={busy} onChange={(v) => void save({ ...state, read_receipts: v })} />
        </section>

        <section id="engellenenler" className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-base font-semibold">Engellenen kullanıcılar</h2>
          <p className="mt-1 text-sm text-muted">Engellediğiniz kişiler size mesaj gönderemez, siz de onlara gönderemezsiniz.</p>
          {blockedFailed ? (
            <div className="mt-4">
              <ErrorState
                message="Engellenenler listesi yüklenemedi."
                onRetry={() => {
                  setBlockedFailed(false);
                  setBlockedRetry((r) => r + 1);
                }}
              />
            </div>
          ) : blocked === null ? (
            <p className="mt-4 text-sm text-muted">Yükleniyor…</p>
          ) : blocked.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-elevated/40 px-4 py-6 text-center">
              <Ban className="mx-auto size-7 text-subtle" />
              <p className="mt-2 text-sm text-muted">Engellediğiniz kimse yok.</p>
              <p className="mt-1 text-xs text-subtle">Bir sohbetteki ⋮ menüsünden kullanıcıları engelleyebilirsiniz.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {blocked.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar src={r.avatar} name={r.name} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted">{formatDate(r.since)} tarihinde engellendi</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={unblockBusy === r.id} onClick={() => void unblock(r)}>
                    Engeli kaldır
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
