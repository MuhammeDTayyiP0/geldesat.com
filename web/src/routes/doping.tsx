import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useFlag } from "@/lib/use-flag";

export const Route = createFileRoute("/doping")({
  head: () => ({
    meta: [
      { title: "Doping | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Doping,
});

function Doping() {
  const dopingEnabled = useFlag("doping_enabled");
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
        {dopingEnabled ? (
          <>
            <Sparkles className="mx-auto size-8 text-primary" />
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Doping</h1>
            <p className="mt-3 text-sm text-muted">
              Yayındaki ilanlarınızı öne çıkarmak için İlanlarım sayfasından doping seçeneklerini kullanabilirsiniz.
            </p>
            <Link to="/ilanlarim" className={buttonVariants({ className: "mt-6" })}>
              İlanlarıma git
            </Link>
          </>
        ) : (
          <>
            <Ban className="mx-auto size-8 text-subtle" />
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Doping</h1>
            <p className="mt-3 text-sm text-muted">Doping ve kredi satışı şu an kapalı. İlan vermek ücretsizdir.</p>
            <Link to="/ilan-ver" className={buttonVariants({ className: "mt-6" })}>
              Ücretsiz ilan ver
            </Link>
          </>
        )}
      </div>
    </div>
  );
}