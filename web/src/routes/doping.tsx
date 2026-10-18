import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
        <Ban className="mx-auto size-8 text-subtle" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Doping</h1>
        <p className="mt-3 text-sm text-muted">Doping ve kredi satışı şu an kapalı. İlan vermek ücretsizdir.</p>
        <Link to="/ilan-ver" className="mt-6 inline-block">
          <Button>Ücretsiz ilan ver</Button>
        </Link>
      </div>
    </div>
  );
}