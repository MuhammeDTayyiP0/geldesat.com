"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"

export type NotificationItem = {
    id: string
    type: "message" | "favorite" | "listing_approved" | "listing_rejected" | "system"
    title: string
    description: string
    link: string
    read: boolean
    createdAt: Date
    senderName?: string
    senderImage?: string
    listingTitle?: string
    listingImage?: string
}

export async function getUnreadMessageCount() {
    const session = await auth()
    if (!session?.user?.id) {
        return 0
    }

    try {
        const count = await db.message.count({
            where: {
                receiverId: session.user.id,
                read: false,
            }
        })
        return count
    } catch (error) {
        console.error("getUnreadMessageCount error:", error)
        return 0
    }
}

export async function getNotifications(): Promise<{ notifications: NotificationItem[], unreadCount: number }> {
    const session = await auth()
    if (!session?.user?.id) {
        return { notifications: [], unreadCount: 0 }
    }

    try {
        // Get recent messages grouped by conversation (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const recentMessages = await db.message.findMany({
            where: {
                receiverId: session.user.id,
                createdAt: { gte: thirtyDaysAgo }
            },
            include: {
                sender: {
                    select: { id: true, name: true, image: true }
                },
                conversation: {
                    include: {
                        listing: {
                            select: { id: true, title: true, images: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        })

        // Get recent favorites on user's listings
        const recentFavorites = await db.favorite.findMany({
            where: {
                listing: {
                    userId: session.user.id
                },
                createdAt: { gte: thirtyDaysAgo }
            },
            include: {
                user: {
                    select: { id: true, name: true, image: true }
                },
                listing: {
                    select: { id: true, title: true, images: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        })

        const notifications: NotificationItem[] = []

        // Convert messages to notifications
        for (const msg of recentMessages) {
            notifications.push({
                id: `msg-${msg.id}`,
                type: "message",
                title: `${msg.sender.name || "Bir kullanıcı"} mesaj gönderdi`,
                description: msg.content.length > 80 ? msg.content.substring(0, 80) + "..." : msg.content,
                link: `/messages/${msg.conversationId}`,
                read: msg.read,
                createdAt: msg.createdAt,
                senderName: msg.sender.name || undefined,
                senderImage: msg.sender.image || undefined,
                listingTitle: msg.conversation.listing.title,
                listingImage: msg.conversation.listing.images?.[0] || undefined
            })
        }

        // Convert favorites to notifications
        for (const fav of recentFavorites) {
            notifications.push({
                id: `fav-${fav.id}`,
                type: "favorite",
                title: `${fav.user.name || "Bir kullanıcı"} ilanınızı favorilere ekledi`,
                description: fav.listing.title,
                link: `/ilan/${fav.listing.id}`,
                read: true, // Favorites don't have read status, treat as read
                createdAt: fav.createdAt,
                senderName: fav.user.name || undefined,
                senderImage: fav.user.image || undefined,
                listingTitle: fav.listing.title,
                listingImage: fav.listing.images?.[0] || undefined
            })
        }

        // Sort by date
        notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        const unreadCount = notifications.filter(n => !n.read).length

        return { notifications, unreadCount }
    } catch (error) {
        console.error("getNotifications error:", error)
        return { notifications: [], unreadCount: 0 }
    }
}
