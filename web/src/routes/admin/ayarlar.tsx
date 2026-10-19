import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Building2, Landmark, LayoutTemplate, ListChecks, Plus, Save, Settings2, Smartphone, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "@/lib/utils";
import { adminGetSettings, adminSaveAppConfig, adminSaveSiteSettings, type MobileAppConfig, type ModerationMode } from "@/lib/server/admin/content";
import { useRunner } from "@/components/admin/hooks";
import { Card, CardHead, ErrorState, Field, inputClass, PageHeader, Spinner } from "@/components/admin/ui";

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
        <div className="grid gap-4 lg:grid-cols-2">
          <FeaturesCard key={JSON.stringify(d.features)} features={d.features} />
          <HomeSectionsCard key={d.homeSections.join(",")} sections={d.homeSections} />
        </div>
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

const FEATURE_LABELS: Record<string, { label: string; hint: string }> = {
  doping_enabled: { label: "Doping / vitrin satışı", hint: "Mobil uygulamada doping ekranlarını gösterir." },
  ab_testing: { label: "A/B testleri", hint: "Mobil ilan kartı yerleşim deneyi." },
  mobile_bottom_nav: { label: "Mobil alt menü", hint: "Mobil uygulamada alt gezinme çubuğu." },
};

function FeaturesCard({ features }: { features: Record<string, boolean> }) {
  const [value, setValue] = useState(features);
  const [newKey, setNewKey] = useState("");
  const { run, busy } = useRunner();
  const dirty = JSON.stringify(value) !== JSON.stringify(features);
  return (
    <Card>
      <CardHead title={<span className="inline-flex items-center gap-2"><ToggleLeft className="size-4 text-primary" /> Özellik anahtarları</span>} description="Uygulamalara giden açma/kapama ayarları (feature flags)." />
      <ul className="divide-y divide-border">
        {Object.entries(value).map(([key, on]) => (
          <li key={key} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{FEATURE_LABELS[key]?.label ?? key}</p>
              <p className="text-xs text-muted">{FEATURE_LABELS[key]?.hint ?? <span className="font-mono">{key}</span>}</p>
            </div>
            <ToggleSwitch checked={on} onChange={(next) => setValue((v) => ({ ...v, [key]: next }))} label={key} />
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-border p-3">
        <input value={newKey} onChange={(e) => setNewKey(e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase())} placeholder="yeni_anahtar" className={cn(inputClass, "h-9 font-mono")} />
        <Button
          size="sm"
          variant="outline"
          disabled={!newKey || newKey in value}
          onClick={() => {
            setValue((v) => ({ ...v, [newKey]: false }));
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
