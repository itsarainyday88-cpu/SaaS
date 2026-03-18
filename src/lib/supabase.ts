import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[🚨 SaaS Alert] Supabase URL 또는 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

