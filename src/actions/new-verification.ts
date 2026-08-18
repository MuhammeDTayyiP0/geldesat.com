"use server"

import { db } from "@/lib/db"
import { getVerificationTokenByToken } from "@/lib/tokens"


export const newVerification = async (token: string) => {
    const existingToken = await getVerificationTokenByToken(token)

    if (!existingToken) {
        return { error: "Token bulunamadı!" }
    }

    const hasExpired = new Date(existingToken.expires) < new Date()

    if (hasExpired) {
        return { error: "Token süresi dolmuş!" }
    }

    const existingUser = await db.user.findFirst({
        where: { email: existingToken.email }
    })

    if (!existingUser) {
        return { error: "Email adresi bulunamadı!" }
    }

    await db.user.update({
        where: { id: existingUser.id },
        data: {
            emailVerified: new Date(),
            email: existingToken.email // Kullanıcı emailini değiştirirse diye güvenli güncelleme
        }
    })

    await db.verificationToken.delete({
        where: { id: existingToken.id }
    })

    return { success: "E-posta doğrulandı!" }
}
