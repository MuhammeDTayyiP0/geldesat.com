"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const ProfileSchema = z.object({
    name: z.string().min(2, "İsim en az 2 karakter olmalıdır."),
    // email is usually not editable freely or requires verification, skipping for now
})

export async function updateProfile(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Giriş yapmalısınız." }
    }

    const name = formData.get("name") as string

    // Simple validation
    const validated = ProfileSchema.safeParse({ name })
    if (!validated.success) {
        return { error: validated.error.flatten().fieldErrors.name?.[0] }
    }

    try {
        await db.user.update({
            where: { id: session.user.id },
            data: { name }
        })

        revalidatePath("/profile")
        return { success: true }
    } catch (error) {
        console.error("Profile update error:", error)
        return { error: "Profil güncellenemedi." }
    }
}
