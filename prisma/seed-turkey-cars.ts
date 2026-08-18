
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Comprehensive list of popular cars in Turkey
const TURKEY_CARS = [
    {
        name: "Renault",
        models: ["Clio", "Megane", "Symbol", "Fluence", "Kadjar", "Captur", "Taliant", "Austral", "Koleos", "Scenic", "Laguna", "Latitude", "Twingo", "Zoe", "R 9", "R 11", "R 12", "R 19", "R 21"]
    },
    {
        name: "Fiat",
        models: ["Egea", "Linea", "Doblo", "Fiorino", "Albea", "Punto", "Panda", "Palio", "Uno", "Tipo", "Tempra", "Bravo", "Marea", "Siena", "Stilo", "Freemont", "500", "500L", "500X"]
    },
    {
        name: "Volkswagen",
        models: ["Passat", "Golf", "Polo", "Jetta", "Tiguan", "T-Roc", "Taigo", "Touareg", "Caddy", "Transporter", "Caravelle", "Amarok", "Arteon", "Scirocco", "Beetle", "Bora", "CC", "Vento"]
    },
    {
        name: "Ford",
        models: ["Focus", "Fiesta", "Mondeo", "Courier", "Connect", "Ranger", "Kuga", "EcoSport", "Puma", "C-Max", "Fusion", "Escort", "Taunus", "Mustang", "Explorer", "Edge", "Ka"]
    },
    {
        name: "Toyota",
        models: ["Corolla", "Auris", "Yaris", "C-HR", "RAV4", "Hilux", "Verso", "Avensis", "Camry", "Proace City", "Land Cruiser", "Corona", "Carina", "Starlet"]
    },
    {
        name: "BMW",
        models: ["3 Serisi", "5 Serisi", "1 Serisi", "2 Serisi", "4 Serisi", "7 Serisi", "X1", "X3", "X5", "iX", "i4", "i7", "i3", "Z4", "M Serisi", "6 Serisi", "8 Serisi"]
    },
    {
        name: "Mercedes-Benz",
        models: ["C Serisi", "E Serisi", "A Serisi", "CLA", "B Serisi", "GLA", "GLB", "GLC", "Vito", "Sprinter", "S Serisi", "CLS", "G Serisi", "GLE", "EQA", "EQB", "EQE", "EQS"]
    },
    {
        name: "Opel",
        models: ["Astra", "Corsa", "Insignia", "Mokka", "Crossland", "Grandland", "Vectra", "Combo", "Zafira", "Meriva", "Adam", "Omega", "Tigra", "Kadett", "Ascona"]
    },
    {
        name: "Hyundai",
        models: ["i20", "i10", "Accent", "Accent Blue", "Accent Era", "Elantra", "Tucson", "Bayon", "Kona", "i30", "Getz", "Staria", "H-1", "H-100", "Santa Fe", "Sonata", "ix35"]
    },
    {
        name: "Honda",
        models: ["Civic", "City", "Jazz", "CR-V", "HR-V", "Accord", "ZR-V", "Type-R", "Integra", "Prelude", "S2000"]
    },
    {
        name: "Peugeot",
        models: ["208", "301", "3008", "2008", "508", "408", "5008", "Partner", "Rifter", "308", "107", "206", "207", "307", "407", "RCZ", "Bipper"]
    },
    {
        name: "Dacia",
        models: ["Duster", "Sandero", "Stepway", "Jogger", "Lodgy", "Dokker", "Logan", "Solenza", "Spring"]
    },
    {
        name: "Citroën",
        models: ["C3", "C4", "C5 Aircross", "C-Elysee", "Berlingo", "C4 X", "Ami", "C4 Cactus", "C3 AirCross", "C1", "C2", "C5", "Saxo", "Xsara", "Nemo"]
    },
    {
        name: "Skoda",
        models: ["Octavia", "Superb", "Fabia", "Kamiq", "Karoq", "Kodiaq", "Scala", "Rapid", "Yeti", "Roomster", "Citigo", "Favorit", "Felicia", "Forman"]
    },
    {
        name: "Audi",
        models: ["A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7", "Q8", "A1", "A7", "A8", "e-tron", "TT", "R8"]
    },
    {
        name: "Nissan",
        models: ["Qashqai", "Juke", "Micra", "X-Trail", "Navara", "Note", "Primera", "Almera", "Sunny", "Terrano", "Skystar"]
    },
    {
        name: "Kia",
        models: ["Sportage", "Stonic", "Rio", "Picanto", "Ceed", "Cerato", "Sorento", "Niro", "EV6", "Xceed", "Bongo", "Sephia", "Pride"]
    },
    {
        name: "Volvo",
        models: ["XC90", "XC60", "XC40", "S90", "S60", "V40", "V60", "V90", "C30", "S40", "S80", "850"]
    },
    {
        name: "Seat",
        models: ["Leon", "Ibiza", "Ateca", "Arona", "Tarraco", "Toledo", "Altea", "Cordoba"]
    },
    {
        name: "Tofaş",
        models: ["Şahin", "Doğan", "Kartal", "Serçe", "Murat 131", "Murat 124"]
    }
];

async function main() {
    console.log("Seeding Popular Turkey Car Models...");

    const otomobil = await prisma.category.findUnique({
        where: { slug: "otomobil" },
        include: { children: true }
    });

    if (!otomobil) {
        console.log("Otomobil category not found.");
        return;
    }

    // Clean up existing brands to ensure fresh seeding of these specific brands?
    // User wants "complete" list. 
    // Let's UPDATE existing brands with missing models, or Create if not exist.
    // We won't delete everything, just ensure these exist.

    for (const brandData of TURKEY_CARS) {
        let brandCat = await prisma.category.findFirst({
            where: { name: brandData.name, parentId: otomobil.id }
        });

        if (!brandCat) {
            const slug = brandData.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
            brandCat = await prisma.category.create({
                data: {
                    name: brandData.name,
                    slug: slug,
                    parentId: otomobil.id
                }
            });
            console.log(`Created Brand: ${brandData.name}`);
        } else {
            // console.log(`Brand exists: ${brandData.name}`);
        }

        // Models
        for (const modelName of brandData.models) {
            let modelCat = await prisma.category.findFirst({
                where: { name: modelName, parentId: brandCat.id }
            });

            if (!modelCat) {
                const slug = `${brandCat.slug}-${modelName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Math.floor(Math.random() * 1000)}`;
                await prisma.category.create({
                    data: {
                        name: modelName,
                        slug: slug,
                        parentId: brandCat.id
                    }
                });
            }
        }
        console.log(`Processed ${brandData.name}`);
    }

    console.log("Turkey Popular Cars Seeded Successfully!");
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
