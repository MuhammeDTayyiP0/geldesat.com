import { createFileRoute, notFound, Outlet, useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isAdminSession } from "@/lib/server/account";
import { AdminShell } from "@/components/admin/AdminShell";
import { resetAdminSessionCache, shouldUseAdminSessionCache, markAdminSessionConfirmed } from "@/lib/admin-session-cache";

export { resetAdminSessionCache };

export const Route = createFileRoute("/admin")({
  // Non-admins (including signed-out visitors) get a plain 404 so the console's existence isn't revealed.
  beforeLoad: async () => {
    if (typeof window !== "undefined" && shouldUseAdminSessionCache()) return;
    if (!(await isAdminSession())) {
      resetAdminSessionCache();
      throw notFound();
    }
    if (typeof window !== "undefined") markAdminSessionConfirmed();
  },
  head: () => ({
    meta: [
      { title: "Yönetim Konsolu | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  errorComponent: AdminErrorBoundary,
  component: AdminLayout,
});

function AdminErrorBoundary({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  return (
    <AdminShell>
      <div className="mx-auto my-12 max-w-lg rounded-xl border border-danger-text/30 bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-danger-soft text-danger-text">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="text-base font-semibold text-fg">Bu sayfa yüklenemedi</h2>
        <p className="mt-1.5 text-sm text-muted break-words">{message}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-solid px-4 text-sm font-medium text-white hover:opacity-90"
          >
            <RefreshCw className="size-4" />
            Yeniden dene
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
