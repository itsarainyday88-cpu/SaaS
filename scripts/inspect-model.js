const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    if (match) apiKey = match[1].trim();
}

if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not found');
    process.exit(1);
}

async function inspectModel(modelName) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(`--- ${modelName} ---`);
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error fetching ${modelName}:`, e);
    }
}

// Inspect both Nano Banana and Imagen 4
inspectModel('nano-banana-pro-preview');
inspectModel('imagen-4.0-generate-preview-06-06');
