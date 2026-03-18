const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract config from config.txt
const configPath = path.join(process.cwd(), 'config.txt');
const configContent = fs.readFileSync(configPath, 'utf8');

const getVal = (key) => {
    const match = configContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getVal('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getVal('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase config in config.txt');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log(`[Supabase] Testing connection to ${supabaseUrl}...`);
    try {
        // Try to fetch something simple or just check if the URL is reachable
        const { data, error } = await supabase.from('archive_posts').select('id').limit(1);

        if (error) {
            console.error('[Supabase] Connection failed/Error:', error.message);
            if (error.message.includes('FetchError') || error.message.includes('Failed to fetch')) {
                console.log('--- Likely a network or URL issue ---');
            }
        } else {
            console.log('[Supabase] Connection SUCCESSFUL! Project is reachable.');
            console.log('[Supabase] Samples found:', data.length);
        }
    } catch (err) {
        console.error('[Supabase] Critical Error during test:', err.message);
    }
}

testConnection();
