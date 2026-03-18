import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { content } = await req.json();
        if (!content || content.trim() === '') {
            return NextResponse.json({ error: '내용(content)이 필요합니다.' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. 현재 로그인한 사용자의 workspace_id 조회
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('workspace_id')
            .single();

        if (profileError || !profile?.workspace_id) {
            return NextResponse.json({ error: '사용자 프로필 또는 비즈니스 정보를 찾을 수 없습니다.' }, { status: 403 });
        }

        const workspaceId = profile.workspace_id;

        // 2. [📸 5단계 파이프라인]: RAG 수정 제한 크래딧 연산 가동
        const { data: settings, error: settingsError } = await supabase
            .from('workspace_settings')
            .select('context_updated_at, subscription_tier, rag_update_count_month')
            .eq('workspace_id', workspaceId)
            .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
             return NextResponse.json({ error: '설정 조회 중 오류가 발생했습니다.' }, { status: 500 });
        }

        const tier = settings?.subscription_tier || 'Basic';
        const ragCount = settings?.rag_update_count_month || 0;

        if (tier === 'Basic') {
            const { deductCredits } = await import('@/lib/credits');

            if (ragCount > 0) {
                try {
                    // 베이집 유저 2회차 이상 수정: 150 크레딧 차감 타설
                    await deductCredits(workspaceId, 'RAG_UPDATE_BASIC');
                } catch (creditErr: any) {
                    return NextResponse.json({ 
                        error: creditErr.message + " (베이직 요금제는 월 1회 무료 이후 회당 150p가 소모됩니다.)", 
                        code: '402' 
                    }, { status: 402 });
                }
            } else {
                // 베이직 유저 1회차 무료: 카운트 가중 증가
                await supabase
                    .from('workspace_settings')
                    .update({ rag_update_count_month: 1 })
                    .eq('workspace_id', workspaceId);
                    
                console.log(`[RAG Update] Basic tier first free update used for ${workspaceId}`);
            }
        } else {
            console.log(`[RAG Update] Pro tier unlocked edit for ${workspaceId}`);
        }

        // 3. RAG 가동을 위한 Embedding 생성
        const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const embedResult = await embeddingModel.embedContent(content);
        const embedding = embedResult.embedding.values;

        // 4. Supabase 연동 저장 (archive_posts 테이블에 insert 및 context_updated_at update)
        // 트랜잭션 개념으로 연이어 실행
        const { error: insertError } = await supabase
            .from('archive_posts')
            .insert({
                workspace_id: workspaceId,
                content: content,
                embedding: embedding,
                metadata: { type: 'manual_context_update' }
            });

        if (insertError) {
            return NextResponse.json({ error: `데이터 저장 실패: ${insertError.message}` }, { status: 500 });
        }

        // 5. 마지막 수정일 타임스탬프 갱신
        const { error: updateError } = await supabase
            .from('workspace_settings')
            .upsert({
                workspace_id: workspaceId,
                context_updated_at: new Date().toISOString()
            });

        if (updateError) {
            return NextResponse.json({ error: `타임스탬프 갱신 실패: ${updateError.message}` }, { status: 500 });
        }

        return NextResponse.json({ ok: true, message: '배경지식이 성공적으로 저장 및 분할 분석되었습니다.' });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();

        // 로그인 사용자 신원 조회
        const { data: profile } = await supabase
            .from('profiles')
            .select('workspace_id')
            .single();

        if (!profile?.workspace_id) {
             return NextResponse.json({ context: null });
        }

        // 최신 컨텍스트 순서대로 조회
        const { data: posts } = await supabase
            .from('archive_posts')
            .select('content, created_at')
            .eq('workspace_id', profile.workspace_id)
            .order('created_at', { ascending: false })
            .limit(5);

        return NextResponse.json({ context: posts || [] });
    } catch (e: any) {
        return NextResponse.json({ context: null });
    }
}

