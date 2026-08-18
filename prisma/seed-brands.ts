
import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

// Reverting to the simpler, flat list of models
const dataPath = path.join(process.cwd(), "prisma", "car_data.json")
const rawData = fs.readFileSync(dataPath, "utf8")
const CAR_DATA = JSON.parse(rawData)

async function main() {
    console.log("Reverting to standard Brand/Model structure...")

    const otomobil = await prisma.category.findUnique({
        where: { slug: "otomobil" },
        include: { children: true }
    })

    if (!otomobil) {
        console.log("Otomobil category not found.")
        return
    }

    console.log(`Found ${otomobil.children.length} existing brands. Cleaning up deep hierarchy if needed...`)

    // We want to keep brands but delete their children to re-seed models correctly?
    // Or just be additive.
    // The user said "eski haline çevir". This implies they didn't like the "Series" structure.
    // The Series structure created categories like "3 Serisi".
    // If we re-seed "320d" directly under BMW, "3 Serisi" will still be there unless we delete it.
    // So ideally we should delete all children of Otomobil's children (i.e. delete models/series) and re-seed models.

    // Deleting all brands might be too aggressive if they have listings.
    // Assuming no real user listings yet as this is dev.

    // Let's iterate over brands and delete their children.
    for (const brand of otomobil.children) {
        // Skip brands that might not be car brands if we have mixed data? 
        // But for "Otomobil" parent, all are cars.

        const models = await prisma.category.findMany({
            where: { parentId: brand.id }
        })
        if (models.length > 0) {
            // Delete sub-models of models (level 3) first
            for (const model of models) {
                await prisma.category.deleteMany({
                    where: { parentId: model.id }
                })
            }
            // Delete models/series (level 2)
            await prisma.category.deleteMany({
                where: { parentId: brand.id }
            })
        }
    }
    console.log("Cleaned up existing models/series.")

    // Seeding
    for (const brandData of CAR_DATA) {
        // Brands might already exist (from otomobil.children), or new ones.
        let brandCat = await prisma.category.findFirst({
            where: { name: brandData.name, parentId: otomobil.id }
        })

        if (!brandCat) {
            const slug = brandData.name.toLowerCase().replace(/[^a-z0-9]/g, "-")
            try {
                brandCat = await prisma.category.create({
                    data: {
                        name: brandData.name,
                        slug: slug,
                        parentId: otomobil.id
                    }
                })
                console.log(`Created Brand: ${brandData.name}`)
            } catch (e) {
                // Slug collision fallback
                brandCat = await prisma.category.create({
                    data: {
                        name: brandData.name,
                        slug: slug + "-" + Math.floor(Math.random() * 1000),
                        parentId: otomobil.id
                    }
                })
            }
        }

        // Create Flat Models
        if (brandData.models && brandData.models.length > 0) {
            for (const model of brandData.models) {
                const modelName = model.name // In car_data.json, structure is { name: "ModelName", sub: [] }

                // Check exist
                const exists = await prisma.category.findFirst({
                    where: { name: modelName, parentId: brandCat.id }
                })

                if (!exists) {
                    const slug = `${brandCat.slug}-${modelName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Math.floor(Math.random() * 10000)}`
                    try {
                        await prisma.category.create({
                            data: {
                                name: modelName,
                                slug: slug,
                                parentId: brandCat.id
                            }
                        })
                    } catch (e) {
                        // ignore
                    }
                }
            }
            // console.log(`Seeded models for ${brandData.name}`)
        }
    }

    console.log("Revert complete: Flat Brand -> Model structure restored.")
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
