
import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import { join } from "path"
import { randomUUID } from "crypto"



export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            return NextResponse.json({ error: "Dosya yüklenmedi" }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const uploadDir = join(process.cwd(), "public", "uploads")

        // Klasör yoksa oluştur
        if (!fs.existsSync(uploadDir)) {
            await fs.promises.mkdir(uploadDir, { recursive: true })
        }

        // Güvenli dosya ismi
        const filename = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
        const filepath = join(uploadDir, filename)

        await fs.promises.writeFile(filepath, buffer)

        const fileUrl = `/api/images/${filename}`

        return NextResponse.json({
            url: fileUrl,
            filename: filename,
            success: true
        })

    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Yükleme hatası" }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json()
        const { filename } = body

        if (!filename) {
            return NextResponse.json({ error: "Dosya ismi gerekli" }, { status: 400 })
        }

        // Security check: prevent directory traversal
        const safeFilename = filename.replace(/[^a-zA-Z0-9.-_]/g, "")
        const filepath = join(process.cwd(), "public", "uploads", safeFilename)

        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath)
            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 })
        }

    } catch (error) {
        console.error("Delete error:", error)
        return NextResponse.json({ error: "Silme hatası" }, { status: 500 })
    }
}
