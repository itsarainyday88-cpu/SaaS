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

async function testInsert() {
    console.log('[Supabase] Testing insertion into [documents]...');
    const { data, error } = await supabase
        .from('documents')
        .insert([{
            agent_id: 'TestAgent',
            content: 'This is a test content at ' + new Date().toISOString(),
            created_at: new Date().toISOString()
        }])
        .select();

    if (error) {
        console.error('[Supabase] Insert ERROR:', error.message);
        console.error('Code:', error.code);
        console.error('Details:', error.details);
    } else {
        console.log('[Supabase] Insert SUCCESS!');
        console.log('Result:', data);
    }
}

testInsert();
