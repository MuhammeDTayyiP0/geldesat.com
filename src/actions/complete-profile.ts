"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/auth"

const PhoneSchema = z.object({
    phoneNumber: z.string().min(10, {
        message: "Geçerli bir telefon numarası giriniz (Örn: 555 123 4567)"
    }).regex(/^[0-9+\s()-]+$/, {
        message: "Sadece rakam girebilirsiniz"
    })
})

export const completeProfile = async (values: z.infer<typeof PhoneSchema>) => {
    const session = await auth()

    if (!session || !session.user) {
        return { error: "Oturum bulunamadı!" }
    }

    const validatedFields = PhoneSchema.safeParse(values)

    if (!validatedFields.success) {
        return { error: "Geçersiz telefon numarası!" }
    }

    const { phoneNumber } = validatedFields.data

    // Check if phone number is already taken
    const existingUser = await db.user.findFirst({
        where: { phoneNumber }
    })

    if (existingUser && existingUser.id !== session.user.id) {
        return { error: "Bu telefon numarası başka bir hesap tarafından kullanılıyor!" }
    }

    try {
        await db.user.update({
            where: { id: session.user.id },
            data: { phoneNumber }
        })

        return { success: "Profil güncellendi!", phoneNumber } // Return phone to update session client-side if needed
    } catch {
        return { error: "Bir hata oluştu!" }
    }
}
