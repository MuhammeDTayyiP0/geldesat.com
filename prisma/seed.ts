import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
})

async function main() {
    console.log("Seeding categories...")

    // 1. Emlak
    const emlak = await prisma.category.upsert({
        where: { slug: "emlak" },
        update: {},
        create: { name: "Emlak", slug: "emlak" },
    })

    // Emlak > Konut
    const konut = await prisma.category.upsert({
        where: { slug: "konut" },
        update: {},
        create: { name: "Konut", slug: "konut", parentId: emlak.id },
    })

    // Emlak > Konut > Satılık
    await prisma.category.upsert({
        where: { slug: "satilik-konut" },
        update: {},
        create: { name: "Satılık", slug: "satilik-konut", parentId: konut.id },
    })

    // Emlak > Konut > Kiralık
    await prisma.category.upsert({
        where: { slug: "kiralik-konut" },
        update: {},
        create: { name: "Kiralık", slug: "kiralik-konut", parentId: konut.id },
    })

    // 2. Vasıta
    const vasita = await prisma.category.upsert({
        where: { slug: "vasita" },
        update: {},
        create: { name: "Vasıta", slug: "vasita" },
    })

    // Vasıta > Otomobil
    const otomobil = await prisma.category.upsert({
        where: { slug: "otomobil" },
        update: {},
        create: { name: "Otomobil", slug: "otomobil", parentId: vasita.id },
    })

    // Vasıta > Motosiklet
    const motosiklet = await prisma.category.upsert({
        where: { slug: "motosiklet" },
        update: {},
        create: { name: "Motosiklet", slug: "motosiklet", parentId: vasita.id },
    })

    console.log("Categories seeded!")
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
