import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, slugify } from "@/lib/utils";
import { adminDeletePage, adminListPages, adminSavePage } from "@/lib/server/admin/content";
import { useRunner } from "@/components/admin/hooks";
import { n } from "@/components/admin/format";
import { str } from "@/components/admin/search";
import { Card, EmptyState, ErrorState, Field, inputClass, PageHeader, Pill, Spinner, textareaClass, useConfirm } from "@/components/admin/ui";

/** Pages linked from the footer and sign-up forms; renaming or deleting them breaks those links. */
const LINKED = new Set(["hakkimizda", "iletisim", "kvkk", "gizlilik", "cerez", "kullanim", "uyelik"]);

type Search = { slug?: string };

export const Route = createFileRoute("/admin/sayfalar")({
  validateSearch: (s: Record<string, unknown>): Search => ({ slug: str(s.slug, 80) }),
  component: PagesPage,
});

function PagesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const q = useQuery({ queryKey: ["admin", "pages"], queryFn: () => adminListPages() });
  const pages = q.data ?? [];
  const selected = search.slug === "__new" ? null : (pages.find((p) => p.slug === search.slug) ?? (search.slug ? null : pages[0] ?? null));
  const isNew = search.slug === "__new";
  const select = (slug: string | undefined) => void navigate({ search: { slug }, replace: true });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        icon={FileText}
        title="Kurumsal sayfalar"
        description="Hakkımızda, KVKK, sözleşmeler gibi /sayfa/… adresindeki metinler. ## ile başlık, - ile madde işareti kullanın."
        actions={
          <Button size="sm" onClick={() => select("__new")}>
            <Plus className="size-4" /> Yeni sayfa
          </Button>
        }
      />
      {q.error ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </Card>
      ) : q.isLoading ? (
        <Card className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
          <Spinner /> Yükleniyor…
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit overflow-hidden">
            <ul className="divide-y divide-border">
              {pages.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    onClick={() => select(p.slug)}
                    className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-left", selected?.slug === p.slug && !isNew ? "bg-primary/8" : "hover:bg-elevated/60")}
                  >
                    <FileText className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", selected?.slug === p.slug && !isNew ? "font-semibold text-primary" : "font-medium")}>{p.title}</span>
                      <span className="block truncate text-[11px] text-muted">
                        /sayfa/{p.slug} · {n(p.length)} karakter
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {isNew ? (
            <Editor key="__new" page={null} onSaved={(slug) => select(slug)} />
          ) : selected ? (
            <Editor key={selected.slug} page={selected} onSaved={(slug) => select(slug)} onDeleted={() => select(undefined)} />
          ) : (
            <Card>
              <EmptyState icon={FileText} title="Sayfa seçin" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ page, onSaved, onDeleted }: { page: { slug: string; title: string; body: string } | null; onSaved: (slug: string) => void; onDeleted?: () => void }) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [preview, setPreview] = useState(false);
  const { run, busy } = useRunner();
  const { confirm } = useConfirm();
  const dirty = !page || title !== page.title || slug !== page.slug || body !== page.body;
  const linked = page && LINKED.has(page.slug);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <Card className="flex min-w-0 flex-col">
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
        <Field label="Başlık">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!page) setSlug(slugify(e.target.value));
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Adres" hint={linked ? undefined : "geldesat.com/sayfa/…"} error={linked && slug !== page?.slug ? "Bu sayfa site altbilgisinden bağlı; adresini değiştirmeyin." : null}>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={cn(inputClass, "font-mono")} />
        </Field>
      </div>
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        <button type="button" onClick={() => setPreview(false)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold", !preview ? "bg-ink text-white" : "text-muted hover:bg-elevated")}>
          <Pencil className="size-3.5" /> Düzenle
        </button>
        <button type="button" onClick={() => setPreview(true)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold", preview ? "bg-ink text-white" : "text-muted hover:bg-elevated")}>
          <Eye className="size-3.5" /> Önizle
        </button>
        {linked ? <Pill tone="primary">Altbilgide bağlı</Pill> : null}
        <span className="ml-auto text-xs text-muted">{n(body.length)} karakter</span>
      </div>
      <div className="min-h-[420px] flex-1 p-4">
        {preview ? (
          <article className="prose-sm max-w-none text-sm leading-relaxed">
            <h1 className="mb-4 text-2xl font-bold">{title}</h1>
            <LegalPreview body={body} />
          </article>
        ) : (
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className={cn(textareaClass, "h-[60vh] min-h-[400px] font-mono text-[13px] leading-relaxed")} spellCheck />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-elevated/30 px-4 py-3">
        {page && !linked ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={busy}
            onClick={() =>
              void confirm({ title: `"${page.title}" silinsin mi?`, body: `/sayfa/${page.slug} adresi 404 verecek.`, confirmLabel: "Sil", danger: true }).then((ok) => {
                if (ok)
                  void run(() => adminDeletePage({ data: { slug: page.slug } }), "Sayfa silindi.").then((r) => {
                    if (r) onDeleted?.();
                  });
              })
            }
          >
            <Trash2 className="size-4" /> Sil
          </Button>
        ) : null}
        {page ? (
          <a href={`/sayfa/${page.slug}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-muted hover:text-fg">
            Sitede gör ↗
          </a>
        ) : null}
        <Button
          size="sm"
          className="ml-auto"
          disabled={!dirty || busy || title.trim().length < 2 || body.trim().length < 10}
          onClick={() =>
            void run(() => adminSavePage({ data: { originalSlug: page?.slug, slug: slug || slugify(title), title: title.trim(), body } }), "Sayfa kaydedildi.").then((r) => {
              if (r) onSaved(r.slug);
            })
          }
        >
          {busy ? <Spinner /> : <Save className="size-4" />} Kaydet
        </Button>
      </div>
    </Card>
  );
}

/** Same light markup the public page understands: ## headings, - bullets, 1. lists, blank-line paragraphs. */
function LegalPreview({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/).filter(Boolean);
  return (
    <>
      {blocks.map((chunk, i) => {
        if (chunk.startsWith("## ")) {
          const [head, ...rest] = chunk.split("\n");
          return (
            <div key={i}>
              <h2 className="mb-2 mt-6 text-lg font-semibold">{head.slice(3)}</h2>
              {rest.length ? <LegalPreview body={rest.join("\n")} /> : null}
            </div>
          );
        }
        const lines = chunk.split("\n");
        if (lines.every((l) => /^[-*]\s/.test(l))) {
          return (
            <ul key={i} className="my-3 list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^[-*]\s/, "")}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="my-3 list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\d+\.\s/, "")}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="my-3 whitespace-pre-line">
            {chunk}
          </p>
        );
      })}
    </>
  );
}
