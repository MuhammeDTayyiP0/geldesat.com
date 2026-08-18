"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { generatePasswordResetToken } from "@/lib/tokens"
import { sendPasswordResetEmail } from "@/lib/mail"

const ResetSchema = z.object({
    email: z.string().email({
        message: "Geçerli bir email adresi giriniz"
    })
})

export const reset = async (values: z.infer<typeof ResetSchema>) => {
    const validatedFields = ResetSchema.safeParse(values)

    if (!validatedFields.success) {
        return { error: "Geçersiz email adresi!" }
    }

    const { email } = validatedFields.data

    const existingUser = await db.user.findUnique({
        where: { email }
    })

    if (!existingUser) {
        return { error: "Email bulunamadı!" }
    }

    const passwordResetToken = await generatePasswordResetToken(email)
    await sendPasswordResetEmail(passwordResetToken.email, passwordResetToken.token)

    return { success: "Sıfırlama linki gönderildi!" }
}
