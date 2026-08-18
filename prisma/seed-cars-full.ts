
import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const prisma = new PrismaClient()

// CommonJS/ESM compatibility workaround for __dirname in some envs if needed, 
// but assuming tsx handles it or standard node. 
// If type: module is set in package.json, __dirname is not available.
// Let's use process.cwd() as base since we run from root.

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

async function main() {
    console.log("Seeding Full Car Data from JSON...")

    // Assuming running from project root
    const dataPath = path.join(process.cwd(), "prisma", "car_data_series.json")

    if (!fs.existsSync(dataPath)) {
        console.error("JSON file not found:", dataPath)
        return
    }

    const rawData = fs.readFileSync(dataPath, "utf-8")
    const carData = JSON.parse(rawData)

    // Ensure Otomobil category exists
    const vasita = await prisma.category.findFirst({ where: { slug: "vasita" } })
    if (!vasita) {
        console.log("Creating Vasıta...")
        await prisma.category.create({ data: { name: "Vasıta", slug: "vasita" } })
    }

    let otomobil = await prisma.category.findFirst({ where: { slug: "otomobil" } })
    if (!otomobil) {
        console.log("Creating Otomobil...")
        // Re-fetch vasita to be sure
        const v = await prisma.category.findFirst({ where: { slug: "vasita" } })
        otomobil = await prisma.category.create({ data: { name: "Otomobil", slug: "otomobil", parentId: v?.id } })
    }

    for (const brandData of carData) {
        const brandName = brandData.name
        const brandSlug = slugify(brandName, "oto")

        // Brand Category
        let brandCat = await prisma.category.findUnique({ where: { slug: brandSlug } })
        if (!brandCat) {
            console.log(`Creating Brand: ${brandName}`)
            brandCat = await prisma.category.create({
                data: {
                    name: brandName,
                    slug: brandSlug,
                    parentId: otomobil!.id // ! safe because we ensured it exists
                }
            })
        }

        // Models
        for (const group of brandData.models) {
            const isGenericGroup = group.name === "Modeller"

            let parentForSub = brandCat.id
            let parentSlugPrefix = brandSlug

            if (!isGenericGroup) {
                // Create Series Category (e.g. A3 Serisi)
                const seriesSlug = slugify(group.name, brandSlug)
                let seriesCat = await prisma.category.findUnique({ where: { slug: seriesSlug } })
                if (!seriesCat) {
                    // console.log(`  Creating Series: ${group.name}`)
                    seriesCat = await prisma.category.create({
                        data: {
                            name: group.name,
                            slug: seriesSlug,
                            parentId: brandCat.id
                        }
                    })
                }
                parentForSub = seriesCat.id
                parentSlugPrefix = seriesSlug
            }

            // Sub models
            if (Array.isArray(group.sub)) {
                for (const modelName of group.sub) {
                    if (typeof modelName === 'string') {
                        const modelSlug = slugify(modelName, parentSlugPrefix)

                        const existing = await prisma.category.findUnique({ where: { slug: modelSlug } })
                        if (!existing) {
                            await prisma.category.create({
                                data: {
                                    name: modelName,
                                    slug: modelSlug,
                                    parentId: parentForSub
                                }
                            })
                        }
                    }
                }
            }
        }
    }

    console.log("Full Car Data Seeded!")
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
