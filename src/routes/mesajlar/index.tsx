import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/mesajlar/")({
  component: EmptyThread,
});

function EmptyThread() {
  return (
    <div className="grid flex-1 place-items-center bg-bg p-8 text-center">
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-elevated">
          <MessageCircle className="size-6 text-muted" />
        </div>
        <p className="mt-4 text-sm font-semibold">Bir konuşma seçin</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          İlan sayfasından satıcıya yazınca sohbet burada açılır. Gelen kutusu solda durur.
        </p>
      </div>
    </div>
  );
}
