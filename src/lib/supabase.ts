import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'build-dummy-key';

if (supabaseUrl === 'https://build-dummy.supabase.co') {
    console.warn('[🚨 SaaS Alert] Supabase URL 또는 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

