
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleGenAI } from '@google/genai';

// [📌 최신 신형 SDK 및 전용 모델 가설 탑재]
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const agentId = formData.get('agentId') as string || 'Unknown';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();

        // 1. 정밀 Vision 분석 수행 (최신 신형 SDK 호환 구문)
        let analysisContent = `[File Analysis Prepared: ${file.name}]`;
        if (file.type.startsWith('image/')) {
            try {
                const base64Data = Buffer.from(buffer).toString('base64');
                
                const result = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: [
                        "이 이미지의 내용을 상세히 설명해주세요. 특히 비즈니스 홍보나 브랜딩을 위한 블로그/인스타 포스팅에 활용할 수 있도록 시각적 요소, 분위기, 텍스트, 디자인 등을 구체적으로 분석하세요. 한국어로 답변하세요.",
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: file.type,
                            },
                        },
                    ]
                });
                
                analysisContent = `[Image Description]:\n${result.text}`;
            } catch (vError) {
                console.error('Vision analysis failed with 3.1:', vError);
                // 분석 실패 시에도 업로드는 진행
            }
        }

        // 2. 파일명 안전하게 변환 (한글/특수문자 제거하여 URL 깨짐 방지)
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'jpg';
        const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`;

        // 3. Supabase Storage 업로드
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('assets')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            console.error('[Supabase Storage Error]:', uploadError);
            return NextResponse.json({
                error: `저장소 업로드 실패: ${uploadError.message}. 'assets' 버킷을 확인해주세요.`
            }, { status: 500 });
        }

        // 4. Public URL 생성
        const { data: { publicUrl } } = supabase.storage
            .from('assets')
            .getPublicUrl(fileName);

        // 5. DB 기록
        const { data: assetData, error: dbError } = await supabase
            .from('assets')
            .insert([{
                file_name: file.name,
                file_type: file.type,
                storage_path: uploadData.path,
                public_url: publicUrl,
                agent_id: agentId,
                metadata: {
                    size: file.size,
                    analysis: analysisContent
                }
            }])
            .select()
            .single();

        return NextResponse.json({
            text: analysisContent,
            url: publicUrl,
            name: file.name,
            assetId: assetData?.id
        });

    } catch (error: any) {
        console.error('File processing error:', error);
        return NextResponse.json({ error: `파일 처리 실패: ${error.message}` }, { status: 500 });
    }
}
