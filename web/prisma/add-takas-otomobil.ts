
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
    const otomobil = await prisma.category.findFirst({ where: { slug: "otomobil" } })

    if (!otomobil) {
        console.error("Otomobil kategorisi bulunamadı.")
        return
    }

    const attrData = {
        name: "Takaslı",
        type: "SELECT",
        options: ["Evet", "Hayır"],
        required: false
    }

    // Attribute Definition oluştur
    const attrDef = await prisma.attributeDefinition.create({
        data: {
            name: attrData.name,
            type: attrData.type as any,
            options: attrData.options
        }
    })

    // Otomobil kategorisine bağla
    await prisma.categoryAttribute.create({
        data: {
            categoryId: otomobil.id,
            attributeId: attrDef.id,
            required: attrData.required
        }
    })

    console.log("Takaslı özelliği Otomobil kategorisine eklendi.")
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
