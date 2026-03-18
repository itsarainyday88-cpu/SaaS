const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function injectPro() {
    console.log('--- 🔍 [1단계: 워크스페이스 ID 추적 시작] ---');
    const { data: members, error } = await supabase
        .from('workspace_members')
        .select('workspace_id');

    if (error || !members || members.length === 0) {
        console.error('워크스페이스 추적 실패:', error);
        return;
    }

    const targetId = members[0].workspace_id;
    console.log(`🎯 추적 완료 워크스페이스 ID: [ ${targetId} ]`);

    console.log('--- 🛠️ [2단계: Pro 등급 강제 주입 주사 시전] ---');
    const { error: insertError } = await supabase
        .from('workspace_settings')
        .upsert({
            id: targetId,
            subscription_tier: 'Pro'
        });

    if (insertError) {
        console.error('등급 주입 주사 시전 실패:', insertError);
        return;
    }

    console.log('👑 [등급 패치 정상 연착 완료] -> Pro 격상 마감!');
}

injectPro();
