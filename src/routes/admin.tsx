import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminListings,
  adminOverview,
  adminReports,
  adminUsers,
  resolveReport,
  saveSiteSettings,
  setListingStatus,
  setUserRole,
} from "@/lib/server/account";
import { getSiteSettings, listCategories } from "@/lib/server/catalog";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { CategoryAdminTree } from "@/components/listing/CategoryAdminTree";
import { formatPrice, listingStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import type { CategoryRow } from "@/lib/server/helpers";

export const Route = createFileRoute("/admin")({ component: Admin });

const STAT_LABELS: Record<string, string> = {
  listings: "Toplam ilan",
  pending: "Onay bekleyen",
  active: "Yayında",
  users: "Üye",
  reports: "Açık şikayet",
  stores: "Mağaza",
};

const TABS = ["ozet", "ilan", "sikayet", "uye", "kategori", "site"] as const;
type Tab = (typeof TABS)[number];

function tabLabel(t: Tab) {
  return t === "ozet"
    ? "Özet"
    : t === "ilan"
      ? "İlanlar"
      : t === "sikayet"
        ? "Şikayetler"
        : t === "uye"
          ? "Üyeler"
          : t === "kategori"
            ? "Kategoriler"
            : "Site";
}

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("ozet");
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [listings, setListings] = useState<Awaited<ReturnType<typeof adminListings>>>([]);
  const [reports, setReports] = useState<Awaited<ReturnType<typeof adminReports>>>([]);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof adminUsers>>>([]);
  const [company, setCompany] = useState("GeldeSat");
  const [supportEmail, setSupportEmail] = useState("destek@geldesat.com");
  const [supportPhone, setSupportPhone] = useState("");
  const [savingSite, setSavingSite] = useState(false);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const s = await adminOverview();
      setStats(s as Record<string, number>);
      setErr("");
    } catch {
      setErr("Yönetici değilsiniz veya giriş yapmadınız.");
    }
  }
  useEffect(() => {
    if (user) void load();
  }, [user]);

  useEffect(() => {
    if (!user || err) return;
    if (tab === "ilan") void adminListings({ data: {} }).then(setListings);
    if (tab === "sikayet") void adminReports().then(setReports);
    if (tab === "uye") void adminUsers().then(setUsers);
    if (tab === "kategori") {
      void listCategories().then((d) => setCats(d.categories));
    }
    if (tab === "site") {
      void getSiteSettings().then((s) => {
        setCompany(s.company_name);
        setSupportEmail(s.support_email);
        setSupportPhone(s.support_phone);
      });
    }
  }, [tab, user, err]);

  if (isPending) return <p className="p-10 text-center text-muted">Yükleniyor…</p>;
  if (!user) return <RedirectToSignIn />;
  if (err) return <p className="p-12 text-center text-muted">{err}</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Yönetim</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "ink" : "outline"} onClick={() => setTab(t)}>
            {tabLabel(t)}
          </Button>
        ))}
      </div>
      {tab === "ozet" && stats ? (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {Object.entries(stats)
            .filter(([k]) => STAT_LABELS[k])
            .map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{STAT_LABELS[k] ?? k}</p>
              <p className="mt-1 text-2xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === "ilan" ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="p-3">Başlık</th>
                <th>Durum</th>
                <th>Fiyat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-border">
                  <td className="p-3">
                    <Link to="/ilan/$slug" params={{ slug: l.slug }} className="hover:underline">
                      {l.title}
                    </Link>
                  </td>
                  <td>
                    <Badge>{listingStatusLabel(l.status)}</Badge>
                  </td>
                  <td>{formatPrice(l.price)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <Link to="/ilan-ver" search={{ id: l.id }}>
                        <Button size="sm" variant="outline">
                          Düzenle
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => setListingStatus({ data: { id: l.id, status: "ACTIVE" } }).then(() => adminListings({ data: {} }).then(setListings))}>
                        Onay
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setListingStatus({ data: { id: l.id, status: "REJECTED" } }).then(() => adminListings({ data: {} }).then(setListings))}>
                        Red
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "sikayet" ? (
        <ul className="mt-6 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="font-medium">{r.reason}</p>
              <p className="text-muted">{r.title}</p>
              <p className="text-xs text-subtle">{r.status}</p>
              {r.status === "OPEN" ? (
                <Button size="sm" className="mt-2" variant="outline" onClick={() => resolveReport({ data: { id: r.id, status: "CLOSED" } }).then(() => adminReports().then(setReports))}>
                  Kapat
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "uye" ? (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
          {users.map((u) => (
            <li key={u.user_id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{u.display_name}</p>
                <p className="text-xs text-muted">
                  {u.role} · {u.listing_count} ilan
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setUserRole({ data: { userId: u.user_id, role: u.role === "ADMIN" ? "USER" : "ADMIN" } })
                    .then(() => adminUsers().then(setUsers))
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Hata"))
                }
              >
                Rol değiştir
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "kategori" ? (
        <CategoryAdminTree
          categories={cats}
          onRefresh={() => listCategories().then((d) => setCats(d.categories))}
        />
      ) : null}
      {tab === "site" ? (
        <form
          className="mt-6 max-w-xl space-y-3 rounded-xl border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSavingSite(true);
            saveSiteSettings({
              data: {
                company_name: company,
                iban: "",
                bank_name: "",
                account_holder: "",
                support_email: supportEmail,
                support_phone: supportPhone,
              },
            })
              .then(() => toast.success("Site ayarları kaydedildi"))
              .catch((e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"))
              .finally(() => setSavingSite(false));
          }}
        >
          <p className="text-sm text-muted">İletişim bilgileri sitede görünür.</p>
          <div>
            <Label>Unvan</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Destek e-posta</Label>
            <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Destek telefon</Label>
            <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="05xx xxx xx xx" maxLength={20} />
          </div>
          <Button type="submit" disabled={savingSite}>
            {savingSite ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
