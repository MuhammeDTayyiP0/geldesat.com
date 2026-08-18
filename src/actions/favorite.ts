"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function toggleFavorite(listingId: string) {
    const session = await auth()

    if (!session?.user || !session.user.id) {
        return { error: "Favorilere eklemek için giriş yapmalısınız.", needsAuth: true }
    }

    try {
        const existingFavorite = await db.favorite.findUnique({
            where: {
                userId_listingId: {
                    userId: session.user.id,
                    listingId
                }
            }
        })

        if (existingFavorite) {
            await db.favorite.delete({
                where: {
                    id: existingFavorite.id
                }
            })
            revalidatePath(`/ilan/${listingId}`)
            revalidatePath("/favorites")
            return { favorite: false }
        } else {
            await db.favorite.create({
                data: {
                    userId: session.user.id,
                    listingId
                }
            })
            revalidatePath(`/ilan/${listingId}`)
            revalidatePath("/favorites")
            return { favorite: true }
        }

    } catch (error) {
        console.error("Favorite toggle error:", error)
        return { error: "Bir hata oluştu." }
    }
}
