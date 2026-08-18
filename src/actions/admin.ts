"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { ListingStatus, UserRole } from "@prisma/client"

export async function updateUserRole(userId: string, newRole: UserRole) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) {
        return { error: "Yetkisiz işlem!" }
    }

    try {
        await db.user.update({
            where: { id: userId },
            data: { role: newRole }
        })

        revalidatePath("/admin/users")
        return { success: "Kullanıcı rolü güncellendi." }
    } catch (error) {
        return { error: "İşlem başarısız." }
    }
}

export async function deleteUser(userId: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) {
        return { error: "Yetkisiz işlem!" }
    }

    try {
        await db.user.delete({
            where: { id: userId }
        })

        revalidatePath("/admin/users")
        return { success: "Kullanıcı silindi." }
    } catch (error) {
        return { error: "Kullanıcı silinemedi." }
    }
}

async function checkAdmin() {
    const session = await auth()
    if (!session?.user?.email) return false

    const user = await db.user.findUnique({
        where: { email: session.user.email }
    })

    return user?.role === "ADMIN"
}

export async function deleteListing(listingId: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return { error: "Yetkisiz işlem." }

    try {
        await db.listing.delete({
            where: { id: listingId }
        })
        revalidatePath("/admin/listings")
        return { success: true }
    } catch (error) {
        console.error("Delete error:", error)
        return { error: "Silme işlemi başarısız." }
    }
}

export async function updateListingStatus(listingId: string, status: ListingStatus) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return { error: "Yetkisiz işlem." }

    try {
        await db.listing.update({
            where: { id: listingId },
            data: { status }
        })
        revalidatePath("/admin/listings")
        return { success: true }
    } catch (error) {
        console.error("Update status error:", error)
        return { error: "Durum güncelleme başarısız." }
    }
}

export async function getSuggestions() {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return []

    return await db.categorySuggestion.findMany({
        where: { status: "PENDING" },
        include: { user: true, parent: true },
        orderBy: { createdAt: "desc" }
    })
}

export async function approveSuggestion(suggestionId: string, slug: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return { error: "Yetkisiz" }

    try {
        const suggestion = await db.categorySuggestion.findUnique({ where: { id: suggestionId } })
        if (!suggestion) return { error: "Bulunamadı" }

        // 1. Create real category
        await db.category.create({
            data: {
                name: suggestion.categoryName,
                slug: slug,
                parentId: suggestion.parentId
            }
        })

        // 2. Update suggestion status
        await db.categorySuggestion.update({
            where: { id: suggestionId },
            data: { status: "APPROVED" }
        })

        revalidatePath("/admin/suggestions")
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Oluşturulamadı (Slug çakışması olabilir)" }
    }
}

export async function rejectSuggestion(suggestionId: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return { error: "Yetkisiz" }

    await db.categorySuggestion.update({
        where: { id: suggestionId },
        data: { status: "REJECTED" }
    })

    revalidatePath("/admin/suggestions")
    return { success: true }
}
