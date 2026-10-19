import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { isAdminSession } from "@/lib/server/account";
import { AdminShell } from "@/components/admin/AdminShell";

/** Once the client has seen an admin session, child navigations skip the round trip; every server call still checks. */
let confirmedOnClient = false;

export const Route = createFileRoute("/admin")({
  // Non-admins (including signed-out visitors) get a plain 404 so the console's existence isn't revealed.
  beforeLoad: async () => {
    if (typeof window !== "undefined" && confirmedOnClient) return;
    if (!(await isAdminSession())) throw notFound();
    if (typeof window !== "undefined") confirmedOnClient = true;
  },
  head: () => ({
    meta: [
      { title: "Yönetim Konsolu | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
