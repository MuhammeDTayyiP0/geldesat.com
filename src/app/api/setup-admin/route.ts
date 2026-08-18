
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 })
    }

    try {
        await db.user.update({
            where: { email: session.user.email },
            data: { role: "ADMIN" }
        })
        return NextResponse.json({ success: true, message: `User ${session.user.email} is now ADMIN` })
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 })
    }
}
