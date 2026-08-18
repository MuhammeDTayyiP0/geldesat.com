"use server"

import { db } from "@/lib/db"

export async function getCategories(parentId: string | null = null) {
    try {
        const categories = await db.category.findMany({
            where: {
                parentId: parentId,
            },
            orderBy: {
                name: "asc",
            },
            include: {
                attributes: {
                    include: {
                        attribute: true
                    }
                }
            }
        })
        return { success: true, data: categories }
    } catch (error) {
        console.error("Failed to fetch categories:", error)
        return { success: false, error: "Kategoriler yüklenemedi." }
    }
}

export async function getCategoryPath(categoryId: string) {
    // Helper to get breadcrumb path and ALL attributes from the hierarchy
    try {
        const category = await db.category.findUnique({
            where: { id: categoryId },
            include: {
                parent: { include: { parent: true } },
                // We initially fetch attributes of the leaf
                attributes: {
                    include: { attribute: true }
                }
            }
        });

        if (!category) return { success: false, error: "Kategori bulunamadı" }

        // Recursive function to collect attributes from parents
        let currentParent = category.parent
        let allAttributes = [...category.attributes]

        // This simple while loop is a basic implementation. 
        // For infinite depth, one might need a recursive CTE or multiple queries if depth is unknown.
        // Assuming max depth 5-6 for now, manual traversal is okay or iterative query.
        // But since we included parent.parent, we only have 2 levels up in the 'category' object.
        // TO DO IT PROPERLY: We should use a recursive query or loop fetching parents.

        let parentPointer = category.parentId;
        while (parentPointer) {
            const parent = await db.category.findUnique({
                where: { id: parentPointer },
                include: { attributes: { include: { attribute: true } } }
            })
            if (parent) {
                // Prepend attributes (so parent attributes come first or last depending on preference)
                // Let's add them to the list if not already present (though defined on diff levels usually means diff attributes)
                allAttributes = [...allAttributes, ...parent.attributes]
                parentPointer = parent.parentId
            } else {
                break
            }
        }

        // Deduplicate attributes based on Attribute NAME (to handle cases where same attribute exists as different records)
        const uniqueAttributes = allAttributes.reduce((acc: any[], current) => {
            const x = acc.find(item => item.attribute.name === current.attribute.name);
            if (!x) {
                return acc.concat([current]);
            } else {
                // Optional: If we want to prioritize the child (current) or parent (existing), handle here.
                // Currently keeping the first one encountered (from child/leaf) or parent depending on traversal order.
                // Our traversal was [leaf, ...parents], so we keep the LEAF version which is usually more specific.
                return acc;
            }
        }, []);

        // Sort attributes by name or priority logic
        uniqueAttributes.sort((a, b) => a.attribute.name.localeCompare(b.attribute.name))

        return {
            success: true,
            data: {
                ...category,
                attributes: uniqueAttributes
            }
        }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Kategori yolu bulunamadı" }
    }
}

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const CategorySchema = z.object({
    name: z.string().min(2, "Kategori adı en az 2 karakter olmalı"),
    slug: z.string().min(2, "Slug en az 2 karakter olmalı").regex(/^[a-z0-9-]+$/, "Slug sadece küçük harf, rakam ve tire içerebilir"),
    parentId: z.string().optional().nullable()
})

export async function createCategory(formData: FormData) {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") return { error: "Yetkisiz işlem" }

    const name = formData.get("name") as string
    const slug = formData.get("slug") as string
    const parentId = formData.get("parentId") as string || null

    const validation = CategorySchema.safeParse({ name, slug, parentId })
    if (!validation.success) {
        return { error: (validation.error as any).errors[0].message }
    }

    try {
        await db.category.create({
            data: { name, slug, parentId }
        })
        revalidatePath("/admin/categories")
        return { success: true }
    } catch (error) {
        // Unique constraint failed likely
        return { error: "Kategori oluşturulamadı veya slug kullanımda." }
    }
}

export async function deleteCategory(id: string) {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") return { error: "Yetkisiz işlem" }

    try {
        await db.category.delete({ where: { id } })
        revalidatePath("/admin/categories")
        return { success: true }
    } catch (error) {
        // ... existing deleteCategory ...
        return { error: "Silinemedi. Alt kategorileri veya ilanları olabilir." }
    }
}

export async function updateCategory(id: string, name: string, slug: string) {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") return { error: "Yetkisiz işlem" }

    try {
        await db.category.update({
            where: { id },
            data: { name, slug }
        })
        revalidatePath("/admin/categories")
        return { success: true }
    } catch (e) {
        return { error: "Güncellenemedi. Slug çakışması olabilir." }
    }
}

export async function addAttributeToCategory(categoryId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.email) return { error: "Giriş yapmalısınız" }

    const user = await db.user.findUnique({ where: { email: session.user.email } })
    if (user?.role !== "ADMIN") return { error: "Yetkisiz işlem" }


    const name = formData.get("name") as string
    const type = formData.get("type") as "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN"
    const required = formData.get("required") === "on"
    const optionsRaw = formData.get("options") as string

    if (!name || !type) return { error: "İsim ve tip zorunludur" }

    const options = type === "SELECT" && optionsRaw
        ? optionsRaw.split("\n").map(s => s.trim()).filter(Boolean)
        : []

    try {
        const attribute = await db.attributeDefinition.create({
            data: {
                name,
                type,
                options
            }
        })

        await db.categoryAttribute.create({
            data: {
                categoryId,
                attributeId: attribute.id,
                required
            }
        })

        revalidatePath("/admin/categories")
        return { success: true }

    } catch (error) {
        console.error(error)
        return { error: "Özellik eklenemedi" }
    }
}

export async function removeAttributeFromCategory(attributeId: string) {
    // attributeId here refers to the ID of the AttributeDefinition, but we need to delete the link (CategoryAttribute).
    // Or we pass the link ID directly. 
    // Let's assume we pass the CategoryAttribute ID if we can get it.
    // However, if the UI lists attributes, it might list AttributeDefinitions.
    // We need to find the link.

    const session = await auth()
    if (!session?.user?.email) return { error: "Giriş yapmalısınız" }

    const user = await db.user.findUnique({ where: { email: session.user.email } })
    if (user?.role !== "ADMIN") return { error: "Yetkisiz işlem" }

    try {
        // If the ID passed is CategoryAttribute ID:
        await db.categoryAttribute.delete({
            where: { id: attributeId }
        })

        revalidatePath("/admin/categories")
        return { success: true }
    } catch (error) {
        console.error("removeAttribute error:", error)
        return { error: "Silinemedi: " + (error instanceof Error ? error.message : "Bilinmeyen hata") }
    }
}

export async function suggestCategory(data: any) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Giriş yapmalısınız" }

    try {
        await db.categorySuggestion.create({
            data: {
                userId: session.user.id,
                categoryName: data.categoryName,
                description: data.description,
                parentId: data.parentId || null
            }
        })
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Öneri kaydedilemedi" }
    }
}

export async function updateCategoryAttribute(id: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.email) return { error: "Giriş yapmalısınız" }

    const user = await db.user.findUnique({ where: { email: session.user.email } })
    if (user?.role !== "ADMIN") return { error: "Yetkisiz işlem" }

    const name = formData.get("name") as string
    const type = formData.get("type") as "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN"
    const required = formData.get("required") === "on"
    const optionsRaw = formData.get("options") as string

    const options = type === "SELECT" && optionsRaw
        ? optionsRaw.split("\n").map(s => s.trim()).filter(Boolean)
        : []

    try {
        const link = await db.categoryAttribute.findUnique({
            where: { id },
            include: { attribute: true }
        })
        if (!link) return { error: "Kayıt bulunamadı" }

        // Update Link
        await db.categoryAttribute.update({
            where: { id },
            data: { required }
        })

        // Update Definition (Global)
        await db.attributeDefinition.update({
            where: { id: link.attributeId },
            data: { name, type, options }
        })

        revalidatePath("/admin/categories")
        return { success: true }
    } catch (error) {
        console.error("Update attribute error:", error)
        return { error: "Güncellenemedi: " + (error instanceof Error ? error.message : "") }
    }
}

export async function getCategoryAttributesWithInheritance(categoryId: string) {
    // 1. Tüm kategorileri (id, parentId) çekerek yolu bulalım (N query yerine 1 query + ram işlem)
    // Eğer kategori sayısı çok fazlaysa (10k+) bu yöntem optimize edilmeli (Raw SQL CTE vb.)
    // Ancak tipik e-ticaret için bu daha hızlıdır.

    const allCategories = await db.category.findMany({
        select: { id: true, parentId: true }
    })

    const categoryMap = new Map<string, string | null>()
    allCategories.forEach(c => categoryMap.set(c.id, c.parentId))

    // 2. Yolu oluştur (Leaf -> Root)
    const pathIds: string[] = []
    let curr: string | undefined = categoryId

    while (curr) {
        pathIds.push(curr)
        curr = categoryMap.get(curr) || undefined // parentId veya undefined
        // Döngü koruması (Hata durumunda sonsuz döngü olmasın)
        if (pathIds.length > 50) break
    }

    if (pathIds.length === 0) return []

    // 3. Bu kategorilere ait tüm attributes'ları tek seferde çek
    const categoriesWithAttributes = await db.category.findMany({
        where: { id: { in: pathIds } },
        include: {
            attributes: {
                include: { attribute: true }
            }
        }
    })

    // 4. Sıralamayı korumak veya birleştirmek (Root -> Leaf veya Leaf -> Root)
    // Orijinal fonksiyon Leaf -> Root sırasıyla geziyordu ve seenAttributeIds ile engelliyordu.
    // Biz de aynı mantığı uygulayalım.

    const allAttributes: any[] = []
    const seenAttributeIds = new Set<string>()

    // pathIds Leaf -> Root şeklindedir: [Laptop, Computer, Electronics]
    // Orijinal kod: currentId (Leaf)'den başlayıp yukarı çıkıyordu.
    // Yani sırayla: Laptop'ınkiler, sonra Computer, sonra Electronics.

    for (const pid of pathIds) {
        const cat = categoriesWithAttributes.find(c => c.id === pid)
        if (cat && cat.attributes) {
            for (const catAttr of cat.attributes) {
                if (!seenAttributeIds.has(catAttr.attributeId)) {
                    seenAttributeIds.add(catAttr.attributeId)
                    allAttributes.push(catAttr)
                }
            }
        }
    }

    return allAttributes
}
