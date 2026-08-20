
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { ConversationList, SerializedConversation } from "@/components/message/ConversationList"

export const metadata = {
    title: "Mesajlarım | GeldeSat",
    description: "GeldeSat üzerindeki tüm mesajlaşmalarınızı görüntüleyin ve yönetin."
}

export default async function MessagesPage() {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/auth/login?callbackUrl=/messages")
    }
    const currentUserId = session.user.id

    const rawConversations = await db.conversation.findMany({
        where: {
            OR: [
                { buyerId: currentUserId },
                { sellerId: currentUserId }
            ]
        },
        include: {
            listing: {
                select: {
                    id: true,
                    title: true,
                    price: true,
                    currency: true,
                    images: true
                }
            },
            buyer: {
                select: {
                    id: true,
                    name: true,
                    image: true
                }
            },
            seller: {
                select: {
                    id: true,
                    name: true,
                    image: true
                }
            },
            messages: {
                orderBy: {
                    createdAt: 'desc'
                },
                take: 1
            },
            _count: {
                select: {
                    messages: {
                        where: {
                            receiverId: currentUserId,
                            read: false
                        }
                    }
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    })

    const serializedConversations: SerializedConversation[] = rawConversations.map(conv => ({
        id: conv.id,
        listingId: conv.listingId,
        listing: {
            ...conv.listing,
            price: Number(conv.listing.price)
        },
        buyerId: conv.buyerId,
        buyer: conv.buyer,
        sellerId: conv.sellerId,
        seller: conv.seller,
        updatedAt: conv.updatedAt,
        messages: conv.messages,
        unreadCount: conv._count.messages
    }))

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl min-h-screen">
            <ConversationList
                initialConversations={serializedConversations}
                currentUserId={currentUserId}
            />
        </div>
    )
}
