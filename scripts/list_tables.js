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

async function listAllTables() {
    console.log('[Supabase] Listing all accessible tables and functions...');

    // We can't directly list tables via the standard client easily without admin, 
    // but we can try common ones or use postgrest metadata if allowed.
    // Let's try to query information_schema if we have permission.

    const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    if (tableError) {
        console.warn('Could not query information_schema.tables:', tableError.message);
    } else {
        console.log('Tables in public schema:', tables.map(t => t.table_name).join(', '));
    }
}

listAllTables();
