
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Attempting to connect to DB...");
    try {
        await prisma.$connect();
        console.log("Successfully connected to DB");
        const count = await prisma.category.count();
        console.log("Total categories:", count);
    } catch (error) {
        console.error("Failed to connect:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
