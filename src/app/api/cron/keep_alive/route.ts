import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // 1. 보안 체크: Vercel에서 보낸 요청인지 확인합니다.
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized Access', { status: 401 });
    }

    // 2. 슈파베이스 연결 (환경 변수 사용)
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
        // 3. DB에 간단한 신호를 보냅니다 (데이터 1개만 조회)
        const { error } = await supabase.from('documents').select('id').limit(1);

        if (error) throw error;

        return NextResponse.json({ success: true, message: "Supabase is awake!" });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}