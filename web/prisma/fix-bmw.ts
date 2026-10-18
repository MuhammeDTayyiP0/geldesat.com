
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Slug fonksiyonu
function slugify(text: string, prefix: string = "") {
    let s = text.toString().toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')

    if (prefix) return `${prefix}-${s}`
    return s
}

const BMW_DATA = [
    {
        series: "1 Serisi",
        models: ["116i", "116d", "118i", "118d", "120i", "120d", "M135i", "M140i"]
    },
    {
        series: "2 Serisi",
        models: ["216d", "218i", "218d", "220d", "218i Gran Coupe", "216d Gran Coupe", "M235i", "M2"]
    },
    {
        series: "3 Serisi",
        models: ["315", "316", "316i", "318i", "318d", "320i", "320d", "320i ED", "325i", "328i", "330i", "330d", "335i", "340i", "M3"]
    },
    {
        series: "4 Serisi",
        models: ["418i", "418d", "420i", "420d", "428i", "430i", "418i Gran Coupe", "420d Gran Coupe", "M4"]
    },
    {
        series: "5 Serisi",
        models: ["520i", "520d", "523i", "525i", "525d", "525d xDrive", "528i", "530i", "530d", "535i", "535d", "540i", "550i", "M5"]
    },
    {
        series: "6 Serisi",
        models: ["630i", "635d", "640i", "640d", "650i", "M6"]
    },
    {
        series: "7 Serisi",
        models: ["730i", "730d", "730Ld", "740i", "740d", "740Ld", "750i", "750Li", "760i"]
    },
    {
        series: "8 Serisi",
        models: ["840i", "M850i", "M8"]
    },
    {
        series: "i Serisi",
        models: ["i3", "i4", "i5", "i7", "i8", "iX", "iX1", "iX3"]
    },
    {
        series: "X Serisi",
        models: ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "XM"]
    },
    {
        series: "Z Serisi",
        models: ["Z3", "Z4"]
    }
]

async function main() {
    console.log("Fixing BMW Categories...")

    // 1. BMW Kategorisini bul (slug 'oto-bmw' olması muhtemel)
    let bmw = await prisma.category.findFirst({
        where: { slug: "oto-bmw" }
    })

    if (!bmw) {
        // Belki 'bmw' veya başka bir slug. İsimden bulalım.
        // Parent'ı Otomobil olan BMW
        const otomobil = await prisma.category.findFirst({ where: { slug: "otomobil" } })
        if (otomobil) {
            bmw = await prisma.category.findFirst({
                where: { name: "BMW", parentId: otomobil.id }
            })
        }
    }

    if (!bmw) return console.error("BMW kategorisi bulunamadı!")
    console.log(`Found BMW category: ${bmw.name} (${bmw.id})`)

    // 2. BMW altındaki TÜM alt kategorileri sil
    const children = await prisma.category.findMany({ where: { parentId: bmw.id } })
    console.log(`Found ${children.length} sub-categories (Series/Models) to remove.`)

    for (const child of children) {
        await deleteCategoryRecursive(child.id)
    }

    console.log("BMW sub-categories cleaned.")

    // 3. Yeni yapıyı kur
    for (const series of BMW_DATA) {
        // Seri oluştur (Örn: 3 Serisi)
        const seriesSlug = slugify(series.series, bmw.slug)

        // Eğer zaten varsa (belki silinemedi?)
        let seriesCat = await prisma.category.findUnique({ where: { slug: seriesSlug } })
        if (!seriesCat) {
            seriesCat = await prisma.category.create({
                data: {
                    name: series.series,
                    slug: seriesSlug,
                    parentId: bmw.id
                }
            })
        }

        // Modelleri ekle (Örn: 320i)
        for (const model of series.models) {
            const modelSlug = slugify(model, seriesSlug)

            // Check exist
            const existing = await prisma.category.findUnique({ where: { slug: modelSlug } })
            if (!existing) {
                await prisma.category.create({
                    data: {
                        name: model,
                        slug: modelSlug,
                        parentId: seriesCat.id
                    }
                })
            }
        }
    }

    console.log("BMW structure rebuilt.")
}

async function deleteCategoryRecursive(categoryId: string) {
    // Find children
    const children = await prisma.category.findMany({ where: { parentId: categoryId } })

    for (const child of children) {
        await deleteCategoryRecursive(child.id)
    }

    try {
        // Delete related links first
        await prisma.categoryAttribute.deleteMany({ where: { categoryId } })
        // Prisma cascade might handle children deletion if configured, but safe side:
        await prisma.category.delete({ where: { id: categoryId } })
    } catch (e) {
        console.error(`Failed to delete category ${categoryId}:`, e)
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
