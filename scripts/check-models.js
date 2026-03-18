const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '../.env.local');
let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
        console.log('Loaded GEMINI_API_KEY from .env.local');
    }
}

if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not found in environment or .env.local');
    process.exit(1);
}

// Dynamic import or require based on environment (CommonJS here)
// Note: @google/generative-ai might be ESM only in newer versions.
// If require fails, we will use pure fetch.
let GoogleGenerativeAI;
try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch (e) {
    console.log('SDK require failed, falling back to pure fetch for listing models.');
}

async function listModels() {
    try {
        console.log('Fetching available models...');
        // Note: genAI.getGenerativeModel is for getting a model instance.
        // To list models, we might need to use the API directly if the SDK doesn't expose it easily in this version,
        // BUT the SDK usually has a ModelManager or similar.
        // Actually, for @google/generative-ai, it doesn't have a direct listModels method on the top level client in all versions.
        // Let's try to use the REST API approach for certainty, as it's dependency-free (except node-fetch provided by node 18+).

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log('--- Available Models ---');
            const imageModels = data.models.filter(m => m.supportedGenerationMethods.includes('predict') || m.supportedGenerationMethods.includes('generateImage') || m.name.includes('imagen'));

            console.log(`Total Models: ${data.models.length}`);
            console.log(`Potential Image Models: ${imageModels.length}`);

            imageModels.forEach(m => {
                console.log(`- ${m.name} (${m.version}) [${m.supportedGenerationMethods.join(', ')}]`);
            });

            console.log('--- All Models (Names) ---');
            data.models.forEach(m => console.log(m.name));

        } else {
            console.log('No models found or error structure:', data);
        }

    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();
