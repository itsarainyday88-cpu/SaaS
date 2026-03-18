import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const email = formData.get('email') as string;

        if (!files || files.length === 0 || !email) {
            return NextResponse.json({ error: '필수 데이터가 유실되었습니다.' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. 가입된 유저의 workspace_id 선 복제 및 조율
        const { data: profile } = await supabase
            .from('profiles')
            .select('workspace_id, is_admin') // 📌 is_admin 플래그 추가 조회
            .eq('email', email)
            .single();

        if (!profile?.workspace_id) {
             return NextResponse.json({ error: '사용자 프로필을 연동할 수 없습니다.' }, { status: 403 });
        }

        const workspaceId = profile.workspace_id;
        const isAdmin = profile.is_admin === true; // 👑 DB 기반 보안선 대체완료

        // 2. 루프를 돌며 파일 용량 검증 및 추출 적재
        for (const file of files) {
            // 용량 상한선 설정 (관리자는 무제한, 일반은 5MB)
            const MAX_SIZE = isAdmin ? Infinity : 5 * 1024 * 1024; 
            if (file.size > MAX_SIZE) {
                return NextResponse.json({ error: `[용량 초과] 파일당 최대 ${isAdmin ? '무제한' : '5MB'} 까지만 업로드 가능합니다.` }, { status: 400 });
            }

            const buffer = await file.arrayBuffer();
            let textContent = '';

            try {
                if (file.type === 'application/pdf') {
                    // [📸 AI 다이렉트 PDF 추출] 신형 SDK 3.1 라인업 적용
                    const res = await ai.models.generateContent({
                        model: 'gemini-3.1-pro-preview',
                        contents: [
                            {
                                inlineData: {
                                    data: Buffer.from(buffer).toString('base64'),
                                    mimeType: 'application/pdf'
                                }
                            },
                            "이 PDF 문서 내용에서 읽을 수 있는 모든 정보와 텍스트를 원문 그대로 남김없이 텍스트로 추출하여 출력해라."
                        ]
                    });
                    textContent = res.text || ''; 
                } else {
                    textContent = Buffer.from(buffer).toString('utf-8');
                }

                if (textContent.trim().length < 10) continue;

                // 3. Embedding 추출 (신형 SDK v2 구조)
                const embedResult = await ai.models.embedContent({
                    model: 'text-embedding-004', // 최신 임베딩 엔진
                    contents: textContent
                });
                
                // 신형 SDK 반환 구조 대응 (embedding 또는 embeddings)
                const embedding = (embedResult as any).embedding?.values || (embedResult as any).embeddings;

                // 4. Archive_Posts 에 학습 자산 주입
                await supabase
                    .from('archive_posts')
                    .insert({
                        workspace_id: workspaceId,
                        content: textContent,
                        embedding: embedding,
                        metadata: { 
                            type: 'onboarding_file',
                            filename: file.name
                        }
                    });

            } catch (parseError) {
                console.error(`File parse error for ${file.name}:`, parseError);
            }
        }

        return NextResponse.json({ ok: true, message: 'RAG 학습 자료 적재 완료' });

    } catch (e: any) {
        console.error('Onboarding upload error:', e);
        return NextResponse.json({ error: e.message || '서버 가공 실패' }, { status: 500 });
    }
}
