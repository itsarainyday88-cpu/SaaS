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

async function inspectArchivePosts() {
    console.log('[Supabase] Inspecting [archive_posts] columns via RPC or metadata...');
    // Try to find if there are any columns by trying a dummy select
    const { data, error } = await supabase.from('archive_posts').select('*').limit(1);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Archive Posts table is accessible.');
        // If data is empty, we can't see columns this way if they are empty
        // But we can try to find the RPC definition if we have a way.
    }
}

inspectArchivePosts();
