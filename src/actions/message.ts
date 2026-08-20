"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const MessageSchema = z.object({
    content: z.string().min(1, "Mesaj boş olamaz."),
    listingId: z.string(),
    receiverId: z.string(),
})

export async function createConversation(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Mesaj göndermek için giriş yapmalısınız." }
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user?.emailVerified) {
        return { error: "Mesaj göndermek için lütfen e-posta adresinizi doğrulayın." }
    }

    const content = formData.get("content") as string
    const listingId = formData.get("listingId") as string
    const receiverId = formData.get("receiverId") as string

    const validatedFields = MessageSchema.safeParse({
        content,
        listingId,
        receiverId
    })

    if (!validatedFields.success) {
        return { error: validatedFields.error.flatten().fieldErrors.content?.[0] || "Geçersiz veri." }
    }

    try {
        // Check if conversation already exists
        let conversation = await db.conversation.findFirst({
            where: {
                listingId,
                OR: [
                    { buyerId: session.user.id, sellerId: receiverId },
                    { buyerId: receiverId, sellerId: session.user.id }
                ]
            }
        })

        if (!conversation) {
            conversation = await db.conversation.create({
                data: {
                    listingId,
                    buyerId: session.user.id,
                    sellerId: receiverId,
                }
            })
        }

        const newMessage = await db.message.create({
            data: {
                content: content.trim(),
                conversationId: conversation.id,
                senderId: session.user.id,
                receiverId,
            }
        })

        await db.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() }
        })

        revalidatePath(`/messages`)
        revalidatePath(`/messages/${conversation.id}`)
        revalidatePath(`/ilan/${listingId}`)
        return { success: true, conversationId: conversation.id, message: newMessage }

    } catch (error) {
        console.error("Message error:", error)
        return { error: "Mesaj gönderilemedi." }
    }
}

export async function sendMessage(conversationId: string, content: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Giriş yapmalısınız." }
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user?.emailVerified) {
        return { error: "Mesaj göndermek için lütfen e-posta adresinizi doğrulayın." }
    }

    const trimmedContent = content.trim()
    if (!trimmedContent) {
        return { error: "Mesaj boş olamaz." }
    }

    try {
        const conversation = await db.conversation.findUnique({
            where: { id: conversationId },
            include: { buyer: true, seller: true }
        })

        if (!conversation) {
            return { error: "Konuşma bulunamadı." }
        }

        if (conversation.buyerId !== session.user.id && conversation.sellerId !== session.user.id) {
            return { error: "Yetkisiz işlem." }
        }

        // Determine receiver
        const receiverId = conversation.buyerId === session.user.id ? conversation.sellerId : conversation.buyerId

        const newMessage = await db.message.create({
            data: {
                content: trimmedContent,
                conversationId,
                senderId: session.user.id,
                receiverId,
            }
        })

        await db.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        })

        revalidatePath(`/messages/${conversationId}`)
        revalidatePath(`/messages`)
        return { success: true, message: newMessage }

    } catch (error) {
        console.error("Send message error:", error)
        return { error: "Mesaj gönderilemedi." }
    }
}

export async function markMessagesAsRead(conversationId: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await db.message.updateMany({
            where: {
                conversationId,
                receiverId: session.user.id,
                read: false
            },
            data: { read: true }
        })

        return { success: true }
    } catch (error) {
        console.error("markMessagesAsRead error:", error)
        return { success: false, error: "Failed to mark as read" }
    }
}

export async function getNewMessages(conversationId: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized", messages: [] }
    }

    try {
        // Automatically mark any incoming unread messages in this chat as read
        await db.message.updateMany({
            where: {
                conversationId,
                receiverId: session.user.id,
                read: false
            },
            data: { read: true }
        })

        const messages = await db.message.findMany({
            where: { conversationId },
            orderBy: {
                createdAt: 'asc'
            }
        })

        return {
            success: true,
            messages
        }
    } catch (error) {
        console.error("getNewMessages error:", error)
        return { success: false, error: "Failed to fetch", messages: [] }
    }
}

export async function getConversations() {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized", conversations: [] }
    }

    try {
        const rawConversations = await db.conversation.findMany({
            where: {
                OR: [
                    { buyerId: session.user.id },
                    { sellerId: session.user.id }
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
                                receiverId: session.user.id,
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

        const conversations = rawConversations.map(conv => ({
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

        return {
            success: true,
            conversations
        }
    } catch (error) {
        console.error("getConversations error:", error)
        return { success: false, error: "Failed to fetch conversations", conversations: [] }
    }
}
