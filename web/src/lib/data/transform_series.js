
const fs = require('fs');

async function transformData() {
    const rawData = fs.readFileSync('src/lib/data/car_data_2023.csv', 'utf8');
    const lines = rawData.trim().split('\n');
    const headers = lines[0].split(',');

    // Group by Make -> Series/Model
    // Logic: 
    // If model name starts with a number or single letter followed by space/number (e.g. "3 Series", "A4", "X5"), try to group them.
    // Or just filter specifically for BMW/Mercedes/Audi to create "Series" structure.

    const brands = {};

    // Starting from line 1 (skipping header)
    for (let i = 1; i < lines.length; i++) {
        // Simple CSV parse (handling quotes roughly)
        const parts = lines[i].split(',');
        // year, make, model, ...
        const make = parts[1];
        let model = parts[2];

        // Handle "Series" logic for BMW
        // CSV has "3 Series", "5 Series" already! That's great.
        // It also has "M3", "M5" distinct.
        // The user wants "M Serisi" -> "M3", "M5".

        if (!brands[make]) {
            brands[make] = {};
        }

        // Custom Grouping Logic
        let seriesName = null;
        let modelName = model;

        if (make === 'BMW') {
            if (model.includes('Series')) {
                // e.g. "3 Series" -> Series: "3 Serisi", Model: "3 Series" (or specifically 320, 330 but data doesn't have it)
                // This dataset is US centric, so it lacks specific european engines (320d).
                // But it groups by series which is what user wants partially.
                seriesName = model.replace('Series', 'Serisi');
            } else if (model.startsWith('X')) {
                seriesName = 'X Serisi';
            } else if (model.startsWith('M') && !model.includes('Series')) {
                seriesName = 'M Serisi';
            } else if (model.startsWith('i')) {
                seriesName = 'i Serisi';
            }
        } else if (make === 'Mercedes-Benz') {
            // C-Class, E-Class in data?
            // Let's check format. It says "C-Class", "E-Class".
            if (model.includes('-Class')) {
                seriesName = model.replace('-Class', ' Serisi');
            } else if (model.startsWith('GL')) {
                seriesName = 'GL Serisi';
            }
        } else if (make === 'Audi') {
            if (model.match(/^A\d/)) {
                seriesName = model.substring(0, 2) + ' Serisi';
            } else if (model.match(/^Q\d/)) {
                seriesName = 'Q Serisi';
            }
        }

        if (seriesName) {
            if (!brands[make][seriesName]) {
                brands[make][seriesName] = [];
            }
            // Avoid duplicates
            if (!brands[make][seriesName].includes(modelName)) {
                brands[make][seriesName].push(modelName);
            }
        } else {
            // No series group, just direct model
            // We can put them under "Diğer" or just as root models
            if (!brands[make]['Modeller']) brands[make]['Modeller'] = [];
            brands[make]['Modeller'].push(modelName);
        }
    }

    // Convert to target array structure
    const outputList = Object.keys(brands).map(brandName => {
        const series = Object.keys(brands[brandName]).map(sName => ({
            name: sName,
            // These are "Models" under the series
            sub: brands[brandName][sName]
        }));

        return {
            name: brandName,
            models: series // Our "models" field in seed script acts as the children (Series level)
        };
    });

    const output = JSON.stringify(outputList, null, 2);
    fs.writeFileSync('prisma/car_data_series.json', output);
}

transformData();
