
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
    console.log("Cleaning up duplicate Year attributes in Otomobil...")

    const otomobil = await prisma.category.findFirst({
        where: { slug: "otomobil" },
        include: { attributes: { include: { attribute: true } } }
    })

    if (!otomobil) return console.log("Otomobil not found")

    // "Yıl" içerenleri bul
    const yearAttributes = otomobil.attributes.filter(ca =>
        ca.attribute.name.toLowerCase().includes("yıl") || ca.attribute.name.toLowerCase().includes("year")
    )

    console.log("Found year attributes:", yearAttributes.map(ca => `${ca.attribute.name} (Link ID: ${ca.id})`))

    let toDelete: string[] = []

    // 1. Durum: Hem "Yıl" hem "Model Yılı" varsa -> "Yıl" olanları sil.
    // 2. Durum: İkisi de "Model Yılı" ise -> Sadece birini tut.

    const modelYiliAttributes = yearAttributes.filter(ca => ca.attribute.name === "Model Yılı")
    const justYilAttributes = yearAttributes.filter(ca => ca.attribute.name === "Yıl")

    if (modelYiliAttributes.length > 0) {
        // Model Yılı var, o zaman "Yıl" olanların hepsini sil
        justYilAttributes.forEach(ca => toDelete.push(ca.id))

        // Eğer birden fazla "Model Yılı" varsa, ilkini tut diğerlerini sil
        if (modelYiliAttributes.length > 1) {
            modelYiliAttributes.slice(1).forEach(ca => toDelete.push(ca.id))
        }
    } else if (justYilAttributes.length > 1) {
        // Sadece "Yıl" var ama birden fazla -> ilkini tut
        justYilAttributes.slice(1).forEach(ca => toDelete.push(ca.id))
    }

    // Diğer "Üretim Yılı" vs varsa onları ellemiyoruz şimdilik, sadece kullanıcının dediği 2 tane var durumunu çözüyoruz.

    if (toDelete.length > 0) {
        console.log("Deleting CategoryAttributes with IDs:", toDelete)
        await prisma.categoryAttribute.deleteMany({
            where: { id: { in: toDelete } }
        })
        console.log(`Deleted ${toDelete.length} duplicate year attributes.`)
    } else {
        console.log("No duplicate year attributes found to delete.")
    }
}
main().then(() => prisma.$disconnect())
