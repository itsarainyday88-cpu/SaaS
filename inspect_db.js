const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// 읽어올 로컬 .env 위치
const envPath = 'c:/Users/Bijou/.gemini/Hames/Sales/SaaS/.env';
const envText = fs.readFileSync(envPath, 'utf-8');

const regexUrl = /NEXT_PUBLIC_SUPABASE_URL=(.+)/;
const regexKey = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/;

const matchUrl = envText.match(regexUrl);
const matchKey = envText.match(regexKey);

if (!matchUrl || !matchKey) {
    console.error('Cannot find Supabase URL/KEY in .env');
    process.exit(1);
}

const supabaseUrl = matchUrl[1].trim();
const supabaseKey = matchKey[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- 🛡️ Supabase 더미데이터 인서트 후 키인출 전수 스캔 ---');
    const emailTest = 'temp_check_schema@example.com';
    
    try {
        // 1. profiles 에 더미 데이터 인서트 시도
        const { data, error } = await supabase
            .from('profiles')
            .upsert({ email: emailTest, username: 'temp_user_test_schema' })
            .select();
            
        if (error) {
             console.log('[profiles] Error:', error.message);
        } else if (data && data.length > 0) {
             console.log('[profiles] ✅ 컬럼 목록:', Object.keys(data[0]).join(', '));
             // 청소
             await supabase.from('profiles').delete().eq('email', emailTest);
        } else {
             console.log('[profiles] ⚠️ 아무런 반환값도 없습니다.');
        }

    } catch (e) {
         console.log('예외 발생:', e.message);
    }
}

inspect();
