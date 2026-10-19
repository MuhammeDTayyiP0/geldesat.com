import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { AccountShell } from "@/components/account/AccountShell";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ayarlar/gorunum")({
  head: () => ({ meta: [{ title: "Görünüm | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AppearanceSettings,
});

const root = getRouteApi("__root__");

const OPTIONS: { value: ThemePref; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "system", label: "Cihaz ayarı", hint: "Telefonunuz veya bilgisayarınız hangi moddaysa", icon: Monitor },
  { value: "light", label: "Açık", hint: "Her zaman açık renkler", icon: Sun },
  { value: "dark", label: "Koyu", hint: "Her zaman koyu renkler; gece göz yormaz", icon: Moon },
];

/** Light / dark / follow-the-device. Works signed out too; the choice is kept in a cookie on this browser. */
function AppearanceSettings() {
  const pref = useThemePref((root.useLoaderData() as ThemePref | undefined) ?? "system");
  return (
    <AccountShell title="Görünüm" description="Sitenin açık veya koyu renklerde görünmesini seçin.">
      <div className="mx-auto max-w-2xl">
        <ul role="radiogroup" aria-label="Tema" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const selected = pref === o.value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setThemePref(o.value)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-elevated/60"
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-primary text-primary-fg" : "bg-elevated text-muted")}>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-xs text-muted">{o.hint}</span>
                  </span>
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full border-2",
                      selected ? "border-primary bg-primary text-primary-fg" : "border-border",
                    )}
                  >
                    {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 px-1 text-xs text-muted">Bu seçim bu tarayıcıda saklanır. Mobil uygulamada ayrıca seçebilirsiniz.</p>
      </div>
    </AccountShell>
  );
}
