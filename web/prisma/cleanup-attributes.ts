
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
    console.log("Cleaning up specific attributes...")

    // AttributeDefinition tablosunda tam eşleşme ile "Marka" ve "Kimden"
    const definitions = await prisma.attributeDefinition.findMany({
        where: {
            name: { in: ["Marka", "Kimden"] }
        }
    })

    if (definitions.length === 0) {
        console.log("No attributes found with exact names 'Marka' or 'Kimden'.")
        return
    }

    const ids = definitions.map(d => d.id)

    // CategoryAttribute tablosundan bunları sil (Kategorilerden bağı kopar)
    const deleted = await prisma.categoryAttribute.deleteMany({
        where: {
            attributeId: { in: ids }
        }
    })

    console.log(`Deleted ${deleted.count} category-attribute links for 'Marka' and 'Kimden'.`)
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
