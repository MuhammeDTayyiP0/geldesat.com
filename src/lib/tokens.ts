
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

export const generatePasswordResetToken = async (email: string) => {
    const token = randomUUID()
    // Token expires in 1 hour
    const expires = new Date(new Date().getTime() + 3600 * 1000)

    const existingToken = await db.passwordResetToken.findFirst({
        where: { email }
    })

    if (existingToken) {
        await db.passwordResetToken.delete({
            where: { id: existingToken.id }
        })
    }

    const passwordResetToken = await db.passwordResetToken.create({
        data: {
            email,
            token,
            expires
        }
    })

    return passwordResetToken
}

export const getPasswordResetTokenByToken = async (token: string) => {
    try {
        const passwordResetToken = await db.passwordResetToken.findUnique({
            where: { token }
        })
        return passwordResetToken
    } catch {
        return null
    }
}


export const getPasswordResetTokenByEmail = async (email: string) => {
    try {
        const passwordResetToken = await db.passwordResetToken.findFirst({
            where: { email }
        })
        return passwordResetToken
    } catch {
        return null
    }
}

export const getVerificationTokenByToken = async (token: string) => {
    try {
        const verificationToken = await db.verificationToken.findUnique({
            where: { token }
        })
        return verificationToken
    } catch {
        return null
    }
}

export const getVerificationTokenByEmail = async (email: string) => {
    try {
        const verificationToken = await db.verificationToken.findFirst({
            where: { email }
        })
        return verificationToken
    } catch {
        return null
    }
}

export const generateVerificationToken = async (email: string) => {
    const token = randomUUID()
    // Token expires in 1 hour
    const expires = new Date(new Date().getTime() + 3600 * 1000)

    const existingToken = await getVerificationTokenByEmail(email)

    if (existingToken) {
        await db.verificationToken.delete({
            where: { id: existingToken.id }
        })
    }

    const verificationToken = await db.verificationToken.create({
        data: {
            email,
            token,
            expires
        }
    })

    return verificationToken
}
