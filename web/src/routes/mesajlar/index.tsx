import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/mesajlar/")({
  component: EmptyThread,
});

/** Desktop right pane when no chat is open (phones show the list full-screen instead). */
function EmptyThread() {
  return (
    <div className="grid flex-1 place-items-center bg-bg/50 p-8 text-center">
      <div className="max-w-xs">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <MessageSquare className="size-7" />
        </span>
        <h2 className="mt-4 text-base font-semibold">Bir sohbet seçin</h2>
        <p className="mt-1.5 text-sm text-muted">Mesajlarınızı görmek için soldan bir sohbet açın.</p>
      </div>
    </div>
  );
}
