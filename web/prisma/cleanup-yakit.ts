
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
    console.log("Cleaning up duplicate fuel attributes...")

    // 1. "Yakıt" ismindeki özelliği sil (Yakıt Tipi kalsın)
    const yakitDef = await prisma.attributeDefinition.findMany({
        where: { name: "Yakıt" }
    })

    if (yakitDef.length > 0) {
        const ids = yakitDef.map(d => d.id)
        await prisma.categoryAttribute.deleteMany({
            where: { attributeId: { in: ids } }
        })
        console.log(`Deleted 'Yakıt' attribute links (keeping 'Yakıt Tipi').`)
    } else {
        console.log("'Yakıt' adında özellik bulunamadı.")
    }

    // 2. Kontrol: Acaba aynı kategoriye yanlışlıkla hem 'Yakıt Tipi' hem başka bir şey mi eklendi?
    // veya 2 tane 'Yakıt Tipi' mi var?

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
