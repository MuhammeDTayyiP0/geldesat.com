import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare, ShieldCheck, Zap, Search } from "lucide-react";

export const Route = createFileRoute("/mesajlar/")({
  component: EmptyThread,
});

function EmptyThread() {
  return (
    <div className="grid flex-1 place-items-center bg-bg/50 p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs ring-8 ring-primary/5">
          <MessageSquare className="size-8" />
        </div>
        <h2 className="mt-5 text-lg font-bold tracking-tight text-fg">
          Konuşma Seçin
        </h2>
        <p className="mt-2 text-sm text-muted">
          Gelen kutunuzdaki sohbetleri görüntülemek için sol taraftan bir konuşma seçin veya ilan sayfalarından satıcılara soru sorun.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-fg">
              <ShieldCheck className="size-4 text-ok" />
              <span>Güvenli İletişim</span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Yazışmalarınızı GeldeSat üzerinden yürüterek güvenli alışveriş sağlayın.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-fg">
              <Zap className="size-4 text-primary" />
              <span>Anında Bildirim</span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Mesajlarınız satıcılara anında ulaşır ve okundu onayı görüntülenir.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-fg shadow-sm transition-all hover:bg-primary/90"
          >
            <Search className="size-3.5" /> İlanlara Göz Atın
          </Link>
        </div>
      </div>
    </div>
  );
}
