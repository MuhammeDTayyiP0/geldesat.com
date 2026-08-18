
const fs = require('fs');

async function transformData() {
    const rawData = JSON.parse(fs.readFileSync('src/lib/data/car_models_full.json', 'utf8'));

    // Transform into a structure we can use in the seed script
    // Or just format it as a TS/JS object for the seed script to import.

    // The format is simply [{"brand": "Name", "models": ["m1", "m2"]}]
    // Our seed script expects { name: string, models: { name: string, sub: string[] }[] }
    // The raw data only has models as strings, no sub-models (trims).
    // That's fine, we will just treat them as leaf models for now.

    const transformed = rawData.map(item => ({
        name: item.brand,
        models: item.models.map(m => ({
            name: m,
            sub: [] // No sub-models in this dataset unfortunately
        }))
    }));

    const output = JSON.stringify(transformed, null, 2);
    fs.writeFileSync('prisma/car_data.json', output);
}

transformData();
