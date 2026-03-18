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

        const { deductCredits } = await import('@/lib/credits');
        const isAdmin = profile.is_admin === true;

        try {
            if (!isAdmin) {
                await deductCredits(profile.workspace_id, agentId); // 🛡️ 에이전트 ID 직결 차감
            } else {
                console.log(`[Admin] Credit deduction bypassed for ${username}`);
            }
        } catch (creditErr: any) {
            console.error('[Credit] Deduction failed:', creditErr.message);
            return NextResponse.json({ 
                error: creditErr.message, 
                code: '402' 
            }, { status: 402 });
        }

        // --- Create a ReadableStream and return it immediately ---
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let fullResponseBuffer = ''; 

                try {
                    const generator = generateAgentResponseStream(agentId, message, history, useSearch, username);

                    for await (const chunk of generator) {
                        const encoded = encoder.encode(chunk);
                        controller.enqueue(encoded);
                        fullResponseBuffer += chunk; 
                    }

                    // --- Cloud Sync: Save to Supabase ---
                    if (fullResponseBuffer.trim().length > 50) {
                        try {
                            const payload = {
                                agent_id: String(agentId),
                                content: fullResponseBuffer,
                                workspace_id: profile.workspace_id, // 🛡️ RLS 보안 해소용 워크스페이스 주착
                                created_at: new Date().toISOString()
                            };

                            const { data: syncResult, error: dbError } = await supabase
                                .from('marketing_outputs') // 🛡️ [마이그레이션] documents -> marketing_outputs
                                .insert([payload])
                                .select();

                            if (dbError) {
                                console.error('[Cloud Sync] DB insert error (marketing_outputs):', dbError.message);
                            } else {
                                console.log(`[Cloud Sync] Document successfully synced. ID: ${syncResult?.[0]?.id}`);
                            }
                        } catch (cloudErr: any) {
                            console.error('[Cloud Sync] Error synchronizing output:', cloudErr.message);
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
