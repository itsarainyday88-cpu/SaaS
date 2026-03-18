import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAgentResponseStream } from '@/lib/gemini';
import { createClient } from '@supabase/supabase-js'; // 🛡️ 서비스 롤 우회용 클라이언트 분할 적재 가설

// Vercel Cron 인프라에서 RLS를 우회하여 모든 사용자 일정을 스캔하기 위한 Admin 클라이언트 생성
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 🛡️ Admin 클라이언트가 없으면 기존 anon 클라이언트를 fallback 시킵니다.
const supabaseAdmin = serviceRoleKey 
    ? createClient(supabaseUrl, serviceRoleKey) 
    : supabase;

// 이 API는 매일 00:00 UTC (KST 오전 9시 정각)에 Vercel Cron 인프라에 의해 자동 호출됩니다.
export async function GET(request: Request) {
    // 1. 보안 인가 (Vercel Cron Secret 검증)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    try {
        // 2. KST 기준 오늘 날짜 (YYYY-MM-DD) 자동 추출
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
        console.log(`[Autopilot Engine] KST Date: ${todayStr} - 클라우드 스캔 시작`);

        // 3. 오늘 날짜(또는 밀린 과거 내역 포함)에 예약된 'planned' 상태의 캘린더 일정 불러오기 (Admin 권한 구동)
        const { data: tasks, error } = await supabaseAdmin
            .from('calendar')
            .select('*')
            .eq('status', 'planned')
            .filter('work_date', 'lte', todayStr);

        if (error) {
            console.error('[Autopilot] Database Query Error:', error);
            throw error;
        }

        if (!tasks || tasks.length === 0) {
            console.log('[Autopilot] 오늘 처리할 예약 작업이 없습니다.');
            return NextResponse.json({ message: 'No tasks to run today.', targetDate: todayStr });
        }

        console.log(`[Autopilot] 총 ${tasks.length}개의 작업을 발견했습니다. 무인(Autopilot) 처리를 시작합니다.`);

        const results = [];

        // 4. 각 작업별로 백그라운드 AI 스트림 엔진 가동
        for (const task of tasks) {
            console.log(`[Autopilot] 작업 처리 중... ID: ${task.id}, Agent: ${task.agent_id}, Workspace: ${task.workspace_id}`);
            try {
                const agentId = task.agent_id;
                const workspaceId = task.workspace_id; // 👈 워크스페이스 식별자 확보
                
                // 에이전트에게 캘린더 예약 작업임을 명확히 인지시키는 자율 프롬프트
                const message = `[오토파일럿 예약 작업]\n주제: ${task.topic}\n위 예약 주제에 맞춰 대표님의 캘린더 지시대로 완벽한 콘텐츠를 작성해주세요.`;

                // 오토파일럿에서는 검색과 트렌드 분석을 무조건 허용하여 퀄리티를 극대화
                const useSearch = true;

                if (!workspaceId) {
                    throw new Error('Task holds no workspaceId reference - skipping content generation');
                }

                // AI 콘텐츠 스트림 생성 시 workspaceId 인가 (동적 팩트 로딩 확보)
                const generator = generateAgentResponseStream(agentId, message, [], useSearch, '', workspaceId);
                let fullResponse = '';

                // 스트림 청크를 하나의 문자열 블록으로 결합
                for await (const chunk of generator) {
                    fullResponse += chunk;
                }

                if (fullResponse.trim().length > 50) {
                    // 성공 시 결과를 보관함(marketing_outputs) 테이블에 Insert하여 자고 일어나면 보이게 함
                    const { error: dbError } = await supabaseAdmin
                        .from('marketing_outputs') // 🛡️ [마이그레이션] documents -> marketing_outputs
                        .insert([{
                            agent_id: String(agentId),
                            content: fullResponse,
                            workspace_id: workspaceId, // 👈 다중 유저 격리 차수 맵핑 확보
                            created_at: new Date().toISOString()
                        }]);

                    if (dbError) throw dbError;

                    // 해당 캘린더 일정의 상태를 '생성 완료(generated)'로 업데이트 처리
                    const { error: updateError } = await supabaseAdmin
                        .from('calendar')
                        .update({ status: 'generated' })
                        .eq('id', task.id);

                    if (updateError) throw updateError;

                    console.log(`[Autopilot] 작업 완료 및 클라우드 보관함 적재 성공: ${task.agent_id}`);
                    results.push({ id: task.id, topic: task.topic, status: 'success' });
                } else {
                    console.log(`[Autopilot] 생성된 콘텐츠가 너무 짧아 실패 처리: ${task.agent_id}`);
                    results.push({ id: task.id, status: 'failed_empty_content' });
                }

            } catch (taskErr: any) {
                console.error(`[Autopilot] Task ${task.id} failed:`, taskErr);
                results.push({ id: task.id, status: 'error', error: taskErr.message });
            }
        } // End of task loop

        // 전체 자동화 수율 반환
        return NextResponse.json({
            message: 'Autopilot completed successfully',
            targetDate: todayStr,
            results
        });


    } catch (e: any) {
        console.error('[Autopilot Engine] Critical Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
