import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Megaphone, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminAudienceSizes, adminBroadcast, adminListAudit } from "@/lib/server/admin/content";
import { useRunner } from "@/components/admin/hooks";
import { dateTime, n, relative } from "@/components/admin/format";
import { Card, CardHead, EmptyState, Field, inputClass, PageHeader, Spinner, textareaClass, useConfirm } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/duyurular")({
  component: BroadcastPage,
});

type Audience = "all" | "active_30d" | "sellers" | "stores" | "admins";

function BroadcastPage() {
  const sizes = useQuery({ queryKey: ["admin", "audiences"], queryFn: () => adminAudienceSizes(), staleTime: 60_000 });
  const history = useQuery({ queryKey: ["admin", "broadcast-history"], queryFn: () => adminListAudit({ data: { targetType: "broadcast", page: 1, pageSize: 20 } }) });
  const [audience, setAudience] = useState<Audience>("admins");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [push, setPush] = useState(false);
  const { run, busy } = useRunner();
  const { confirm } = useConfirm();
  const target = sizes.data?.[audience];
  const valid = title.trim().length >= 2 && body.trim().length >= 2 && (!link || link.startsWith("/"));

  async function send() {
    const ok = await confirm({
      title: "Duyuru gönderilsin mi?",
      body: (
        <>
          <strong>{target?.label}</strong> ({n(target?.count ?? 0)} üye) bildirim alacak
          {push ? ` ve ${n(target?.devices ?? 0)} mobil cihaza anlık bildirim gidecek` : ""}. Gönderilen bildirim geri alınamaz.
        </>
      ),
      confirmLabel: "Gönder",
      danger: audience === "all",
    });
    if (!ok) return;
    const r = await run(
      () => adminBroadcast({ data: { audience, title: title.trim(), body: body.trim(), link: link || undefined, push } }),
      (res) => `${n(res.recipients)} üyeye gönderildi${push ? `, ${n(res.pushed)} cihaza iletildi` : ""}.`,
    );
    if (r) {
      setTitle("");
      setBody("");
      setLink("");
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader icon={Megaphone} title="Duyurular" description="Üye gruplarına uygulama içi bildirim ve mobil anlık bildirim gönderin." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHead title="Yeni duyuru" description="Önce yalnızca yöneticilere göndererek deneyebilirsiniz." />
          <div className="space-y-4 p-4">
            <Field label="Alıcılar">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(sizes.data ?? {}) as Audience[]).map((key) => {
                  const a = sizes.data![key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAudience(key)}
                      className={cn("rounded-xl border p-3 text-left transition-colors", audience === key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40")}
                    >
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {n(a.count)} üye · {n(a.devices)} mobil cihaz
                      </p>
                    </button>
                  );
                })}
                {sizes.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Spinner /> Hedef kitleler hesaplanıyor…
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Başlık">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} placeholder="Ör. Yeni özellik: ilanınızı öne çıkarın" />
            </Field>
            <Field label="Mesaj" hint={`${body.length}/1000`}>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={5} className={textareaClass} />
            </Field>
            <Field label="Bağlantı (isteğe bağlı)" hint="Bildirime tıklayınca açılacak site içi sayfa, ör. /ilan-ver" error={link && !link.startsWith("/") ? "Bağlantı / ile başlamalı." : null}>
              <input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="/ilan-ver" />
            </Field>
            <label className="flex items-start gap-2.5 rounded-xl border border-border p-3 text-sm">
              <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="font-semibold">Mobil anlık bildirim de gönder</span>
                <span className="block text-xs text-muted">Uygulaması kurulu {n(target?.devices ?? 0)} cihazın kilit ekranına düşer. Sık kullanmayın; üyeler bildirimleri kapatabilir.</span>
              </span>
            </label>
            <div className="flex justify-end">
              <Button disabled={!valid || busy || !target} onClick={() => void send()}>
                {busy ? <Spinner /> : <Send className="size-4" />} {target ? `${n(target.count)} üyeye gönder` : "Gönder"}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHead title="Önizleme" />
            <div className="space-y-4 p-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  <Bell className="size-3.5" /> Bildirimler sayfası
                </p>
                <div className="flex gap-3 rounded-xl border border-border bg-surface p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Megaphone className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{title || "Duyuru başlığı"}</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted">{body || "Mesaj metni burada görünür."}</p>
                    <p className="mt-1 text-[10px] text-subtle">şimdi</p>
                  </div>
                </div>
              </div>
              {push ? (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                    <Smartphone className="size-3.5" /> Telefon kilit ekranı
                  </p>
                  <div className="rounded-2xl bg-ink/90 p-3 text-white shadow-lg">
                    <p className="text-[10px] uppercase tracking-wide text-white/50">GeldeSat · şimdi</p>
                    <p className="mt-0.5 truncate text-sm font-semibold">{title || "Duyuru başlığı"}</p>
                    <p className="line-clamp-2 text-xs text-white/80">{body || "Mesaj metni"}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHead title="Gönderim geçmişi" />
            {history.data?.rows.length ? (
              <ul className="divide-y divide-border">
                {history.data.rows.map((h) => {
                  const meta = parseMeta(h.meta);
                  return (
                    <li key={h.id} className="px-4 py-3">
                      <p className="text-sm font-medium">{String(meta.title ?? h.summary)}</p>
                      {meta.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{String(meta.body)}</p> : null}
                      <p className="mt-0.5 text-xs text-muted" title={dateTime(h.created_at)}>
                        {n(Number(meta.recipients ?? 0))} üye{Number(meta.pushed ?? 0) ? ` · ${n(Number(meta.pushed))} cihaz` : ""} · {h.admin_name} · {relative(h.created_at)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : history.isLoading ? (
              <div className="p-4 text-sm text-muted">Yükleniyor…</div>
            ) : (
              <EmptyState title="Henüz duyuru gönderilmedi" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function parseMeta(text: string | null): Record<string, unknown> {
  try {
    const v = text ? JSON.parse(text) : null;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
