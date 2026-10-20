import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getStore } from "@/lib/server/account";
import { NotFound } from "@/components/common/NotFound";
import { ProfilePageSkeleton } from "@/components/listing/ListingGridSkeleton";

/**
 * A store is shown on its owner's profile (/satici/$id), so there is one
 * public page per member. Old /magaza/… links (notifications, shares, search
 * engines) keep working through a permanent redirect.
 */
export const Route = createFileRoute("/magaza/$slug")({
  loader: async ({ params }) => {
    const store = await getStore({ data: { slug: params.slug } });
    if (!store) throw notFound();
    throw redirect({ to: "/satici/$id", params: { id: store.user_id }, statusCode: 301 });
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex,follow" }] }),
  pendingComponent: ProfilePageSkeleton,
  notFoundComponent: () => (
    <NotFound type="store" title="Mağaza Bulunamadı" message="Aradığınız kurumsal mağaza bulunamadı veya bağlantı geçersiz." />
  ),
  component: () => null,
});
