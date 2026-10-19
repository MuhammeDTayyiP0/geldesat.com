import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  BadgeCheck,
  Ban,
  Coins,
  ExternalLink,
  KeyRound,
  LogOut,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Star,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { photoSrc } from "@/lib/images";
import {
  adminBanUser,
  adminDeleteUser,
  adminGrantCredits,
  adminNotifyUser,
  adminRevokeSessions,
  adminSetUserRole,
  adminUnbanUser,
  adminUpdateUser,
  adminUserDetail,
  adminVerifyEmail,
  type AdminUserDetail,
} from "@/lib/server/admin/users";
import { useRunner, useSheets } from "./hooks";
import { dateTime, listingStatus, money, n, relative } from "./format";
import { AuditList } from "./AuditList";
import { Avatar, ErrorState, Field, inputClass, KeyValue, Menu, MenuItem, MenuSeparator, MiniStat, Modal, Pill, SheetHeader, Spinner, TabBar, textareaClass, Thumb, useConfirm } from "./ui";

const BAN_REASONS = [
  "Dolandırıcılık şüphesi",
  "Sahte veya yanıltıcı ilanlar",
  "Taciz / hakaret içeren mesajlar",
  "Yasaklı ürün satışı",
  "Çoklu hesap / spam",
];

export function UserSheetBody({ id, canGoBack }: { id: string; canGoBack: boolean }) {
  const { back, close, openListing } = useSheets();
  const query = useQuery({ queryKey: ["admin", "user", id], queryFn: () => adminUserDetail({ data: { userId: id } }) });
  const [tab, setTab] = useState<"overview" | "listings" | "sessions" | "reviews" | "history">("overview");
  const [modal, setModal] = useState<null | "edit" | "credits" | "notify">(null);

  if (query.isLoading) {
    return (
      <>
        <SheetHeader onClose={close}>
          <div className="h-5 w-48 animate-pulse rounded bg-elevated" />
        </SheetHeader>
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted">
          <Spinner /> Üye yükleniyor…
        </div>
      </>
    );
  }
  if (query.error || !query.data) {
    return (
      <>
        <SheetHeader onClose={close}>
          <span className="font-semibold">Üye</span>
        </SheetHeader>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const d = query.data;
  const u = d.user;
  const s = d.stats;

  return (
    <>
      <SheetHeader onClose={close}>
        <div className="flex items-start gap-3">
          {canGoBack ? (
            <button type="button" onClick={back} className="mt-0.5 rounded-lg p-1 text-muted hover:bg-elevated hover:text-fg" aria-label="Geri">
              <ArrowLeft className="size-4" />
            </button>
          ) : null}
          <Avatar name={u.display_name} src={u.avatar_url} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-lg font-bold">{u.display_name || "İsimsiz üye"}</h2>
              {u.role === "ADMIN" ? <Pill tone="ink">Yönetici</Pill> : null}
              {u.banned_at ? <Pill tone="danger">Askıda</Pill> : null}
              {u.deletion_requested_at ? <Pill tone="warn">Silinme sürecinde</Pill> : null}
              {d.store ? <Pill tone="violet">Mağaza: {d.store.name}</Pill> : null}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span>{u.email ?? "E-posta yok"}</span>
              {u.email ? u.email_verified ? <BadgeCheck className="size-4 text-ok" aria-label="Doğrulanmış" /> : <span className="text-xs text-warn">(doğrulanmamış)</span> : null}
              <span>· {u.phone ?? "Telefon yok"}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Üyelik {dateTime(u.created_at)} · Son görülme {relative(u.last_seen_at)} · Giriş: {u.providers.length ? u.providers.map((p) => (p === "credential" ? "e-posta" : p)).join(", ") : "—"}
            </p>
          </div>
        </div>
        {u.banned_at ? (
          <div className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            <strong>Askıya alındı</strong> ({dateTime(u.banned_at)}): {u.ban_reason}
          </div>
        ) : null}
      </SheetHeader>

      <UserActionBar detail={d} onModal={setModal} />

      <TabBar
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Genel" },
          { value: "listings", label: "İlanlar", count: u.listing_count },
          { value: "sessions", label: "Oturumlar", count: d.sessions.length },
          { value: "reviews", label: "Yorum & şikayet", count: d.reviews.length + d.reportsAgainst.length },
          { value: "history", label: "Geçmiş", count: d.log.length },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "overview" ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Yayındaki ilan" value={n(u.active_count)} tone="ok" />
              <MiniStat label="Bekleyen" value={n(s.pending)} tone={s.pending ? "warn" : undefined} />
              <MiniStat label="Reddedilen" value={n(s.rejected)} tone={s.rejected ? "danger" : undefined} />
              <MiniStat label="Toplam görüntülenme" value={n(s.views)} />
              <MiniStat label="Sohbet" value={n(s.conversations)} />
              <MiniStat label="Gönderilen mesaj" value={n(s.messages_sent)} />
              <MiniStat label="Puan" value={s.reviews_received ? `${s.rating_avg.toFixed(1)} ★` : "—"} />
              <MiniStat label="Doping kredisi" value={n(d.credits)} />
            </div>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Profil</h3>
              <KeyValue
                items={[
                  { label: "Konum", value: [u.city, u.district].filter(Boolean).join(" / ") || "—" },
                  { label: "Telefon görünürlüğü", value: { everyone: "Herkes", members: "Üyeler", hidden: "Gizli" }[u.phone_visibility] ?? u.phone_visibility },
                  { label: "Favori", value: n(s.favorites) },
                  { label: "Yaptığı şikayet", value: n(s.reports_filed) },
                  { label: "Engelleyen üye", value: n(s.blocked_by) },
                  { label: "Mesaj e-postası", value: u.message_email ? "Açık" : "Kapalı" },
                  { label: "Kimlik", value: <span className="font-mono text-xs">{u.user_id}</span> },
                  { label: "Silinme talebi", value: u.deletion_requested_at ? dateTime(u.deletion_requested_at) : "—" },
                ]}
              />
              {u.bio ? <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-muted">{u.bio}</p> : null}
            </section>
            <AdminNote user={u} />
          </div>
        ) : null}

        {tab === "listings" ? (
          d.listings.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {d.listings.map((l) => {
                const st = listingStatus(l.status, l.expires_at);
                return (
                  <li key={l.id}>
                    <button type="button" onClick={() => openListing(l.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-elevated">
                      <Thumb src={l.cover ? photoSrc(l.cover, 240) : null} className="size-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.title}</p>
                        <p className="truncate text-xs text-muted">
                          #{l.listing_no} · {l.category_name} · {money(l.price, l.currency)} · {relative(l.created_at)}
                        </p>
                      </div>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </button>
                  </li>
                );
              })}
              {u.listing_count > d.listings.length ? (
                <li className="px-3 py-2.5 text-center text-xs text-muted">
                  Son {d.listings.length} ilan gösteriliyor ·{" "}
                  <a href={`/admin/ilanlar?userId=${encodeURIComponent(u.user_id)}`} className="font-medium text-primary hover:underline">
                    tümünü ilan listesinde aç
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted">Bu üyenin ilanı yok.</p>
          )
        ) : null}

        {tab === "sessions" ? <SessionsTab detail={d} /> : null}

        {tab === "reviews" ? (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Aldığı değerlendirmeler</h3>
              {d.reviews.length ? (
                <ul className="space-y-2">
                  {d.reviews.map((r) => (
                    <li key={r.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-0.5 font-semibold text-warn">
                          {r.rating} <Star className="size-3.5 fill-current" />
                        </span>
                        <span className="text-muted">{r.reviewer_name}</span>
                        <span className="ml-auto text-xs text-muted">{relative(r.created_at)}</span>
                      </div>
                      {r.comment ? <p className="mt-1">{r.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Değerlendirme yok.</p>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">İlanları hakkındaki şikayetler</h3>
              {d.reportsAgainst.length ? (
                <ul className="space-y-2">
                  {d.reportsAgainst.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
                      <Pill tone={r.status === "OPEN" ? "danger" : "muted"}>{r.status === "OPEN" ? "Açık" : "Kapalı"}</Pill>
                      <span className="font-medium">{r.reason}</span>
                      <span className="truncate text-muted">· {r.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted">{relative(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Şikayet yok.</p>
              )}
            </section>
          </div>
        ) : null}

        {tab === "history" ? <AuditList entries={d.log} empty="Bu üye üzerinde henüz yönetici işlemi yapılmadı." /> : null}
      </div>

      {modal === "edit" ? <EditUserModal detail={d} onClose={() => setModal(null)} /> : null}
      {modal === "credits" ? <CreditsModal detail={d} onClose={() => setModal(null)} /> : null}
      {modal === "notify" ? <NotifyModal detail={d} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function UserActionBar({ detail, onModal }: { detail: AdminUserDetail; onModal: (m: "edit" | "credits" | "notify") => void }) {
  const u = detail.user;
  const { run, busy } = useRunner();
  const { confirm, prompt } = useConfirm();
  const { close } = useSheets();

  async function ban() {
    const reason = await prompt({
      title: `${u.display_name} askıya alınsın mı?`,
      body: "Üye giriş yapamaz, açık oturumları kapanır ve yayındaki/bekleyen ilanları gizlenir. Askıdan çıkarınca ilanlar geri gelir.",
      label: "Gerekçe (iç kayıt)",
      presets: BAN_REASONS,
      confirmLabel: "Askıya al",
      danger: true,
    });
    if (!reason) return;
    await run(() => adminBanUser({ data: { userId: u.user_id, reason } }), (r) => `Üye askıya alındı; ${r.hiddenListings} ilan gizlendi.`);
  }

  async function unban() {
    const ok = await confirm({ title: "Askı kaldırılsın mı?", body: "Üye tekrar giriş yapabilir; askı sırasında gizlenen ilanları eski durumuna döner.", confirmLabel: "Askıyı kaldır" });
    if (!ok) return;
    await run(() => adminUnbanUser({ data: { userId: u.user_id, restoreListings: true } }), (r) => `Askı kaldırıldı; ${r.restoredListings} ilan geri yüklendi.`);
  }

  async function setRole(role: "ADMIN" | "USER") {
    const ok = await confirm({
      title: role === "ADMIN" ? "Yönetici yetkisi verilsin mi?" : "Yönetici yetkisi kaldırılsın mı?",
      body: role === "ADMIN" ? `${u.display_name} tüm yönetim paneline ve üyelerin verilerine erişebilecek.` : `${u.display_name} artık yönetim paneline giremeyecek.`,
      confirmLabel: role === "ADMIN" ? "Yönetici yap" : "Yetkiyi kaldır",
      danger: role === "ADMIN",
    });
    if (!ok) return;
    await run(() => adminSetUserRole({ data: { userId: u.user_id, role } }), "Rol güncellendi.");
  }

  async function revoke() {
    const ok = await confirm({ title: "Tüm oturumlar kapatılsın mı?", body: "Üye tüm cihazlarda çıkış yapmış olur.", confirmLabel: "Oturumları kapat" });
    if (!ok) return;
    await run(() => adminRevokeSessions({ data: { userId: u.user_id } }), (r) => `${r.count} oturum kapatıldı.`);
  }

  async function remove() {
    const keep = await prompt({
      title: `${u.display_name} kalıcı olarak silinsin mi?`,
      body: "Profil, giriş bilgileri, favoriler, bildirimler ve mağaza silinir; sohbetler karşı tarafta kalır. Bu işlem geri alınamaz. Onaylamak için SİL yazın.",
      label: "Onay",
      placeholder: "SİL",
      multiline: false,
      confirmLabel: "Hesabı sil",
      danger: true,
    });
    if (keep == null) return;
    if (keep.toLocaleUpperCase("tr") !== "SİL") {
      toast.error("Onay metni eşleşmedi; hesap silinmedi.");
      return;
    }
    const r = await run(() => adminDeleteUser({ data: { userId: u.user_id, deleteListings: true } }), "Hesap silindi.");
    if (r) close();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-5 py-2.5">
      {u.banned_at ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void unban()}>
          <Unlock className="size-4" /> Askıyı kaldır
        </Button>
      ) : u.role !== "ADMIN" ? (
        <Button size="sm" variant="outline" className="text-danger" disabled={busy} onClick={() => void ban()}>
          <Ban className="size-4" /> Askıya al
        </Button>
      ) : null}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onModal("notify")}>
        <Bell className="size-4" /> Bildirim gönder
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onModal("edit")}>
        <Pencil className="size-4" /> Düzenle
      </Button>
      <a href={`/satici/${u.user_id}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted hover:bg-elevated hover:text-fg">
        <ExternalLink className="size-4" /> Profil sayfası
      </a>
      <div className="ml-auto">
        <Menu>
          {u.role === "ADMIN" ? (
            <MenuItem icon={ShieldOff} onSelect={() => void setRole("USER")}>
              Yönetici yetkisini kaldır
            </MenuItem>
          ) : (
            <MenuItem icon={ShieldCheck} onSelect={() => void setRole("ADMIN")} disabled={Boolean(u.banned_at)}>
              Yönetici yap
            </MenuItem>
          )}
          <MenuItem icon={Coins} onSelect={() => onModal("credits")}>
            Kredi tanımla
          </MenuItem>
          {!u.email_verified && u.email ? (
            <MenuItem icon={BadgeCheck} onSelect={() => void run(() => adminVerifyEmail({ data: { userId: u.user_id } }), "E-posta doğrulandı olarak işaretlendi.")}>
              E-postayı doğrulanmış say
            </MenuItem>
          ) : null}
          <MenuItem icon={LogOut} onSelect={() => void revoke()}>
            Tüm oturumları kapat
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={Trash2} danger disabled={u.role === "ADMIN"} onSelect={() => void remove()}>
            Hesabı kalıcı olarak sil
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}

function SessionsTab({ detail }: { detail: AdminUserDetail }) {
  const { run, busy } = useRunner();
  if (!detail.sessions.length) return <p className="text-sm text-muted">Açık oturum yok.</p>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {detail.sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
          <KeyRound className="size-4 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{s.ua ? summarizeUa(s.ua) : "Bilinmeyen cihaz"}</p>
            <p className="truncate text-xs text-muted">
              {s.ip ?? "IP yok"} · Açılış {relative(s.created_at)} · Bitiş {dateTime(s.expires_at)}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={busy}
            onClick={() => void run(() => adminRevokeSessions({ data: { userId: detail.user.user_id, sessionId: s.id } }), "Oturum kapatıldı.")}
          >
            Kapat
          </Button>
        </li>
      ))}
    </ul>
  );
}

function summarizeUa(ua: string): string {
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /okhttp|Expo|CFNetwork/i.test(ua) ? "Mobil uygulama" : "Tarayıcı";
  return [browser, os].filter(Boolean).join(" · ");
}

function AdminNote({ user }: { user: AdminUserDetail["user"] }) {
  const { run, busy } = useRunner();
  const [value, setValue] = useState(user.admin_note ?? "");
  const dirty = value !== (user.admin_note ?? "");
  return (
    <section className="rounded-xl border border-warn/30 bg-warn/5 p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-warn">Yönetici notu (yalnızca yöneticiler görür)</h3>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} placeholder="Bu üye hakkında iç not…" className={textareaClass} />
      {dirty ? (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  adminUpdateUser({
                    data: {
                      userId: user.user_id,
                      display_name: user.display_name,
                      phone: user.phone ?? undefined,
                      city: user.city ?? undefined,
                      district: user.district ?? undefined,
                      bio: user.bio ?? undefined,
                      admin_note: value,
                    },
                  }),
                "Not kaydedildi.",
              )
            }
          >
            Notu kaydet
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function EditUserModal({ detail, onClose }: { detail: AdminUserDetail; onClose: () => void }) {
  const u = detail.user;
  const { run, busy } = useRunner();
  const [form, setForm] = useState({
    display_name: u.display_name,
    phone: u.phone ?? "",
    city: u.city ?? "",
    district: u.district ?? "",
    bio: u.bio ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Profil bilgilerini düzenle"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={busy || form.display_name.trim().length < 2}
            onClick={() =>
              void run(() => adminUpdateUser({ data: { userId: u.user_id, ...form, admin_note: u.admin_note ?? undefined } }), "Profil güncellendi.").then((r) => {
                if (r) onClose();
              })
            }
          >
            {busy ? <Spinner /> : null} Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Görünen ad">
          <input value={form.display_name} onChange={set("display_name")} className={inputClass} maxLength={60} />
        </Field>
        <Field label="Cep telefonu" hint="Boş bırakırsanız telefon kaldırılır.">
          <input value={form.phone} onChange={set("phone")} className={inputClass} placeholder="05xx xxx xx xx" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="İl">
            <input value={form.city} onChange={set("city")} className={inputClass} />
          </Field>
          <Field label="İlçe">
            <input value={form.district} onChange={set("district")} className={inputClass} />
          </Field>
        </div>
        <Field label="Hakkında">
          <textarea value={form.bio} onChange={set("bio")} rows={3} maxLength={400} className={textareaClass} />
        </Field>
      </div>
    </Modal>
  );
}

function CreditsModal({ detail, onClose }: { detail: AdminUserDetail; onClose: () => void }) {
  const { run, busy } = useRunner();
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const value = Number.parseInt(amount, 10) || 0;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Doping kredisi tanımla"
      description={`Mevcut bakiye: ${n(detail.credits)} kredi. Eksi değer bakiyeden düşer.`}
      size="sm"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={busy || !value || reason.trim().length < 3}
            onClick={() =>
              void run(() => adminGrantCredits({ data: { userId: detail.user.user_id, amount: value, reason } }), (r) => `Yeni bakiye: ${n(r.balance)} kredi`).then((r) => {
                if (r) onClose();
              })
            }
          >
            {value < 0 ? "Krediyi düş" : "Krediyi ekle"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Miktar">
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ""))} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="Gerekçe" hint="İşlem kaydına ve kredi hareketine yazılır.">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Ör. kampanya hediyesi, hatalı yükleme düzeltmesi" />
        </Field>
      </div>
    </Modal>
  );
}

function NotifyModal({ detail, onClose }: { detail: AdminUserDetail; onClose: () => void }) {
  const { run, busy } = useRunner();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${detail.user.display_name} adlı üyeye bildirim`}
      description="Uygulama içi bildirim olarak düşer; mobil cihazına anlık bildirim de gönderilir."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={busy || title.trim().length < 2 || body.trim().length < 2}
            onClick={() =>
              void run(() => adminNotifyUser({ data: { userId: detail.user.user_id, title, body, link: link || undefined } }), "Bildirim gönderildi.").then((r) => {
                if (r) onClose();
              })
            }
          >
            Gönder
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Başlık">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} />
        </Field>
        <Field label="Mesaj">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} className={textareaClass} />
        </Field>
        <Field label="Bağlantı (isteğe bağlı)" hint="Site içi yol, ör. /ilanlarim">
          <input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="/ilanlarim" />
        </Field>
      </div>
    </Modal>
  );
}
