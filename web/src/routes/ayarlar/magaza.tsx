import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Store } from "lucide-react";
import { toast } from "sonner";
import { getMe, upsertStore } from "@/lib/server/account";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { cleanPhone, maskPhone10 } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/ayarlar/magaza")({
  head: () => ({ meta: [{ title: "Mağazam | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StoreSettings,
});

type Form = { name: string; description: string; city: string; phone: string };

function StoreSettings() {
  const { user, isPending } = useCurrentUserState();
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<{ slug: string } | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form>({ name: "", description: "", city: "", phone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMe()
      .then((m) => {
        const s = m.store;
        const initial: Form = {
          name: s?.name ?? "",
          description: s?.description ?? "",
          city: s?.city ?? m.profile?.city ?? "",
          phone: maskPhone10(s?.phone ?? m.profile?.phone ?? ""),
        };
        setStore(s ? { slug: s.slug } : null);
        setSaved(s ? initial : null);
        setForm(initial);
        setLoaded(true);
      })
      .catch(() => toast.error("Mağaza bilgileri yüklenemedi"));
  }, [user]);

  if (isPending || (user && !loaded)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  const dirty = !saved || JSON.stringify(form) !== JSON.stringify(saved);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await upsertStore({
        data: { name: form.name.trim(), description: form.description.trim(), city: form.city, phone: cleanPhone(form.phone) },
      });
      toast.success(store ? "Mağaza güncellendi" : "Mağazanız açıldı");
      setStore({ slug: res.slug });
      setSaved(form);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell
      title="Mağazam"
      description="İlanlarınız mağaza sayfanızda tek bir vitrinde toplanır."
      actions={
        store ? (
          <Link to="/magaza/$slug" params={{ slug: store.slug }}>
            <Button size="sm" variant="outline">
              <ExternalLink className="size-3.5" /> <span className="hidden sm:inline">Mağazayı gör</span>
            </Button>
          </Link>
        ) : null
      }
    >
      {!store ? (
        <div className="mb-5 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <Store className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Henüz bir mağazanız yok. Aşağıdaki bilgileri doldurarak ücretsiz açabilirsiniz; yeni ilanlarınız otomatik olarak mağazanızda
            listelenir.
          </p>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <div>
          <Label htmlFor="st-name">Mağaza adı</Label>
          <Input id="st-name" value={form.name} onChange={(e) => set({ name: e.target.value })} minLength={3} maxLength={60} required />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <Label htmlFor="st-desc" className="mb-0">
              Açıklama
            </Label>
            <span className="text-xs tabular-nums text-subtle">{form.description.length}/400</span>
          </div>
          <Textarea
            id="st-desc"
            value={form.description}
            onChange={(e) => set({ description: e.target.value.slice(0, 400) })}
            placeholder="İşletmenizi, çalışma saatlerinizi ve hizmetlerinizi anlatın"
            rows={4}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="st-city">İl</Label>
            <Select id="st-city" value={form.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">Seçin</option>
              {TURKEY_CITIES.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="st-phone">Mağaza telefonu</Label>
            <PhoneInput id="st-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit" disabled={busy || !dirty}>
            {busy ? "Kaydediliyor…" : store ? "Kaydet" : "Mağazayı aç"}
          </Button>
        </div>
      </form>
    </AccountShell>
  );
}
