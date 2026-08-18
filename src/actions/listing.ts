"use server"

import { db } from "@/lib/db"
import { ListingStatus, Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import fs from "fs"
import { join } from "path"
import { randomUUID } from "crypto"

export interface GetListingsParams {
    categorySlug?: string
    minPrice?: number
    maxPrice?: number
    sort?: "price_asc" | "price_desc" | "date_desc" | "date_asc"
    attributes?: Record<string, string | string[]>
    page?: number
    limit?: number
}

// Helper: Kategorinin tüm alt kategori ID'lerini bulur (Recursive)
// Helper: Kategorinin tüm alt kategori ID'lerini bulur (Optimized)
async function getCategorySubtreeIds(categoryId: string): Promise<string[]> {
    // Tüm kategorileri tek seferde çek (id ve parentId yeterli)
    const allCategories = await db.category.findMany({
        select: { id: true, parentId: true }
    })

    // Adjacency list (Parent -> Children) oluştur
    const cleanCategoryId = categoryId
    const childrenMap = new Map<string, string[]>()

    for (const cat of allCategories) {
        if (cat.parentId) {
            const existing = childrenMap.get(cat.parentId) || []
            existing.push(cat.id)
            childrenMap.set(cat.parentId, existing)
        }
    }

    // BFS/DFS ile ağacı gez
    const resultIds = [cleanCategoryId]
    const queue = [cleanCategoryId]

    while (queue.length > 0) {
        const currentId = queue.shift()!
        const children = childrenMap.get(currentId)

        if (children) {
            for (const childId of children) {
                resultIds.push(childId)
                queue.push(childId)
            }
        }
    }

    return resultIds
}

export async function getListings({
    categorySlug,
    minPrice,
    maxPrice,
    sort = "date_desc",
    attributes = {},
    page = 1,
    limit = 20
}: GetListingsParams) {
    try {
        const where: Prisma.ListingWhereInput = {
            status: ListingStatus.ACTIVE
        }

        // 1. Kategori Filtresi
        if (categorySlug) {
            const category = await db.category.findUnique({
                where: { slug: categorySlug }
            })

            if (category) {
                const categoryIds = await getCategorySubtreeIds(category.id)
                where.categoryId = { in: categoryIds }
            }
        }

        // 2. Fiyat Filtresi
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.price = {}
            if (minPrice) where.price.gte = minPrice
            if (maxPrice) where.price.lte = maxPrice
        }

        // 3. Özellik Filtresi
        if (Object.keys(attributes).length > 0) {
            const andConditions: Prisma.ListingWhereInput[] = []

            for (const [attrName, value] of Object.entries(attributes)) {
                if (!value || (Array.isArray(value) && value.length === 0)) continue
                const values = Array.isArray(value) ? value : [value]

                const condition: Prisma.ListingWhereInput = {
                    attributeValues: {
                        some: {
                            attribute: { name: { equals: attrName, mode: "insensitive" } },
                            value: { in: values }
                        }
                    }
                }
                andConditions.push(condition)
            }
            if (andConditions.length > 0) where.AND = andConditions
        }

        // 4. Sıralama
        let orderBy: Prisma.ListingOrderByWithRelationInput = { createdAt: "desc" }
        if (sort === "price_asc") orderBy = { price: "asc" }
        if (sort === "price_desc") orderBy = { price: "desc" }
        if (sort === "date_asc") orderBy = { createdAt: "asc" }

        const skip = (page - 1) * limit

        const [rawListings, totalCount] = await Promise.all([
            db.listing.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    user: { select: { name: true, image: true, id: true } },
                    category: { select: { name: true, slug: true } },
                    attributeValues: { include: { attribute: true } }
                }
            }),
            db.listing.count({ where })
        ])

        const listings = rawListings.map(listing => ({
            ...listing,
            price: Number(listing.price)
        }))

        return {
            listings,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        }

    } catch (error) {
        console.error("getListings Error:", error)
        return { error: "İlanlar getirilemedi." }
    }
}

export async function toggleListingStatus(listingId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Giriş yapmalısınız" }

    const listing = await db.listing.findUnique({ where: { id: listingId } })
    if (!listing) return { error: "İlan bulunamadı" }

    if (listing.userId !== session.user.id && (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz işlem" }
    }

    const newStatus = listing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"

    await db.listing.update({
        where: { id: listingId },
        data: { status: newStatus }
    })

    revalidatePath("/my-listings")
    return { success: true, status: newStatus }
}

export async function deleteListing(listingId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Giriş yapmalısınız" }

    const listing = await db.listing.findUnique({ where: { id: listingId } })
    if (!listing) return { error: "İlan bulunamadı" }

    if (listing.userId !== session.user.id && (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz işlem" }
    }

    await db.listing.delete({ where: { id: listingId } })
    revalidatePath("/my-listings")
    return { success: true }
}

export async function createListing(formData: FormData) {
    console.log("createListing started") // Debug log
    const session = await auth()
    if (!session?.user?.id) return { error: "Giriş yapmalısınız" }

    // Kullanıcı kontrolü (FK hatasını önlemek için)
    const userExists = await db.user.findUnique({ where: { id: session.user.id } })
    if (!userExists) {
        return { error: "Oturum bilginiz geçersiz veya kullanıcı silinmiş. Lütfen çıkış yapıp tekrar giriş yapın." }
    }

    if (!userExists.emailVerified) {
        return { error: "İlan verebilmek için lütfen önce e-posta adresinizi doğrulayın." }
    }

    const categoryId = formData.get("categoryId") as string
    const title = formData.get("title") as string
    // Açıklama undefined olabilir
    const description = (formData.get("description") as string) || ""
    const priceStr = formData.get("price") as string
    const city = (formData.get("city") as string) || ""
    const district = (formData.get("district") as string) || ""

    if (!categoryId || !title || !priceStr) {
        return { error: "Eksik alanlar var (Kategori, Başlık veya Fiyat)." }
    }

    try {

        // 1. Resimleri Kaydet
        const imageUrls: string[] = []

        // A. Pre-uploaded images (from new frontend)
        const uploadedImages = formData.getAll("uploadedImages")
        if (uploadedImages && uploadedImages.length > 0) {
            uploadedImages.forEach(img => {
                if (typeof img === 'string') imageUrls.push(img)
            })
        }

        // B. Legacy/Direct File uploads (fallback)
        const images = formData.getAll("images")
        if (images && images.length > 0) {
            const uploadDir = join(process.cwd(), "public", "uploads")

            // Sync check is safer here to avoid race conditions or promise issues
            if (!fs.existsSync(uploadDir)) {
                await fs.promises.mkdir(uploadDir, { recursive: true })
            }

            for (const image of images) {
                // File check
                if (image && typeof image === "object" && "arrayBuffer" in image && (image as File).size > 0) {
                    const file = image as File
                    const buffer = Buffer.from(await file.arrayBuffer())
                    const filename = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}` // Safer filename
                    const filepath = join(uploadDir, filename)

                    await fs.promises.writeFile(filepath, buffer)
                    imageUrls.push(`/api/images/${filename}`)
                }
            }
        }


        // 2. İlanı Oluştur
        console.log("Creating listing in DB...")
        const listing = await db.listing.create({
            data: {
                userId: session.user.id,
                categoryId,
                title,
                description,
                price: parseFloat(priceStr),
                currency: "TRY",
                images: imageUrls,
                city,
                district,
                status: "ACTIVE"
            }
        })

        // 3. Özellikleri Kaydet
        console.log("Saving attributes...")
        const attributeKeys = Array.from(formData.keys()).filter((key) => key.startsWith("attributes["))

        for (const key of attributeKeys) {
            const match = key.match(/attributes\[(.*?)\]/)
            if (match && match[1]) {
                const attrId = match[1]
                const attrValue = formData.get(key) as string

                if (!attrValue) continue

                // Find attribute definition by ID directly
                const attrDef = await db.attributeDefinition.findUnique({
                    where: { id: attrId }
                })

                if (attrDef) {
                    await db.listingAttributeValue.create({
                        data: {
                            listingId: listing.id,
                            attributeId: attrDef.id,
                            value: attrValue
                        }
                    })
                }
            }
        }


        console.log("Listing created successfully:", listing.id)
        revalidatePath("/my-listings")
        revalidatePath("/")
        revalidatePath("/", "layout")
        return { success: true, listingId: listing.id }


    } catch (error) {
        console.error("createListing Error:", error)
        return { error: "İlan oluşturulamadı: " + (error instanceof Error ? error.message : "Bilinmeyen hata") }
    }
}

export async function updateListing(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Giriş yapmalısınız" }

    const listingId = formData.get("id") as string
    if (!listingId) return { error: "İlan ID eksik" }

    // Yetki Kontrolü
    const existingListing = await db.listing.findUnique({ where: { id: listingId } })
    if (!existingListing) return { error: "İlan bulunamadı" }

    if (existingListing.userId !== session.user.id && (session.user as any).role !== "ADMIN") {
        return { error: "Bu ilanı düzenleme yetkiniz yok" }
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user || (!user.emailVerified && (session.user as any).role !== "ADMIN")) {
        return { error: "İlan düzenlemek için e-posta adresinizi doğrulamanız gerekmektedir." }
    }

    const title = formData.get("title") as string
    const description = (formData.get("description") as string) || ""
    const priceStr = formData.get("price") as string
    const city = (formData.get("city") as string) || ""
    const district = (formData.get("district") as string) || ""

    try {
        // Yeni yüklenen resimler
        const newImages = formData.getAll("newImages")
        const existingImages = formData.getAll("existingImages") as string[] // String array olarak gelmeli
        // FormData getAll always returns Checkbox/File entries. If it's string array sent as multiple fields:
        // Actually client sends multiple fields with same name.

        const finalImages: string[] = []
        if (existingImages && existingImages.length > 0) {
            existingImages.forEach(img => {
                if (typeof img === 'string') finalImages.push(img)
            })
        }

        if (newImages && newImages.length > 0) {
            const uploadDir = join(process.cwd(), "public", "uploads")
            if (!fs.existsSync(uploadDir)) {
                await fs.promises.mkdir(uploadDir, { recursive: true })
            }

            for (const image of newImages) {
                if (image && typeof image === "object" && "arrayBuffer" in image && (image as File).size > 0) {
                    const file = image as File
                    const buffer = Buffer.from(await file.arrayBuffer())
                    const filename = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
                    const filepath = join(uploadDir, filename)

                    await fs.promises.writeFile(filepath, buffer)
                    finalImages.push(`/api/images/${filename}`)
                }
            }
        }

        // Update DB
        await db.listing.update({
            where: { id: listingId },
            data: {
                title,
                description,
                price: parseFloat(priceStr),
                city,
                district,
                images: finalImages
            }
        })

        // Update Attributes
        const attributeKeys = Array.from(formData.keys()).filter((key) => key.startsWith("attributes["))
        for (const key of attributeKeys) {
            const match = key.match(/attributes\[(.*?)\]/)
            if (match && match[1]) {
                const attrId = match[1]
                const attrValue = formData.get(key) as string

                if (!attrValue) {
                    // If value is empty, maybe delete? For now let's just skip or clear.
                    // If the user clears a value, we should probably delete the record or set to empty.
                    // But `create` skips empty so let's check current behavior.
                    // If clear -> delete
                    await db.listingAttributeValue.deleteMany({
                        where: {
                            listingId: listingId,
                            attributeId: attrId
                        }
                    })
                    continue
                }

                // Upsert
                const attrDef = await db.attributeDefinition.findUnique({ where: { id: attrId } })
                if (attrDef) {
                    const existing = await db.listingAttributeValue.findUnique({
                        where: {
                            listingId_attributeId: {
                                listingId: listingId,
                                attributeId: attrId
                            }
                        }
                    })

                    if (existing) {
                        await db.listingAttributeValue.update({
                            where: { id: existing.id },
                            data: { value: attrValue }
                        })
                    } else {
                        await db.listingAttributeValue.create({
                            data: {
                                listingId: listingId,
                                attributeId: attrId,
                                value: attrValue
                            }
                        })
                    }
                }
            }
        }


        revalidatePath(`/ilan/${listingId}`)
        revalidatePath("/my-listings")
        revalidatePath("/")
        revalidatePath("/", "layout") // Force full refresh
        return { success: true }


    } catch (error) {
        console.error("Update Listing Error:", error)
        return { error: "Güncelleme başarısız: " + (error instanceof Error ? error.message : "") }
    }
}
