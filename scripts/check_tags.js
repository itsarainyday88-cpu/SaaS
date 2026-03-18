const fs = require('fs');
const path = require('path');

const METADATA_PATH = path.join(process.cwd(), 'public', 'images', 'assets-metadata.json');

function checkTags() {
    const data = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
    const stats = {};

    data.forEach(item => {
        const key = `${item.category}:${item.tag}`;
        stats[key] = (stats[key] || 0) + 1;
    });

    console.log('--- Image Tag Distribution ---');
    Object.entries(stats).sort().forEach(([key, count]) => {
        console.log(`${key}: ${count} images`);
    });
    console.log('------------------------------');
}

checkTags();
