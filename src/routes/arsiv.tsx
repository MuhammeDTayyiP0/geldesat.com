import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

export const Route = createFileRoute("/arsiv")({ component: Arsiv });

function Arsiv() {
  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-lg place-items-center px-4 py-16">
      <div className="w-full rounded-xl border border-border bg-surface p-8 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">GeldeSat</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Proje arşivi</h1>
        <p className="mt-3 text-sm text-muted">
          Kaynak kod, veritabanı şeması, Docker ve kurulum rehberi. Zip’i indirip kendi sunucuna yükleyebilirsin.
        </p>
        <a
          href="/GeldeSat.zip"
          download="GeldeSat.zip"
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-fg hover:opacity-90"
        >
          <Download className="size-4" />
          GeldeSat.zip indir
        </a>
        <p className="mt-4 text-xs text-subtle">Açtıktan sonra KURULUM.md dosyasına bakın. HTTPS ve e-posta ile üyelik gerekir.</p>
      </div>
    </div>
  );
}
