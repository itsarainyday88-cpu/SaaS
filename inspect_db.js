const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 🔍 1. .env.local 직접 파싱 (fs 이용)
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('환경 변수 직접 파싱 부재 실패');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- 🔍 [전역 워크스페이스 등급 진찰 시작] ---');
    const { data: settings, error } = await supabase
        .from('workspace_settings')
        .select('*');

    if (error) {
        console.error('조회 실패:', error);
        return;
    }

    console.log('📊 [DB 저장 데이터 실물] :');
    console.log(JSON.stringify(settings, null, 2));
}

inspect();
