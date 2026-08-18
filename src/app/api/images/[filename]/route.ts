
import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(request: NextRequest, props: { params: Promise<{ filename: string }> }) {
    const params = await props.params;
    const { filename } = params

    // Security: prevent directory traversal
    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return new NextResponse("Invalid filename", { status: 400 })
    }

    const filePath = path.join(process.cwd(), "public", "uploads", filename)

    try {
        if (!fs.existsSync(filePath)) {
            return new NextResponse("File not found", { status: 404 })
        }

        const fileBuffer = fs.readFileSync(filePath)

        // Determine content type
        let contentType = "application/octet-stream"
        const lowerName = filename.toLowerCase()
        if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) contentType = "image/jpeg"
        else if (lowerName.endsWith(".png")) contentType = "image/png"
        else if (lowerName.endsWith(".webp")) contentType = "image/webp"
        else if (lowerName.endsWith(".gif")) contentType = "image/gif"
        else if (lowerName.endsWith(".svg")) contentType = "image/svg+xml"

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        })
    } catch (error) {
        console.error("Image serve error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
