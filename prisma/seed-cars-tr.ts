
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Slug fonksiyonu
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

const TR_CARS = [
    {
        name: "Tofaş",
        models: ["Şahin", "Doğan", "Kartal", "Serçe", "Murat 124", "Murat 131"]
    },
    {
        name: "Fiat",
        models: ["Egea", "Linea", "Albea", "Palio", "Punto", "Grande Punto", "Uno", "Tempra", "Tipo", "Doblo", "Fiorino", "Panda", "500", "500L", "500X", "Freemont", "Fullback", "Marea", "Brava", "Bravo", "Stilo", "Siena"]
    },
    {
        name: "Renault",
        models: ["Clio", "Megane", "Symbol", "Fluence", "Taliant", "Captur", "Kadjar", "Austral", "Koleos", "Scenic", "Grand Scenic", "Laguna", "Latitude", "Talisman", "Broadway (R-9)", "Spring (R-9)", "Fairway (R-9)", "Toros (R-12)", "R-19", "R-11", "R-21", "Kangoo", "Master", "Trafic", "Modus", "Twizy", "Zoe"]
    },
    {
        name: "Volkswagen",
        models: ["Golf", "Polo", "Passat", "Passat Variant", "Jetta", "Bora", "Arteon", "Tiguan", "Touareg", "T-Roc", "Taigo", "Caddy", "Transporter", "Caravelle", "Amarok", "Crafter", "Scirocco", "Beetle", "CC", "EOS", "Lupo", "Fox", "Touran", "Sharan", "Vento"]
    },
    {
        name: "Ford",
        models: ["Focus", "Fiesta", "Mondeo", "Puma", "Kuga", "EcoSport", "Ranger", "Tourneo Courier", "Transit Courier", "Tourneo Connect", "Transit Connect", "Transit", "Escort", "Taunus", "Ka", "Fusion", "C-Max", "S-Max", "Galaxy", "Mustang", "B-Max"]
    },
    {
        name: "Opel",
        models: ["Astra", "Corsa", "Vectra", "Insignia", "Mokka", "Crossland", "Grandland", "Zafira", "Meriva", "Combo", "Tigra", "Omega", "Adam", "Agila", "Antara", "Frontera", "Kadett", "Ascona"]
    },
    {
        name: "Peugeot",
        models: ["206", "206+", "207", "208", "301", "306", "307", "308", "406", "407", "508", "2008", "3008", "5008", "Rifter", "Partner", "Bipper", "106", "107", "108", "RCZ", "Traveller", "Expert", "Boxer"]
    },
    {
        name: "Citroen",
        models: ["C3", "C3 Aircross", "C4", "C4 Cactus", "C4 Picasso", "C4 Grand Picasso", "C5", "C5 Aircross", "C-Elysee", "C1", "C2", "Saxo", "Xsara", "Berlingo", "Nemo", "Jumper", "Jumpy", "AMI"]
    },
    {
        name: "Dacia",
        models: ["Duster", "Sandero", "Sandero Stepway", "Logan", "Logan MCV", "Lodgy", "Dokker", "Spring", "Jogger", "Solenza"]
    },
    {
        name: "Skoda",
        models: ["Octavia", "Superb", "Fabia", "Rapid", "Scala", "Kamiq", "Karoq", "Kodiaq", "Yeti", "Roomster", "Citigo", "Felicia", "Favorit", "Forman"]
    },
    {
        name: "Seat",
        models: ["Leon", "Ibiza", "Ateca", "Arona", "Tarraco", "Toledo", "Cordoba", "Altea", "Altea XL", "Exeo", "Alhambra", "Mii", "Marbella"]
    },
    {
        name: "Honda",
        models: ["Civic", "City", "Jazz", "CR-V", "HR-V", "Accord", "CR-Z", "S2000", "Integra", "Prelude"]
    },
    {
        name: "Toyota",
        models: ["Corolla", "Yaris", "Auris", "Avensis", "C-HR", "RAV4", "Camry", "Hilux", "Proace City", "Verso", "Prius", "Land Cruiser", "Corona", "Carina", "Starlet", "GT86"]
    },
    {
        name: "Hyundai",
        models: ["i10", "i20", "i30", "iX35", "Accent", "Accent Era", "Accent Blue", "Elantra", "Tucson", "Bayon", "Kona", "Santa Fe", "Getz", "Starex", "H-100", "Ioniq", "Staria", "Sonata", "Matrix", "Atos"]
    },
    {
        name: "Nissan",
        models: ["Qashqai", "Juke", "Micra", "X-Trail", "Navara", "Note", "Pulsar", "Primera", "Almera", "Sunny", "Terrano", "Pathfinder", "Skyline", "GT-R", "350Z"]
    },
    {
        name: "Kia",
        models: ["Sportage", "Rio", "Ceed", "Picanto", "Cerato", "Stonic", "XCeed", "Sorento", "Niro", "EV6", "Soul", "Venga", "Bongo", "Pregio", "Pride", "Sephia", "Shuma"]
    },
    {
        name: "Chevrolet",
        models: ["Cruze", "Aveo", "Spark", "Captiva", "Trax", "Kalos", "Lacetti", "Epica", "Rezzo", "Camaro", "Corvette", "Tahoe", "Suburban"]
    },
    {
        name: "Mazda",
        models: ["3", "6", "CX-3", "CX-5", "CX-30", "MX-5", "RX-8", "323", "626", "Lantis", "Familia", "Demio", "Premacy", "MPV"]
    },
    {
        name: "Suzuki",
        models: ["Swift", "Vitara", "Jimny", "S-Cross", "Baleno", "Alto", "Ignis", "Grand Vitara", "SX4", "Splash", "Liana", "Maruti"]
    },
    {
        name: "Mitsubishi",
        models: ["Lancer", "Lancer Evolution", "Outlander", "ASX", "Eclipse Cross", "Space Star", "Colt", "Carisma", "Pajero", "L200", "Canter"]
    },
    {
        name: "Volvo",
        models: ["S40", "S60", "S80", "S90", "V40", "V40 Cross Country", "V60", "V90", "XC40", "XC60", "XC90", "C30", "C70", "850", "940", "960"]
    },
    {
        name: "Audi",
        models: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "TT", "R8", "e-tron"]
    },
    {
        name: "BMW",
        models: ["1 Serisi", "2 Serisi", "3 Serisi", "4 Serisi", "5 Serisi", "6 Serisi", "7 Serisi", "8 Serisi", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "i3", "i4", "iX", "Z4", "M Serisi"]
    },
    {
        name: "Mercedes-Benz",
        models: ["A Serisi", "B Serisi", "C Serisi", "CLA", "CLS", "E Serisi", "GLA", "GLB", "GLC", "GLE", "GLS", "G Serisi", "S Serisi", "SL", "SLC", "SLK", "Vito", "Sprinter", "Citan", "X-Class"]
    },
    {
        name: "Alfa Romeo",
        models: ["Giulietta", "MiTo", "159", "156", "147", "Giulia", "Stelvio", "Tonale", "Brera", "GT", "Spider"]
    },
    {
        name: "Lada",
        models: ["Samara", "Vega", "Niva", "Kalina", "Priora"]
    },
    {
        name: "Chery",
        models: ["Tiggo 7 Pro", "Tiggo 8 Pro", "Omoda 5", "Tiggo", "Alia", "Kimo", "Chance", "Niche"]
    },
    {
        name: "Geely",
        models: ["Emgrand", "Echo", "Familia", "FC", "MK"]
    },
    {
        name: "Mini",
        models: ["Cooper", "Cooper S", "Countryman", "Clubman", "One"]
    },
    {
        name: "Subaru",
        models: ["Impreza", "Forester", "XV", "Outback", "Legacy", "BRZ", "Levorg"]
    },
    {
        name: "Land Rover",
        models: ["Range Rover", "Range Rover Sport", "Range Rover Evoque", "Range Rover Velar", "Discovery", "Discovery Sport", "Defender", "Freelander"]
    },
    {
        name: "Porsche",
        models: ["Cayenne", "Macan", "Panamera", "Taycan", "911", "Boxster", "Cayman"]
    },
    {
        name: "Togg",
        models: ["T10X"]
    }
]

async function main() {
    console.log("Seeding TURKEY Specific Car Data...")

    // Ensure Otomobil category exists
    let otomobil = await prisma.category.findFirst({ where: { slug: "otomobil" } })
    if (!otomobil) {
        const vasita = await prisma.category.findFirst({ where: { slug: "vasita" } }) || await prisma.category.create({ data: { name: "Vasıta", slug: "vasita" } })
        otomobil = await prisma.category.create({ data: { name: "Otomobil", slug: "otomobil", parentId: vasita.id } })
    }

    for (const brandData of TR_CARS) {
        const brandSlug = slugify(brandData.name, "oto")

        let brandCat = await prisma.category.findUnique({ where: { slug: brandSlug } })
        if (!brandCat) {
            console.log(`Creating Brand: ${brandData.name}`)
            brandCat = await prisma.category.create({
                data: {
                    name: brandData.name,
                    slug: brandSlug,
                    parentId: otomobil.id
                }
            })
        }

        for (const modelName of brandData.models) {
            const modelSlug = slugify(modelName, brandSlug)

            const existing = await prisma.category.findUnique({ where: { slug: modelSlug } })
            if (!existing) {
                // console.log(`  Adding Model: ${modelName}`)
                await prisma.category.create({
                    data: {
                        name: modelName,
                        slug: modelSlug,
                        parentId: brandCat.id
                    }
                })
            }
        }
    }

    console.log("TURKEY Car Data Seeded!")
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
