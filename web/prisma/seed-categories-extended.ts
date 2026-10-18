
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Basit slug fonksiyonu
function slugify(text: string) {
    return text.toString().toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function main() {
    console.log("Seeding extended categories...")

    // --- ALISVERIS ---
    const alisveris = await prisma.category.upsert({
        where: { slug: "alisveris" }, update: {}, create: { name: "İkinci El ve Sıfır Alışveriş", slug: "alisveris" }
    })

    // Bilgisayar
    const bilgisayar = await prisma.category.upsert({
        where: { slug: "bilgisayar" }, update: { parentId: alisveris.id }, create: { name: "Bilgisayar", slug: "bilgisayar", parentId: alisveris.id }
    })

    // Bilgisayar > Laptop
    const laptops = await prisma.category.upsert({ where: { slug: "dizustu-laptop" }, update: { parentId: bilgisayar.id }, create: { name: "Dizüstü (Laptop)", slug: "dizustu-laptop", parentId: bilgisayar.id } })

    // Bilgisayar Özellikleri (Laptop'a ekliyoruz, parent inheritance çalışıyor mu? Kodda çalışıyordu. Garanti olsun diye laptopa ekliyorum)
    await addAttributes(laptops.id, [
        { name: "İşlemci", type: "SELECT", options: ["Intel Core i9", "Intel Core i7", "Intel Core i5", "Intel Core i3", "AMD Ryzen 9", "AMD Ryzen 7", "AMD Ryzen 5", "Apple M1", "Apple M2", "Apple M3"], required: true },
        { name: "RAM", type: "SELECT", options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB"], required: true },
        { name: "SSD Kapasitesi", type: "SELECT", options: ["128 GB", "256 GB", "512 GB", "1 TB", "2 TB"], required: true },
        { name: "Ekran Boyutu", type: "SELECT", options: ["13 inç", "14 inç", "15.6 inç", "16 inç", "17.3 inç"], required: true },
        { name: "Ekran Kartı", type: "SELECT", options: ["Dahili", "NVIDIA RTX 4090", "NVIDIA RTX 4080", "NVIDIA RTX 4070", "NVIDIA RTX 4060", "NVIDIA RTX 4050", "NVIDIA RTX 30 Series", "AMD Radeon Series"], required: false },
        { name: "Durumu", type: "SELECT", options: ["Sıfır", "İkinci El"], required: true }
    ])

    // Cep Telefonu
    const telefon = await prisma.category.upsert({
        where: { slug: "cep-telefonu" }, update: { parentId: alisveris.id }, create: { name: "Cep Telefonu", slug: "cep-telefonu", parentId: alisveris.id }
    })
    // Telefon Markaları
    const phoneBrands = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "OnePlus"]
    for (const brand of phoneBrands) {
        await prisma.category.upsert({
            where: { slug: slugify(brand) },
            update: { parentId: telefon.id },
            create: { name: brand, slug: slugify(brand), parentId: telefon.id }
        })
    }

    // Telefon Özellikleri (Ana kategoriye ekliyoruz, markalar miras alacak)
    await addAttributes(telefon.id, [
        { name: "Dahili Hafıza", type: "SELECT", options: ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"], required: true },
        { name: "RAM", type: "SELECT", options: ["4 GB", "6 GB", "8 GB", "12 GB"], required: true },
        { name: "Ekran Boyutu", type: "SELECT", options: ["5.5 inç ve altı", "5.5 - 6.0 inç", "6.1 inç ve üzeri"], required: false },
        { name: "Renk", type: "TEXT", required: false },
        { name: "Durumu", type: "SELECT", options: ["Sıfır", "İkinci El", "Yenilenmiş"], required: true },
        { name: "Garanti", type: "SELECT", options: ["Var", "Yok"], required: true }
    ])


    // --- EMLAK ---
    const emlak = await prisma.category.findFirst({ where: { slug: "emlak" } }) || await prisma.category.create({ data: { name: "Emlak", slug: "emlak" } })

    if (emlak) {
        const konut = await prisma.category.upsert({ where: { slug: "konut" }, update: { parentId: emlak.id }, create: { name: "Konut", slug: "konut", parentId: emlak.id } })

        // Konut Altları
        const satilik = await prisma.category.upsert({ where: { slug: "satilik-konut" }, update: { parentId: konut.id }, create: { name: "Satılık Daire", slug: "satilik-konut", parentId: konut.id } })
        const kiralik = await prisma.category.upsert({ where: { slug: "kiralik-konut" }, update: { parentId: konut.id }, create: { name: "Kiralık Daire", slug: "kiralik-konut", parentId: konut.id } })

        // Emlak Özellikleri (Konut seviyesine ekleyelim, satılık/kiralık miras alsın)
        await addAttributes(konut.id, [
            { name: "m² (Brüt)", type: "NUMBER", required: true },
            { name: "m² (Net)", type: "NUMBER", required: true },
            { name: "Oda Sayısı", type: "SELECT", options: ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "Dubleks"], required: true },
            { name: "Bina Yaşı", type: "SELECT", options: ["0", "1", "2", "3", "4", "5-10 Arası", "11-15 Arası", "16-20 Arası", "21 ve üzeri"], required: true },
            { name: "Bulunduğu Kat", type: "SELECT", options: ["Giriş", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10 ve üzeri", "Çatı Katı", "Bahçe Katı", "Zemin Kat"], required: true },
            { name: "Kat Sayısı", type: "NUMBER", required: false },
            { name: "Isıtma", type: "SELECT", options: ["Doğalgaz (Kombi)", "Merkezi", "Klima", "Soba", "Yerden Isıtma"], required: true },
            { name: "Eşyalı", type: "SELECT", options: ["Evet", "Hayır"], required: true },
            { name: "Balkon", type: "SELECT", options: ["Var", "Yok"], required: false },
            { name: "Banyo Sayısı", type: "NUMBER", required: false },
            { name: "Krediye Uygun", type: "SELECT", options: ["Evet", "Hayır"], required: false }
        ])
    }

    console.log("Seeding completed.")
}

async function addAttributes(categoryId: string, attrs: any[]) {
    for (const attr of attrs) {
        try {
            const def = await prisma.attributeDefinition.create({
                data: {
                    name: attr.name,
                    type: attr.type,
                    options: attr.options || []
                }
            })

            await prisma.categoryAttribute.create({
                data: {
                    categoryId,
                    attributeId: def.id,
                    required: attr.required
                }
            })
            console.log(`Attribute ${attr.name} added to ${categoryId}`)
        } catch (e) {
            // console.log(`Skipped ${attr.name} (error)`)
        }
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
