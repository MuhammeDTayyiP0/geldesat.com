"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getPasswordResetTokenByToken } from "@/lib/tokens"

const NewPasswordSchema = z.object({
    password: z.string().min(6, {
        message: "En az 6 karakter olmalı",
    }),
})

export const newPassword = async (values: z.infer<typeof NewPasswordSchema>, token?: string | null) => {
    if (!token) {
        return { error: "Token eksik!" }
    }

    const validatedFields = NewPasswordSchema.safeParse(values)

    if (!validatedFields.success) {
        return { error: "Geçersiz giriş!" }
    }

    const { password } = validatedFields.data

    const existingToken = await getPasswordResetTokenByToken(token)

    if (!existingToken) {
        return { error: "Geçersiz veya süresi dolmuş token!" }
    }

    const hasExpired = new Date(existingToken.expires) < new Date()

    if (hasExpired) {
        return { error: "Token süresi dolmuş!" }
    }

    const existingUser = await db.user.findFirst({
        where: { email: existingToken.email }
    })

    if (!existingUser) {
        return { error: "Email mevcuttut değil!" }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.user.update({
        where: { id: existingUser.id },
        data: {
            password: hashedPassword
        }
    })

    await db.passwordResetToken.delete({
        where: { id: existingToken.id }
    })

    return { success: "Şifre başarıyla güncellendi!" }
}
