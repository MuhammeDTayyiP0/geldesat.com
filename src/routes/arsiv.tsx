import { createFileRoute, Link } from "@tanstack/react-router";

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
        <Link
          to="/"
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-fg hover:opacity-90"
        >
          Anasayfaya dön
        </Link>
        <p className="mt-4 text-xs text-subtle">Sunucu kurulumu ve yapılandırma için proje kök dizinindeki KURULUM.md dosyasına bakın.</p>
      </div>
    </div>
  );
}
