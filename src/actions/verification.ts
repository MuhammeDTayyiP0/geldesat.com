"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { generateVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/mail"

export const resendVerificationEmail = async () => {
    const session = await auth()

    if (!session?.user?.email) {
        return { error: "Giriş yapmalısınız!" }
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email }
    })

    if (!user) {
        return { error: "Kullanıcı bulunamadı!" }
    }

    if (user.emailVerified) {
        return { error: "E-postanız zaten doğrulanmış!" }
    }

    const verificationToken = await generateVerificationToken(user.email)
    await sendVerificationEmail(verificationToken.email, verificationToken.token)

    return { success: "Doğrulama e-postası tekrar gönderildi." }
}
