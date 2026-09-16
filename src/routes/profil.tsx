import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMe, updateProfile, upsertStore } from "@/lib/server/account";
import { deleteSavedSearch, mySavedSearches } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/profil")({ component: Profil });

function Profil() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Awaited<ReturnType<typeof getMe>> | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof mySavedSearches>>>([]);

  useEffect(() => {
    if (!user) return;
    void getMe().then((m) => {
      setMe(m);
      setName(m.profile?.display_name ?? "");
      setPhone(m.profile?.phone ?? "");
      setBio(m.profile?.bio ?? "");
      setCity(m.profile?.city ?? "");
      setStoreName(m.store?.name ?? "");
    });
    void mySavedSearches().then(setSaved).catch(() => setSaved([]));
  }, [user]);

  if (isPending) return <p className="p-10 text-center text-muted">Yükleniyor…</p>;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Profil</h1>
      <p className="mt-1 text-sm text-muted">{user.primaryEmail}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-semibold">{me?.profile?.active_count ?? 0}</p>
          <p className="text-xs text-muted">Aktif ilan</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-semibold">{me?.profile?.rating_avg?.toFixed(1) ?? "—"}</p>
          <p className="text-xs text-muted">Puan</p>
        </div>
      </div>
      <form
        className="mt-8 space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await updateProfile({ data: { display_name: name, phone, bio, city } });
            toast.success("Profil kaydedildi");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Hata");
          }
        }}
      >
        <div>
          <Label>Ad</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
        </div>
        <div>
          <Label>İl</Label>
          <Select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Seçin</option>
            {TURKEY_CITIES.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Hakkında</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <Button type="submit">Kaydet</Button>
      </form>
      <form
        className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const s = await upsertStore({ data: { name: storeName, description: storeDesc, city, phone } });
            toast.success("Mağaza hazır");
            setMe((m) =>
              m ? { ...m, store: { id: s.id, name: storeName, slug: s.slug, plan: m.store?.plan ?? "BASIC", city } } : m,
            );
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Hata");
          }
        }}
      >
        <h2 className="font-semibold">Mağaza</h2>
        <p className="text-sm text-muted">Kurumsal vitrin. İlanlarınız mağaza sayfasında toplanır.</p>
        <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Mağaza adı" required />
        <Textarea value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} placeholder="Kısa açıklama" />
        <Button type="submit" variant="outline">
          {me?.store ? "Mağazayı güncelle" : "Mağaza aç"}
        </Button>
        {me?.store ? (
          <Link to="/magaza/$slug" params={{ slug: me.store.slug }} className="ml-3 text-sm text-primary">
            Mağazayı gör
          </Link>
        ) : null}
      </form>
      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Kayıtlı aramalar</h2>
        <p className="mt-1 text-sm text-muted">Uyan yeni ilan olunca bildirim gelir.</p>
        {saved.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Henüz kayıtlı arama yok. Arama sayfasından “Kaydet” deyin.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {saved.map((s) => {
              let href = `/search?q=${encodeURIComponent(s.query)}`;
              try {
                const f = JSON.parse(s.filters) as Record<string, string>;
                const params = new URLSearchParams();
                for (const [k, v] of Object.entries(f)) {
                  if (v) params.set(k, String(v));
                }
                const q = params.toString();
                if (q) href = `/search?${q}`;
              } catch {
                /* keep href */
              }
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <a href={href} className="min-w-0 truncate text-sm hover:text-primary">
                    {s.label || s.query || "Kayıtlı arama"}
                  </a>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-danger"
                    onClick={() =>
                      void deleteSavedSearch({ data: { id: s.id } }).then(() =>
                        setSaved((prev) => prev.filter((x) => x.id !== s.id)),
                      )
                    }
                  >
                    Sil
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-6 flex gap-3 text-sm">
        <Link to="/ilanlarim">İlanlarım</Link>
        <Link to="/favoriler">Favoriler</Link>
      </div>
    </div>
  );
}
