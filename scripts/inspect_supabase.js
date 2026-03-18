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

async function inspectTables() {
    console.log('[Supabase] Inspecting tables...');

    // List of potential tables to check
    const tables = ['documents', 'archive_posts', 'posts', 'users', 'logs', 'metadata'];

    for (const table of tables) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                if (error.code === '42P01') {
                    console.log(`- Table [${table}]: Does NOT exist.`);
                } else {
                    console.log(`- Table [${table}]: Exists but error: ${error.message} (${error.code})`);
                }
            } else {
                console.log(`- Table [${table}]: EXISTS. (Rows: ${count})`);

                // Try to get one row to see columns
                const { data: firstRow } = await supabase.from(table).select('*').limit(1);
                if (firstRow && firstRow.length > 0) {
                    console.log(`  Columns: ${Object.keys(firstRow[0]).join(', ')}`);
                } else {
                    console.log(`  Columns: (No data to infer columns)`);
                }
            }
        } catch (err) {
            console.error(`Error checking ${table}:`, err.message);
        }
    }
}

inspectTables();
