import { NextResponse } from 'next/server';
import { generateAgentResponseStream } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { agentId, message, history, useSearch }: any = body;

        const session = await getSession();
        const username = session?.username || '';

        if (!agentId || !message) {
            return NextResponse.json({ error: 'Missing activeAgent or message' }, { status: 400 });
        }

        // --- [📸 3단계 파이프라인: 크레딧 선행 차감 연산 트랜잭션 탑재] ---
        const { data: profile } = await supabase
            .from('profiles')
            .select('workspace_id, is_admin') // 📌 is_admin 신설 컬럼 리딩
            .eq('username', username)
            .single();

        if (!profile?.workspace_id) {
            return NextResponse.json({ error: '인증된 워크스페이스를 찾을 수 없습니다.' }, { status: 400 });
        }

        const { deductCredits, CREDIT_COSTS } = await import('@/lib/credits');
        
        // 에이전트 ID 와 차감 상수 매핑
        let creditAction: keyof typeof CREDIT_COSTS = 'BLOG_POST'; 
        if (agentId === 'Marketer') creditAction = 'MARKETER_AGENT';
        else if (agentId === 'Blog') creditAction = 'BLOG_POST';
        else if (agentId === 'Insta') creditAction = 'INSTAGRAM_POST';
        else if (agentId === 'Shortform') creditAction = 'SHORT_FORM_SCRIPT';
        else if (agentId === 'Threads') creditAction = 'THREADS_POST';

        const isAdmin = profile.is_admin === true; // 👑 DB 격실 기반 철통 배선 전환완료

        try {
            if (!isAdmin) {
                await deductCredits(profile.workspace_id, creditAction);
            } else {
                console.log(`[Admin] Credit deduction bypassed for ${username}`);
            }
        } catch (creditErr: any) {
            console.error('[Credit] Deduction failed:', creditErr.message);
            // 잔액 부족 등 에러 발생 시 402 반환하여 결제 유도
            return NextResponse.json({ 
                error: creditErr.message, 
                code: '402' 
            }, { status: 402 });
        }

        // --- Create a ReadableStream and return it immediately ---
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let fullResponseBuffer = ''; // Buffer to capture the main agent's output

                try {
                    // [Stage 1] Main Agent Generation
                    // Generate chunks using our Gemini wrapper
                    const generator = generateAgentResponseStream(agentId, message, history, useSearch, username);

                    for await (const chunk of generator) {
                        const encoded = encoder.encode(chunk);
                        controller.enqueue(encoded);
                        fullResponseBuffer += chunk; // Accumulate for review
                    }

                    // --- Auto-Save Logic (Local MD file) ---
                    if (fullResponseBuffer.trim().length > 50) {
                        try {
                            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                            const baseDir = process.env.APPDATA || process.env.USERPROFILE || process.cwd();
                            const outDir = path.join(baseDir, 'SeoulYonsei_Data', 'outputs');
                            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                            const fileName = `${agentId}_${dateStr}.md`;
                            fs.writeFileSync(path.join(outDir, fileName), fullResponseBuffer, 'utf8');
                            console.log(`[Auto-Save] Document saved to ${outDir}/${fileName}`);
                        } catch (saveErr: any) {
                            console.error('[Auto-Save] Error saving document:', saveErr.message);
                        }
                    }

                    // --- Cloud Sync: Save to Supabase (Always or Lite) ---
                    if (fullResponseBuffer.trim().length > 50) {
                        try {
                            const payload = {
                                agent_id: String(agentId),
                                content: fullResponseBuffer,
                                created_at: new Date().toISOString()
                            };
                            console.log('[Cloud Sync] Attempting Supabase insert into [documents]...', { agent: payload.agent_id, length: payload.content.length });

                            try {
                                const { data: syncResult, error: dbError } = await supabase
                                    .from('documents')
                                    .insert([payload])
                                    .select();

                                if (dbError) {
                                    console.error('[Cloud Sync] DB insert error (documents):', dbError.message, dbError.code, dbError.details);
                                } else {
                                    console.log(`[Cloud Sync] Document successfully synced to Supabase. ID: ${syncResult?.[0]?.id}`);
                                }
                            } catch (syncErr: any) {
                                console.error('[Cloud Sync] Supabase sync unexpected error:', syncErr.message);
                            }
                        } catch (cloudErr: any) {
                            console.error('[Cloud Sync] Error preparing cloud sync:', cloudErr.message);
                        }
                    }

                    controller.close();
                } catch (error: any) {
                    console.error('Streaming Error:', error);
                    controller.error(error);
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (error: any) {
        console.error('------- CHAT API ERROR -------');
        console.error('Agent ID:', (req as any).body?.agentId);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('------------------------------');

        return NextResponse.json({
            error: `Server Error: ${error.message || 'Unknown error'}`
        }, { status: 500 });
    }
}
