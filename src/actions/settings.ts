"use server"

import * as z from "zod"
import { db } from "@/lib/db"
import { auth } from "@/auth"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

const PasswordSchema = z.object({
    currentPassword: z.string().min(1, "Mevcut şifre gereklidir"),
    newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalıdır"),
    confirmPassword: z.string().min(1, "Şifre tekrarı gereklidir"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
})

const PhoneSchema = z.object({
    phoneNumber: z.string().min(10, "Geçerli bir telefon numarası giriniz").regex(/^[0-9+\s()-]+$/, "Sadece rakam girebilirsiniz")
})

export const updatePassword = async (values: z.infer<typeof PasswordSchema>) => {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Yetkisiz erişim" }
    }

    const validatedFields = PasswordSchema.safeParse(values)
    if (!validatedFields.success) {
        return { error: "Geçersiz veriler" }
    }

    const { currentPassword, newPassword } = validatedFields.data

    const user = await db.user.findUnique({
        where: { id: session.user.id }
    })

    if (!user || !user.password) {
        return { error: "Kullanıcı bulunamadı veya şifre ayarlanmamış" }
    }

    const passwordsMatch = await bcrypt.compare(currentPassword, user.password)

    if (!passwordsMatch) {
        return { error: "Mevcut şifre yanlış" }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await db.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword }
    })

    return { success: "Şifre başarıyla güncellendi" }
}

export const updatePhoneNumber = async (values: z.infer<typeof PhoneSchema>) => {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Yetkisiz erişim" }
    }

    const validatedFields = PhoneSchema.safeParse(values)
    if (!validatedFields.success) {
        return { error: "Geçersiz telefon numarası" }
    }

    const { phoneNumber } = validatedFields.data

    try {
        await db.user.update({
            where: { id: session.user.id },
            data: { phoneNumber }
        })

        revalidatePath("/profile")
        return { success: "Telefon numarası güncellendi" }
    } catch (error) {
        return { error: "Bu telefon numarası başka bir hesapta kullanılıyor olabilir" }
    }
}
