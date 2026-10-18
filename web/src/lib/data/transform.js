
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('src/lib/data/turkey_full.json', 'utf8'));

// Transform to { id, name, districts } grouped by city
const cityMap = {};

data.forEach(item => {
    // Some entries are "MERKEZ" which usually duplicates functionality or is the central district
    // But in this dataset, MERKEZ seems to list the central district. 
    // Let's filter out "MERKEZ" as a district name if we want, or keep it.
    // Actually, looking at the data, "MERKEZ" appears as a district for every city. 
    // In Turkey, the central district often has the name of the city (e.g. Adana -> Seyhan, Yüreğir are central but Adana doesn't have "Merkez" district usually in address drop downs, it's specific districts).
    // Let's keep all districts for now.

    // Normalize city name (e.g. ADANA -> Adana)
    const cityName = item.il.toLocaleLowerCase('tr').split(' ').map(s => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1)).join(' ');

    if (!cityMap[cityName]) {
        cityMap[cityName] = {
            id: item.plaka,
            name: cityName,
            districts: []
        };
    }

    const districtName = item.ilce.toLocaleLowerCase('tr').split(' ').map(s => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1)).join(' ');

    // Avoid "Merkez" if it's just a placeholder, but some cities do use it. 
    // Let's keep it but maybe users might prefer specific central districts.
    if (!cityMap[cityName].districts.includes(districtName)) {
        cityMap[cityName].districts.push(districtName);
    }
});

const result = Object.values(cityMap).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

const output = `export const TURKEY_CITIES = ${JSON.stringify(result, null, 2)};`;

fs.writeFileSync('src/lib/data/locations.ts', output);
console.log('Done!');
