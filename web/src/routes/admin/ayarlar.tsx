import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Building2, ChevronRight, Landmark, LayoutTemplate, ListChecks, Plus, Save, Settings2, Smartphone, ToggleLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "@/lib/utils";
import { FLAG_PLATFORMS, type FlagPlatform, type FlagRule, type FlagRules } from "@/lib/flags";
import { adminGetSettings, adminSaveAppConfig, adminSaveSiteSettings, type MobileAppConfig, type ModerationMode } from "@/lib/server/admin/content";
import { useRunner } from "@/components/admin/hooks";
import type { Tone } from "@/components/admin/format";
import { Card, CardHead, ErrorState, Field, inputClass, PageHeader, Pill, Spinner, useConfirm } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/ayarlar")({
  component: SettingsPage,
});

function SettingsPage() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
        <Spinner /> Ayarlar yükleniyor…
      </div>
    );
  }
  const d = q.data;
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader icon={Settings2} title="Ayarlar" description="Site bilgileri, ilan onay politikası, özellik anahtarları ve mobil uygulama ayarları. Her değişiklik işlem kaydına yazılır." />
      <div className="space-y-4">
        <ModerationCard key={d.moderation.mode} mode={d.moderation.mode} />
        <SiteCard key={JSON.stringify(d.site)} site={d.site} />
        <FeaturesCard key={JSON.stringify(d.features)} features={d.features} />
        <HomeSectionsCard key={d.homeSections.join(",")} sections={d.homeSections} />
        <MobileCard key={JSON.stringify(d.mobileApp)} config={d.mobileApp} />
      </div>
    </div>
  );
}

const MODES: Array<{ value: ModerationMode; title: string; body: string }> = [
  { value: "first_free", title: "İlk ilan serbest", body: "Üyenin ilk ilanı hemen yayına girer, sonrakiler onay bekler. Yeni üyeyi bekletmez, kötüye kullanımı sınırlar." },
  { value: "all", title: "Tüm ilanlar onaylı", body: "Her yeni ilan ve içerik değişikliği yayından önce incelenir. En güvenli, en çok emek isteyen seçenek." },
  { value: "none", title: "Onaysız yayın", body: "İlanlar ve düzenlemeler doğrudan yayına girer; yalnızca şikayetle müdahale edilir." },
];

function ModerationCard({ mode }: { mode: ModerationMode }) {
  const [value, setValue] = useState(mode);
  const { run, busy } = useRunner();
  return (
    <Card>
      <CardHead title={<span className="inline-flex items-center gap-2"><ListChecks className="size-4 text-primary" /> İlan onay politikası</span>} description="Yeni ve düzenlenen ilanların yayına nasıl gireceği. Yöneticilerin ilanları her zaman doğrudan yayına girer." />
      <div className="grid gap-2 p-4 md:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setValue(m.value)}
            className={cn("rounded-xl border p-3.5 text-left transition-colors", value === m.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40")}
          >
            <span className="flex items-center gap-2">
              <span className={cn("flex size-4 items-center justify-center rounded-full border-2", value === m.value ? "border-primary" : "border-border")}>
                {value === m.value ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              <span className="text-sm font-semibold">{m.title}</span>
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-muted">{m.body}</span>
          </button>
        ))}
      </div>
      {value !== mode ? (
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button size="sm" disabled={busy} onClick={() => void run(() => adminSaveAppConfig({ data: { key: "moderation", value: { mode: value } } }), "Onay politikası güncellendi.")}>
            <Save className="size-4" /> Kaydet
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function SiteCard({ site }: { site: Awaited<ReturnType<typeof adminGetSettings>>["site"] }) {
  const [form, setForm] = useState(site);
  const { run, busy } = useRunner();
  const dirty = JSON.stringify(form) !== JSON.stringify(site);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Card>
      <CardHead title={<span className="inline-flex items-center gap-2"><Building2 className="size-4 text-primary" /> Site ve iletişim bilgileri</span>} description="Altbilgi, iletişim sayfası ve e-postalarda görünür." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => adminSaveSiteSettings({ data: form }), "Site bilgileri kaydedildi.");
        }}
      >
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <Field label="Firma / platform adı">
            <input value={form.company_name} onChange={set("company_name")} maxLength={80} className={inputClass} />
          </Field>
          <Field label="Destek e-postası">
            <input type="email" value={form.support_email} onChange={set("support_email")} maxLength={120} className={inputClass} />
          </Field>
          <Field label="Destek telefonu">
            <input value={form.support_phone} onChange={set("support_phone")} className={inputClass} placeholder="05xx xxx xx xx" />
          </Field>
        </div>
        <div className="border-t border-border p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Landmark className="size-4 text-muted" /> Banka / havale bilgileri
            <span className="text-xs font-normal text-muted">Doping havalesi için üyelere gösterilir (isteğe bağlı)</span>
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Banka">
              <input value={form.bank_name} onChange={set("bank_name")} maxLength={80} className={inputClass} placeholder="Ör. Ziraat Bankası" />
            </Field>
            <Field label="Hesap sahibi">
              <input value={form.account_holder} onChange={set("account_holder")} maxLength={80} className={inputClass} />
            </Field>
            <Field label="IBAN">
              <input value={form.iban} onChange={set("iban")} maxLength={40} className={cn(inputClass, "font-mono")} placeholder="TR00 0000 …" />
            </Field>
          </div>
        </div>
        {dirty ? (
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(site)}>
              Geri al
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              <Save className="size-4" /> Kaydet
            </Button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

/** Descriptions for flags saved before flags carried their own. */
const KNOWN_FLAGS: Record<string, string> = {
  doping_enabled: "Doping / vitrin satışı ekranları.",
  mobile_bottom_nav: "Mobil uygulamada alt gezinme çubuğu.",
};

const PLATFORM_LABEL: Record<FlagPlatform, string> = { web: "Web", ios: "iOS", android: "Android" };
const ROLLOUT_STEPS = [0, 1, 5, 10, 25, 50, 100];

function flagStatus(rule: FlagRule): { label: string; tone: Tone } {
  if (!rule.enabled) return { label: "Kapalı", tone: "muted" };
  if (rule.rollout >= 100) return { label: "Herkese açık", tone: "ok" };
  if (rule.rollout <= 0) return rule.admins ? { label: "Sadece yöneticiler", tone: "violet" } : { label: "Kimseye açık değil", tone: "muted" };
  return { label: `Üyelerin %${rule.rollout}'i`, tone: "warn" };
}

function FeaturesCard({ features }: { features: FlagRules }) {
  const [value, setValue] = useState(features);
  const [open, setOpen] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const { run, busy } = useRunner();
  const { confirm } = useConfirm();
  const dirty = JSON.stringify(value) !== JSON.stringify(features);
  const patch = (key: string, p: Partial<FlagRule>) => setValue((v) => ({ ...v, [key]: { ...v[key], ...p } }));
  const remove = async (key: string) => {
    const ok = await confirm({
      title: `"${key}" silinsin mi?`,
      body: "Kaydettiğinizde bu anahtar uygulamalara artık gönderilmez; kodda kullanılıyorsa kapalı sayılır.",
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    setValue((v) => {
      const next = { ...v };
      delete next[key];
      return next;
    });
  };

  return (
    <Card>
      <CardHead
        title={<span className="inline-flex items-center gap-2"><ToggleLeft className="size-4 text-primary" /> Özellik anahtarları</span>}
        description="Yeni bir özelliği önce yöneticilere, sonra üyelerin bir yüzdesine, en sonda herkese açın. Ana anahtar kapalıysa özellik herkeste kapanır. Değişiklik yeni açılışlara hemen, açık sayfa ve uygulamalara birkaç dakika içinde yansır."
      />
      <ul className="divide-y divide-border">
        {Object.entries(value).map(([key, rule]) => {
          const status = flagStatus(rule);
          const expanded = open === key;
          return (
            <li key={key}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpen(expanded ? null : key)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
                  <ChevronRight className={cn("size-4 shrink-0 text-subtle transition-transform", expanded && "rotate-90")} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-medium">{key}</span>
                      <Pill tone={status.tone}>{status.label}</Pill>
                      {rule.platforms.length ? <Pill>{rule.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}</Pill> : null}
                      {rule.minAppVersion ? <Pill>≥ {rule.minAppVersion}</Pill> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{rule.description || KNOWN_FLAGS[key] || "Açıklama yok"}</span>
                  </span>
                </button>
                <ToggleSwitch checked={rule.enabled} onChange={(next) => patch(key, { enabled: next })} label={`${key} ana anahtarı`} />
              </div>
              {expanded ? (
                <div className="space-y-4 border-t border-border bg-elevated/40 px-4 py-4 md:pl-10">
                  <Field label="Açıklama">
                    <input value={rule.description} onChange={(e) => patch(key, { description: e.target.value })} maxLength={200} className={inputClass} placeholder={KNOWN_FLAGS[key] ?? "Bu anahtar neyi açıyor?"} />
                  </Field>
                  <Field label="Kimler görsün?" hint="Aynı üye her zaman aynı sonucu alır; yüzdeyi artırınca önceden görenler görmeye devam eder.">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ROLLOUT_STEPS.map((step) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => patch(key, { rollout: step })}
                          className={cn(
                            "h-8 rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition-colors",
                            rule.rollout === step ? "border-primary bg-primary/8 text-primary" : "border-border text-muted hover:border-primary/40 hover:text-fg",
                          )}
                        >
                          %{step}
                        </button>
                      ))}
                      <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.rollout}
                          onChange={(e) => patch(key, { rollout: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
                          className={cn(inputClass, "h-8 w-20 tabular-nums")}
                          aria-label="Yüzde"
                        />
                        %
                      </span>
                    </div>
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Platformlar" hint="Hiçbiri seçili değilse hepsinde çalışır.">
                      <div className="flex gap-1.5">
                        {FLAG_PLATFORMS.map((p) => {
                          const on = rule.platforms.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              aria-pressed={on}
                              onClick={() => patch(key, { platforms: FLAG_PLATFORMS.filter((x) => (x === p ? !on : rule.platforms.includes(x))) })}
                              className={cn(
                                "h-9 rounded-lg border px-3 text-sm font-medium transition-colors",
                                on ? "border-primary bg-primary/8 text-primary" : "border-border text-muted hover:border-primary/40 hover:text-fg",
                              )}
                            >
                              {PLATFORM_LABEL[p]}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="En düşük uygulama sürümü" hint="Bu sürümden eski uygulamalarda kapalı kalır (web'i etkilemez).">
                      <input
                        value={rule.minAppVersion ?? ""}
                        onChange={(e) => patch(key, { minAppVersion: e.target.value.replace(/[^\d.]/g, "") || null })}
                        className={cn(inputClass, "font-mono")}
                        placeholder="Tüm sürümler (ör. 1.2.0)"
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm">
                      <ToggleSwitch checked={rule.admins} onChange={(next) => patch(key, { admins: next })} label="Yöneticilere her zaman açık" />
                      <span>
                        Yöneticilere her zaman açık
                        <span className="block text-xs text-muted">Yüzde %0 iken bile kendi hesabınızda deneyebilirsiniz.</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="hidden rounded bg-elevated px-2 py-1 text-[11px] text-muted sm:inline">useFlag("{key}")</code>
                      <Button type="button" size="sm" variant="ghost" className="text-danger" onClick={() => void remove(key)}>
                        <Trash2 className="size-4" /> Sil
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 border-t border-border p-3">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 60))}
          placeholder="yeni_ozellik"
          className={cn(inputClass, "h-9 font-mono")}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!newKey || newKey in value}
          onClick={() => {
            // A new feature starts dark: on for admins only, 0% for everyone else.
            setValue((v) => ({ ...v, [newKey]: { enabled: true, rollout: 0, platforms: [], minAppVersion: null, admins: true, description: "" } }));
            setOpen(newKey);
            setNewKey("");
          }}
        >
          <Plus className="size-4" /> Ekle
        </Button>
      </div>
      {dirty ? (
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="ghost" onClick={() => setValue(features)}>
            Geri al
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run(() => adminSaveAppConfig({ data: { key: "features", value } }), "Özellik anahtarları kaydedildi.")}>
            <Save className="size-4" /> Kaydet
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

const SECTION_LABELS: Record<string, string> = {
  hero: "Karşılama alanı",
  categories: "Kategoriler",
  featured: "Vitrin ilanları",
  recent: "Son eklenenler",
  stats: "İstatistikler",
};
const ALL_SECTIONS = ["hero", "categories", "featured", "recent", "stats"] as const;

function HomeSectionsCard({ sections }: { sections: string[] }) {
  const initial = sections.filter((s): s is (typeof ALL_SECTIONS)[number] => (ALL_SECTIONS as readonly string[]).includes(s));
  const [order, setOrder] = useState(initial);
  const { run, busy } = useRunner();
  const hidden = ALL_SECTIONS.filter((s) => !order.includes(s));
  const dirty = order.join(",") !== initial.join(",");
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const next = [...o];
      const j = i + d;
      if (j < 0 || j >= next.length) return o;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <Card>
      <CardHead title={<span className="inline-flex items-center gap-2"><LayoutTemplate className="size-4 text-primary" /> Mobil ana sayfa bölümleri</span>} description="Mobil uygulama ana ekranındaki bölümlerin sırası ve görünürlüğü." />
      <ul className="divide-y divide-border">
        {order.map((s, i) => (
          <li key={s} className="flex items-center gap-2 px-4 py-2.5">
            <span className="w-5 text-xs tabular-nums text-subtle">{i + 1}</span>
            <span className="flex-1 text-sm font-medium">{SECTION_LABELS[s]}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-muted hover:bg-elevated disabled:opacity-30" aria-label="Yukarı">
              <ArrowUp className="size-4" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} className="rounded p-1 text-muted hover:bg-elevated disabled:opacity-30" aria-label="Aşağı">
              <ArrowDown className="size-4" />
            </button>
            <ToggleSwitch checked onChange={() => setOrder((o) => o.filter((x) => x !== s))} label={`${SECTION_LABELS[s]} gizle`} />
          </li>
        ))}
        {hidden.map((s) => (
          <li key={s} className="flex items-center gap-2 px-4 py-2.5 opacity-60">
            <span className="w-5" />
            <span className="flex-1 text-sm">{SECTION_LABELS[s]} (gizli)</span>
            <ToggleSwitch checked={false} onChange={() => setOrder((o) => [...o, s])} label={`${SECTION_LABELS[s]} göster`} />
          </li>
        ))}
      </ul>
      {dirty ? (
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="ghost" onClick={() => setOrder(initial)}>
            Geri al
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run(() => adminSaveAppConfig({ data: { key: "home_sections", value: order } }), "Ana sayfa bölümleri kaydedildi.")}>
            <Save className="size-4" /> Kaydet
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function MobileCard({ config }: { config: MobileAppConfig }) {
  const [form, setForm] = useState({ ...config, announcement: config.announcement ?? "" });
  const { run, busy } = useRunner();
  const dirty = form.min_ios_version !== config.min_ios_version || form.min_android_version !== config.min_android_version || (form.announcement || null) !== (config.announcement || null);
  return (
    <Card>
      <CardHead title={<span className="inline-flex items-center gap-2"><Smartphone className="size-4 text-primary" /> Mobil uygulama</span>} description="Zorunlu güncelleme sürümleri ve uygulama içi duyuru bandı." />
      <div className="grid gap-4 p-4 md:grid-cols-[200px_200px_1fr]">
        <Field label="En düşük iOS sürümü" hint="Altındaki sürümler güncellemeye zorlanır">
          <input value={form.min_ios_version} onChange={(e) => setForm((f) => ({ ...f, min_ios_version: e.target.value }))} className={cn(inputClass, "font-mono")} placeholder="1.0.0" />
        </Field>
        <Field label="En düşük Android sürümü">
          <input value={form.min_android_version} onChange={(e) => setForm((f) => ({ ...f, min_android_version: e.target.value }))} className={cn(inputClass, "font-mono")} placeholder="1.0.0" />
        </Field>
        <Field label="Duyuru bandı" hint="Boş bırakırsanız gösterilmez (en fazla 300 karakter)">
          <input value={form.announcement} onChange={(e) => setForm((f) => ({ ...f, announcement: e.target.value }))} maxLength={300} className={inputClass} placeholder="Ör. Bakım çalışması: 02:00-03:00" />
        </Field>
      </div>
      {dirty ? (
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="ghost" onClick={() => setForm({ ...config, announcement: config.announcement ?? "" })}>
            Geri al
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => adminSaveAppConfig({ data: { key: "mobile_app", value: { ...form, announcement: form.announcement.trim() || null } } }), "Mobil uygulama ayarları kaydedildi.")}
          >
            <Save className="size-4" /> Kaydet
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
