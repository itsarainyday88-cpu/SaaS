import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('Login Request Body:', { ...body, password: '***' });
        const { username, password } = body;

        // 1. [정석] 서버 전용 클라이언트 생성
        const supabase = await createClient();

        // 2. [정석] 데이터베이스에서 아이디에 매칭되는 이메일 동적 조회
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', username)
            .single();

        const email = profile?.email || (username.includes('@') ? username : `${username}@example.com`);

        // 3. Supabase Auth로 로그인 시도 (쿠키 자동 인가)
        let { data, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (authError || !data.session) {
            console.error('Auth error:', authError?.message);
            return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
        }

        // ❌ 기존 app 전용 세션(login()) 소거: 공식 SSR이 자동으로 쿠킹을 담당합니다.


        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Login API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
