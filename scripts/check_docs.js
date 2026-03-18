const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'config.txt');
const configContent = fs.readFileSync(configPath, 'utf8');

const getVal = (key) => {
    const match = configContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getVal('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getVal('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentDocs() {
    console.log('[Supabase] Checking recent 5 documents...');
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching docs:', error.message);
    } else {
        console.log('Recent docs:');
        data.forEach(d => {
            console.log(`- [${d.id}] ${d.agent_id} (${d.created_at})`);
            console.log(`  Content (start): ${d.content.substring(0, 50)}...`);
            console.log('---');
        });
    }
}

checkRecentDocs();
