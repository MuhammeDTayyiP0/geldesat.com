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
                    // Seller might be replying? But initially creating:
                    // If CURRENT USER is SELLER, they can't start a convo with themselves usually, 
                    // unless they are replying to an existing one. 
                    // For now assume Buyer starts conversation.
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

        await db.message.create({
            data: {
                content,
                conversationId: conversation.id,
                senderId: session.user.id,
                receiverId,
            }
        })

        revalidatePath(`/messages`)
        revalidatePath(`/ilan/${listingId}`)
        return { success: true, conversationId: conversation.id }

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

    if (!content.trim()) {
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

        // Determine receiver
        const receiverId = conversation.buyerId === session.user.id ? conversation.sellerId : conversation.buyerId

        await db.message.create({
            data: {
                content,
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
        return { success: true }

    } catch (error) {
        console.error("Send message error:", error)
        return { error: "Mesaj gönderilemedi." }
    }
}

export async function getNewMessages(conversationId: string, lastMessageId?: string) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" }
    }

    try {
        let afterDate = new Date(0);
        if (lastMessageId) {
            const lastMsg = await db.message.findUnique({ where: { id: lastMessageId } });
            if (lastMsg) afterDate = lastMsg.createdAt;
        }

        const newMessages = await db.message.findMany({
            where: {
                conversationId,
                createdAt: { gt: afterDate },
                senderId: { not: session.user.id } // Only fetch messages from OTHERS
            },
            orderBy: {
                createdAt: 'asc'
            }
        })

        // Mark received messages as read
        if (newMessages.length > 0) {
            await db.message.updateMany({
                where: {
                    id: { in: newMessages.map(m => m.id) },
                    receiverId: session.user.id
                },
                data: { read: true }
            })
        }

        // Fetch IDs of MY messages that were read by the other person
        // We want messages I sent, that are read, and probably recently read 
        // (or we can just return all read ones to be safe/simple for now since we map over client state)
        // Optimization: better to query only those that client thinks are unread, but simpler for now:
        const myReadMessages = await db.message.findMany({
            where: {
                conversationId,
                senderId: session.user.id,
                read: true
            },
            select: { id: true }
        })

        return {
            success: true,
            messages: newMessages,
            readMessageIds: myReadMessages.map(m => m.id)
        }
    } catch (error) {
        return { success: false, error: "Failed to fetch" }
    }
}
