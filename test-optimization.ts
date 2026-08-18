
const { getCategorySubtreeIds } = require("./src/actions/listing");
const { getCategoryAttributesWithInheritance } = require("./src/actions/category");
const { db } = require("./src/lib/db");

async function main() {
    console.log("Starting test...");

    try {
        const categories = await db.category.findMany({ take: 1 });
        if (categories.length === 0) {
            console.log("No categories found to test.");
            return;
        }

        const catId = categories[0].id;
        console.log("Testing with category ID:", catId);

        console.log("Testing getCategorySubtreeIds...");
        const subtree = await getCategorySubtreeIds(catId);
        console.log("Subtree IDs:", subtree);

        console.log("Testing getCategoryAttributesWithInheritance...");
        const attrs = await getCategoryAttributesWithInheritance(catId);
        console.log("Attributes found:", attrs.length);

        console.log("Test passed!");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

main();
