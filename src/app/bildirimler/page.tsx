import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getNotifications } from "@/actions/notification"
import { NotificationsList } from "./NotificationsList"

export const metadata = {
    title: "Bildirimler | GeldeSat",
    description: "GeldeSat üzerindeki tüm bildirimlerinizi görüntüleyin."
}

export default async function BildirimlerPage() {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/auth/login?callbackUrl=/bildirimler")
    }

    const { notifications, unreadCount } = await getNotifications()

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl min-h-screen">
            <NotificationsList 
                initialNotifications={JSON.parse(JSON.stringify(notifications))}
                unreadCount={unreadCount}
            />
        </div>
    )
}
