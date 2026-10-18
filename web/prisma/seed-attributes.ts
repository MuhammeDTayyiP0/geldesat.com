
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("Seeding attributes...")

    // 1. Kategorileri Bul
    const motosiklet = await prisma.category.findFirst({ where: { slug: "motosiklet" } })
    const otomobil = await prisma.category.findFirst({ where: { slug: "otomobil" } })

    if (!motosiklet) {
        console.error("Motosiklet kategorisi bulunamadı. Önce `npm run seed` çalıştırın.")
        return
    }

    // 2. Motosiklet Özellikleri
    const motoAttrs = [
        {
            name: "Marka",
            type: "SELECT",
            options: ["Honda", "Yamaha", "Suzuki", "Kawasaki", "BMW", "Ducati", "KTM", "Bajaj", "TVS", "Arora", "Mondial", "Kuba", "RKS", "CFMoto", "Harley Davidson"],
            required: true
        },
        { name: "Model Yılı", type: "NUMBER", required: true },
        { name: "Motor Hacmi (cc)", type: "NUMBER", required: true },
        { name: "Motor Gücü (hp)", type: "NUMBER", required: false },
        {
            name: "Vites Tipi",
            type: "SELECT",
            options: ["Manuel", "Otomatik", "Yarı Otomatik"],
            required: true
        },
        {
            name: "Yakıt Tipi",
            type: "SELECT",
            options: ["Benzin", "Elektrik"],
            required: true
        },
        { name: "KM", type: "NUMBER", required: true },
        { name: "Renk", type: "TEXT", required: false },
        {
            name: "Takaslı",
            type: "SELECT",
            options: ["Evet", "Hayır"],
            required: false
        },
        {
            name: "Kimden",
            type: "SELECT",
            options: ["Sahibinden", "Galeriden", "Yetkili Bayiden"],
            required: true
        },
        {
            name: "Durumu",
            type: "SELECT",
            options: ["Sıfır", "İkinci El"],
            required: true
        }
    ]

    for (const attrData of motoAttrs) {
        // Attribute Definition oluştur
        const attrDef = await prisma.attributeDefinition.create({
            data: {
                name: attrData.name,
                type: attrData.type as any,
                options: attrData.options || []
            }
        })

        // Kategoriye Bağla
        // (Eğer zaten varsa hata vermesin diye try-catch veya upsert mantığı kullanılabilir ama categoryId_attributeId unique constraint hatayı handle edelim)
        try {
            await prisma.categoryAttribute.create({
                data: {
                    categoryId: motosiklet.id,
                    attributeId: attrDef.id,
                    required: attrData.required
                }
            })
            console.log(`Added ${attrData.name} to Motosiklet`)
        } catch (e) {
            console.log(`Skipped ${attrData.name} (already exists or error)`)
        }
    }


    // 3. Otomobil Özellikleri
    if (otomobil) {
        const carAttrs = [
            {
                name: "Marka",
                type: "SELECT",
                options: ["BMW", "Mercedes", "Audi", "Volkswagen", "Toyota", "Honda", "Fiat", "Ford", "Renault", "Peugeot", "Hyundai", "Opel", "Nissan"],
                required: true
            },
            { name: "Model Yılı", type: "NUMBER", required: true },
            {
                name: "Vites Tipi",
                type: "SELECT",
                options: ["Manuel", "Otomatik", "Yarı Otomatik"],
                required: true
            },
            {
                name: "Yakıt Tipi",
                type: "SELECT",
                options: ["Benzin", "Dizel", "LPG & Benzin", "Elektrik", "Hibrit"],
                required: true
            },
            { name: "KM", type: "NUMBER", required: true },
            {
                name: "Kasa Tipi",
                type: "SELECT",
                options: ["Sedan", "Hatchback", "Station Wagon", "SUV", "Cabrio", "Coupe"],
                required: true
            },
            { name: "Renk", type: "TEXT", required: false },
            {
                name: "Kimden",
                type: "SELECT",
                options: ["Sahibinden", "Galeriden", "Yetkili Bayiden"],
                required: true
            },
            {
                name: "Durumu",
                type: "SELECT",
                options: ["Sıfır", "İkinci El"],
                required: true
            }
        ]

        for (const attrData of carAttrs) {
            const attrDef = await prisma.attributeDefinition.create({
                data: {
                    name: attrData.name,
                    type: attrData.type as any,
                    options: attrData.options || []
                }
            })

            try {
                await prisma.categoryAttribute.create({
                    data: {
                        categoryId: otomobil.id,
                        attributeId: attrDef.id,
                        required: attrData.required
                    }
                })
                console.log(`Added ${attrData.name} to Otomobil`)
            } catch (e) {
                console.log(`Skipped ${attrData.name} for Otomobil`)
            }
        }
    }

    console.log("Attributes seeded successfully!")
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
