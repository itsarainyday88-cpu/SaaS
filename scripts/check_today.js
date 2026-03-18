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

async function checkTodayDocs() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    console.log(`[Supabase] Checking documents since ${startIso}...`);
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .gte('created_at', startIso)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} documents:`);
        data.forEach((d, i) => {
            console.log(`${i + 1}. [${d.id}] ${d.agent_id} (${d.created_at})`);
        });
    }
}

checkTodayDocs();
