
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Basit slug yapıcı (Türkçe karakter desteği yok, basit replace)
function simpleSlug(text: string, prefix: string = "") {
    let s = text.toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9\s-]/g, '') // remove invalid chars
        .trim()
        .replace(/\s+/g, '-')

    if (prefix) return `${prefix}-${s}`
    return s
}

const MOTO_DATA = [
    {
        brand: "Honda",
        models: ["CBR 250 R", "CBR 650 R", "PCX 125", "Forza 250", "Africa Twin", "Goldwing"]
    },
    {
        brand: "Yamaha",
        models: ["R25", "MT 07", "MT 09", "XMAX 250", "Tracer 900", "Tenere 700"]
    },
    {
        brand: "Kawasaki",
        models: ["Ninja 400", "Z900", "ZX-10R", "Versys 650"]
    },
    {
        brand: "BMW",
        models: ["R 1250 GS", "S 1000 RR", "F 850 GS", "C 400 X"]
    },
    {
        brand: "Ducati",
        models: ["Panigale V4", "Monster 821", "Multistrada V4", "Diavel"]
    },
    {
        brand: "KTM",
        models: ["Duke 390", "RC 390", "Adventure 1290", "EXC 300"]
    },
    {
        brand: "Bajaj",
        models: ["Pulsar RS200", "Pulsar NS200", "Dominar 400"]
    },
    {
        brand: "Arora",
        models: ["Cappucino 50", "Mojito 50"]
    }
]

const CAR_DATA = [
    {
        brand: "BMW",
        models: ["3 Serisi", "5 Serisi", "X5", "iX"]
    },
    {
        brand: "Mercedes-Benz",
        models: ["C Serisi", "E Serisi", "S Serisi", "CLA", "G Serisi"]
    },
    {
        brand: "Audi",
        models: ["A3", "A4", "A6", "Q7", "Q8"]
    },
    {
        brand: "Volkswagen",
        models: ["Golf", "Passat", "Polo", "Tiguan", "Touareg"]
    },
    {
        brand: "Renault",
        models: ["Clio", "Megane", "Austral", "Taliant"]
    },
    {
        brand: "Fiat",
        models: ["Egea", "Doblo", "Fiorino", "Panda"]
    },
    {
        brand: "Ford",
        models: ["Focus", "Fiesta", "Kuga", "Ranger"]
    },
    {
        brand: "Toyota",
        models: ["Corolla", "Yaris", "C-HR", "RAV4"]
    },
    {
        brand: "Honda",
        models: ["Civic", "CR-V", "Jazz", "City"]
    }
]

async function main() {
    console.log("Seeding Detailed Categories...")

    // 1. Ana Kategorileri/Parentları Bul veya Oluştur
    let vasita = await prisma.category.findFirst({ where: { slug: "vasita" } })
    if (!vasita) vasita = await prisma.category.create({ data: { name: "Vasıta", slug: "vasita" } })

    let moto = await prisma.category.findFirst({ where: { slug: "motosiklet" } })
    if (!moto) {
        moto = await prisma.category.create({ data: { name: "Motosiklet", slug: "motosiklet", parentId: vasita.id } })
    } else if (!moto.parentId) {
        await prisma.category.update({ where: { id: moto.id }, data: { parentId: vasita.id } })
    }

    let otomobil = await prisma.category.findFirst({ where: { slug: "otomobil" } })
    if (!otomobil) {
        otomobil = await prisma.category.create({ data: { name: "Otomobil", slug: "otomobil", parentId: vasita.id } })
    } else if (!otomobil.parentId) {
        await prisma.category.update({ where: { id: otomobil.id }, data: { parentId: vasita.id } })
    }


    // 2. Motosiklet Marka/Model Ekle
    console.log("Adding Moto Brands...")
    for (const data of MOTO_DATA) {
        const brandSlug = simpleSlug(data.brand, "moto")

        let brandCat = await prisma.category.findFirst({ where: { slug: brandSlug } })
        if (!brandCat) {
            brandCat = await prisma.category.create({
                data: {
                    name: data.brand,
                    slug: brandSlug,
                    parentId: moto.id
                }
            })
        }

        for (const model of data.models) {
            const modelSlug = simpleSlug(model, brandSlug)

            const existing = await prisma.category.findFirst({ where: { slug: modelSlug } })
            if (!existing) {
                await prisma.category.create({
                    data: {
                        name: model,
                        slug: modelSlug,
                        parentId: brandCat.id
                    }
                })
            }
        }
    }

    // 3. Otomobil Marka/Model Ekle
    console.log("Adding Car Brands...")
    for (const data of CAR_DATA) {
        const brandSlug = simpleSlug(data.brand, "oto")

        let brandCat = await prisma.category.findFirst({ where: { slug: brandSlug } })
        if (!brandCat) {
            brandCat = await prisma.category.create({
                data: {
                    name: data.brand,
                    slug: brandSlug,
                    parentId: otomobil.id
                }
            })
        }

        for (const model of data.models) {
            const modelSlug = simpleSlug(model, brandSlug)

            const existing = await prisma.category.findFirst({ where: { slug: modelSlug } })
            if (!existing) {
                await prisma.category.create({
                    data: {
                        name: model,
                        slug: modelSlug,
                        parentId: brandCat.id
                    }
                })
            }
        }
    }

    console.log("Detailed categories seeded!")
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
