import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Check, Coins, CreditCard, Download, Plus, TrendingUp, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminCreditLedger, adminListCreditOrders, adminResolveCreditOrder } from "@/lib/server/admin/business";
import { adminGrantCredits, adminListUsers, adminUserDetail } from "@/lib/server/admin/users";
import { useRunner, useSheets } from "@/components/admin/hooks";
import { dateTime, money, n, ORDER_STATUS, relative } from "@/components/admin/format";
import { downloadCsv, int, oneOf, str } from "@/components/admin/search";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InlineQueryError,
  inputClass,
  Modal,
  PageHeader,
  Pagination,
  Pill,
  SearchInput,
  Segmented,
  SkeletonRows,
  StatCard,
  Table,
  TabBar,
  Td,
  Th,
  useConfirm,
} from "@/components/admin/ui";

const STATUSES = ["ALL", "PENDING", "PAID", "REJECTED", "CANCELLED"] as const;
const LEDGER_KINDS = ["all", "in", "out"] as const;
type Search = { tab?: "orders" | "ledger"; status?: (typeof STATUSES)[number]; kind?: (typeof LEDGER_KINDS)[number]; q?: string; page?: number };

export const Route = createFileRoute("/admin/finans")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: oneOf(s.tab, ["orders", "ledger"] as const),
    status: oneOf(s.status, STATUSES),
    kind: oneOf(s.kind, LEDGER_KINDS),
    q: str(s.q),
    page: int(s.page, 1, 100_000),
  }),
  component: FinancePage,
});

function FinancePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Partial<Search>, resetPage = true) =>
    void navigate({ search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }), replace: true });
  const tab = search.tab ?? "orders";
  const [granting, setGranting] = useState(false);
  const ordersQueryParams = {
    status: tab === "orders" ? (search.status ?? "ALL") : ("ALL" as const),
    q: tab === "orders" ? search.q : undefined,
    page: tab === "orders" ? (search.page ?? 1) : 1,
    pageSize: tab === "orders" ? 25 : 5,
  };
  const orders = useQuery({
    queryKey: ["admin", "orders", ordersQueryParams],
    queryFn: () => adminListCreditOrders({ data: ordersQueryParams }),
    placeholderData: keepPreviousData,
  });
  const t = orders.data?.totals;

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        icon={CreditCard}
        title="Ödemeler & kredi"
        description="Havale/EFT ile gelen doping kredisi taleplerini onaylayın; kredi hareketlerini izleyin."
        actions={
          <Button size="sm" onClick={() => setGranting(true)}>
            <Plus className="size-4" /> Kredi tanımla
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Onay bekleyen talep" value={t ? n(t.pending) : "—"} icon={Wallet} tone="warn" onClick={() => set({ tab: undefined, status: "PENDING" })} />
        <StatCard label="Toplam tahsilat" value={t ? money(t.revenue) : "—"} icon={TrendingUp} tone="ok" />
        <StatCard label="Son 30 gün" value={t ? money(t.revenue_30d) : "—"} icon={TrendingUp} tone="primary" />
        <StatCard label="Satılan kredi" value={t ? n(t.credits_sold) : "—"} icon={Coins} tone="violet" />
      </div>

      <Card>
        <TabBar
          value={tab}
          onChange={(v) => set({ tab: v === "orders" ? undefined : v, status: undefined, kind: undefined, q: undefined })}
          items={[
            { value: "orders", label: "Havale talepleri", count: t?.pending },
            { value: "ledger", label: "Kredi hareketleri" },
          ]}
        />
        {tab === "orders" ? <Orders query={orders} search={search} set={set} /> : <Ledger search={search} set={set} />}
      </Card>

      {granting ? <GrantModal onClose={() => setGranting(false)} /> : null}
    </div>
  );
}

function Orders({
  query,
  search,
  set,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof adminListCreditOrders>>>;
  search: Search;
  set: (patch: Partial<Search>, resetPage?: boolean) => void;
}) {
  const { run, busy } = useRunner();
  const { confirm, prompt } = useConfirm();
  const { openUser } = useSheets();
  const rows = query.data?.rows ?? [];
  const lastPage = query.data?.pages;
  const currentPage = search.page ?? 1;
  useEffect(() => {
    if (lastPage && currentPage > lastPage) set({ page: lastPage > 1 ? lastPage : undefined }, false);
  }, [lastPage, currentPage, set]);

  function exportCsv() {
    downloadCsv(
      `havale-talepleri-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Talep ID", "Üye", "E-posta", "Paket", "Kredi", "Tutar", "Durum", "Oluşturulma", "Sonuçlanma"],
      rows.map((o) => [o.id, o.buyer_name, o.buyer_email, o.sku, o.credits, o.price, ORDER_STATUS[o.status]?.label ?? o.status, o.created_at, o.resolved_at]),
    );
  }

  async function resolve(id: string, status: "PAID" | "REJECTED", credits: number, price: number) {
    if (status === "PAID") {
      const ok = await confirm({
        title: "Havale onaylansın mı?",
        body: `Banka hesabına ${money(price)} geldiğini doğruladıysanız onaylayın; üyeye ${credits} kredi yüklenir.`,
        confirmLabel: "Onayla ve krediyi yükle",
      });
      if (ok) await run(() => adminResolveCreditOrder({ data: { id, status } }), "Kredi yüklendi.");
      return;
    }
    const reason = await prompt({
      title: "Talep reddedilsin mi?",
      body: "Üyeye havalenin bulunamadığı veya girilen gerekçeyle reddedildiği bildirilir.",
      label: "Ret gerekçesi (isteğe bağlı)",
      required: false,
      confirmLabel: "Reddet",
      danger: true,
    });
    if (reason == null) return;
    await run(() => adminResolveCreditOrder({ data: { id, status, reason: reason || undefined } }), "Talep reddedildi.");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Segmented
          value={search.status ?? "ALL"}
          onChange={(s) => set({ status: s === "ALL" ? undefined : s })}
          items={STATUSES.map((s) => ({ value: s, label: s === "ALL" ? "Tümü" : ORDER_STATUS[s].label }))}
        />
        <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Üye, e-posta, paket veya talep no" className="ml-auto w-full sm:w-72" />
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="size-4" /> CSV (bu sayfa)
        </Button>
      </div>
      {query.isError && query.data ? <InlineQueryError error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.error && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <SkeletonRows rows={5} />
      ) : !rows.length ? (
        <EmptyState
          icon={Wallet}
          title={search.q || search.status ? "Bu filtreyle eşleşen talep yok" : "Henüz havale talebi yok"}
          description={search.q || search.status ? "Arama veya durum filtresini değiştirerek tekrar deneyin." : "Üyeler havale ile kredi talebi oluşturduğunda burada listelenir."}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Talep</Th>
              <Th>Üye</Th>
              <Th>Paket</Th>
              <Th className="text-right">Tutar</Th>
              <Th>Durum</Th>
              <Th>Tarih</Th>
              <Th className="text-right">İşlem</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "muted" as const };
              return (
                <tr key={o.id} className="hover:bg-elevated/50">
                  <Td className="font-mono text-xs text-muted">{o.id.slice(0, 14)}</Td>
                  <Td>
                    <button type="button" onClick={() => openUser(o.user_id)} className="flex items-center gap-2 text-left hover:text-primary">
                      <Avatar name={o.buyer_name} size={28} />
                      <span>
                        <span className="block text-sm font-medium">{o.buyer_name}</span>
                        <span className="block text-xs text-muted">{o.buyer_email}</span>
                      </span>
                    </button>
                  </Td>
                  <Td className="text-xs">
                    <span className="font-mono">{o.sku}</span>
                    <span className="block font-semibold text-violet">{n(o.credits)} kredi</span>
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">{money(o.price)}</Td>
                  <Td>
                    <Pill tone={st.tone} dot>
                      {st.label}
                    </Pill>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    <span title={dateTime(o.created_at)}>{relative(o.created_at)}</span>
                    {o.resolved_at ? <span className="block text-subtle">işlem {relative(o.resolved_at)}</span> : null}
                  </Td>
                  <Td className="text-right">
                    {o.status === "PENDING" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" className="h-8 bg-ok-solid px-2.5 text-white hover:bg-ok-solid/90" disabled={busy} onClick={() => void resolve(o.id, "PAID", o.credits, o.price)}>
                          <Check className="size-4" /> Onayla
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="Talebi reddet"
                          title="Talebi reddet"
                          className="h-8 px-2.5 text-danger"
                          disabled={busy}
                          onClick={() => void resolve(o.id, "REJECTED", o.credits, o.price)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {query.data && query.data.total > query.data.pageSize ? (
        <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.pageSize} onPage={(page) => set({ page }, false)} />
      ) : null}
    </>
  );
}

function Ledger({ search, set }: { search: Search; set: (patch: Partial<Search>, resetPage?: boolean) => void }) {
  const filter = { kind: search.kind ?? "all", q: search.q, page: search.page ?? 1, pageSize: 30 } as const;
  const q = useQuery({
    queryKey: ["admin", "ledger", filter],
    queryFn: () => adminCreditLedger({ data: filter }),
    placeholderData: keepPreviousData,
  });
  const { openUser } = useSheets();
  const rows = q.data?.rows ?? [];
  const lastPage = q.data?.pages;
  const currentPage = search.page ?? 1;
  useEffect(() => {
    if (lastPage && currentPage > lastPage) set({ page: lastPage > 1 ? lastPage : undefined }, false);
  }, [lastPage, currentPage, set]);

  function exportCsv() {
    downloadCsv(
      `kredi-hareketleri-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Üye", "Üye Kimliği", "Miktar", "Açıklama", "Kayıt", "Tarih"],
      rows.map((r) => [r.user_name, r.user_id, r.amount, describeLedger(r.reason), r.reason, r.created_at.slice(0, 19).replace("T", " ")]),
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Segmented
          value={filter.kind}
          onChange={(kind) => set({ kind: kind === "all" ? undefined : kind })}
          items={[
            { value: "all", label: "Tümü" },
            { value: "in", label: "Yüklemeler (+)" },
            { value: "out", label: "Kullanım / düşüm (-)" },
          ]}
        />
        <SearchInput value={search.q ?? ""} onChange={(v) => set({ q: v || undefined })} placeholder="Üye, e-posta veya açıklama" className="ml-auto w-full sm:w-72" />
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="size-4" /> CSV (bu sayfa)
        </Button>
      </div>
      {q.isError && q.data ? <InlineQueryError error={q.error} onRetry={() => void q.refetch()} /> : null}
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <SkeletonRows rows={6} />
      ) : !rows.length ? (
        <EmptyState icon={Coins} title={search.q || search.kind ? "Bu filtreyle eşleşen hareket yok" : "Kredi hareketi yok"} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Üye</Th>
              <Th className="text-right">Miktar</Th>
              <Th>Açıklama</Th>
              <Th>Tarih</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-elevated/50">
                <Td>
                  <button type="button" onClick={() => openUser(r.user_id)} className="text-sm font-medium hover:text-primary hover:underline">
                    {r.user_name}
                  </button>
                </Td>
                <Td className={r.amount >= 0 ? "text-right font-semibold tabular-nums text-ok" : "text-right font-semibold tabular-nums text-danger"}>
                  {r.amount > 0 ? "+" : ""}
                  {n(r.amount)}
                </Td>
                <Td className="text-xs text-muted">{describeLedger(r.reason)}</Td>
                <Td className="whitespace-nowrap text-xs text-muted">{dateTime(r.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {q.data && q.data.total > q.data.pageSize ? (
        <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} pageSize={q.data.pageSize} onPage={(page) => set({ page }, false)} />
      ) : null}
    </>
  );
}

function describeLedger(reason: string) {
  if (reason.startsWith("order:")) return `Havale onayı (${reason.slice(6, 20)})`;
  if (reason.startsWith("admin:")) return `Yönetici: ${reason.slice(6)}`;
  if (reason.startsWith("boost:")) return `Doping kullanımı`;
  return reason;
}

function GrantModal({ onClose }: { onClose: () => void }) {
  const { user: currentUser } = useCurrentUserState();
  const [q, setQ] = useState("");
  const [user, setUser] = useState<{ user_id: string; display_name: string; email: string | null } | null>(null);
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const { run, busy } = useRunner();
  const { confirm } = useConfirm();
  const users = useQuery({
    queryKey: ["admin", "grant-user-search", q],
    queryFn: () => adminListUsers({ data: { q, role: "ALL", state: "all", sort: "newest", page: 1, pageSize: 8 } }),
    enabled: q.trim().length >= 2 && !user,
  });
  const detail = useQuery({
    queryKey: ["admin", "grant-user-detail", user?.user_id],
    queryFn: () => adminUserDetail({ data: { userId: user!.user_id } }),
    enabled: Boolean(user),
  });
  const trimmedAmount = amount.trim();
  const parsed = /^-?\d+$/.test(trimmedAmount) ? Number(trimmedAmount) : 0;
  const validAmount = Number.isInteger(parsed) && parsed !== 0 && parsed >= -100_000 && parsed <= 100_000;
  const value = validAmount ? parsed : 0;

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Kredi tanımla"
      description="Kampanya, telafi veya düzeltme için üyeye doping kredisi ekleyin ya da düşün."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            disabled={busy || !user || !validAmount || reason.trim().length < 3}
            onClick={() =>
              user &&
              void confirm({
                title: `${value > 0 ? "+" : ""}${value} kredi işlensin mi?`,
                body: `${user.display_name} için ${value > 0 ? "yükleme" : "düşüm"} yapılacak. Gerekçe: ${reason}`,
                confirmLabel: "Kredi işle",
                danger: Math.abs(value) >= 100,
              }).then((ok) => {
                if (!ok) return;
                void run(() => adminGrantCredits({ data: { userId: user.user_id, amount: value, reason } }), (r) => `${user.display_name}: yeni bakiye ${n(r.balance)} kredi`).then((r) => {
                  if (r) onClose();
                });
              })
            }
          >
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <Avatar name={user.display_name} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{user.display_name}</p>
              <p className="text-xs text-muted">
                {user.email} · Mevcut bakiye: <strong className="text-fg">{detail.data ? `${n(detail.data.credits)} kredi` : "…"}</strong>
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setUser(null)}>
              Değiştir
            </Button>
          </div>
        ) : (
          <Field label="Üye">
            <SearchInput value={q} onChange={setQ} placeholder="Ad veya e-posta ile arayın" autoFocus />
            {users.isFetching ? (
              <p className="mt-1.5 text-xs text-muted">Üyeler aranıyor…</p>
            ) : q.trim().length >= 2 && users.data && !users.data.rows.length ? (
              <p className="mt-1.5 text-xs text-muted">Eşleşen üye bulunamadı.</p>
            ) : users.data?.rows.length ? (
              <ul className="mt-1 divide-y divide-border overflow-hidden rounded-lg border border-border">
                {users.data.rows.map((u) => {
                  const isSelf = u.user_id === currentUser?.id;
                  return (
                    <li key={u.user_id}>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => setUser(u)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Avatar name={u.display_name} src={u.avatar_url} size={24} />
                        <span className="flex-1 truncate font-medium">
                          {u.display_name}
                          {isSelf ? " (kendi hesabınız)" : ""}
                        </span>
                        <span className="truncate text-xs text-muted">{u.email}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Field>
        )}
        <Field label="Miktar" hint="Eksi değer bakiyeden düşer." error={trimmedAmount && trimmedAmount !== "-" && !validAmount ? "±100.000 arasında sıfır dışı tam sayı girin." : null}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9-]/g, ""))} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="Gerekçe">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} placeholder="Ör. açılış kampanyası" />
        </Field>
      </div>
    </Modal>
  );
}
