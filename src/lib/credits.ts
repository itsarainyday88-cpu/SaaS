import { supabase } from './supabase';

// [📌 Hardcoded Constants] 대표님 지시 마크 소요 크레딧 가중치
export const CREDIT_COSTS = {
    MARKETER_AGENT: 100,
    BLOG_POST: 40,         // 최종 확정표 가격
    INSTAGRAM_POST: 15,     // 최종 확정표 가격
    SHORT_FORM_SCRIPT: 7,
    THREADS_POST: 5,
    RAG_UPDATE_BASIC: 150, 
    RAG_UPDATE_PRO: 0      
};

/**
 * 🛡️ [크레딧 차감 연산 코어 시스템]
 * 소멸성(Subscription) 먼저 차감 -> 부족 시 충전(Topup) 차감 -> 부족 시 에러 분기
 */
export async function deductCredits(workspaceId: string, agentId: string) {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('decrement_credits', {
        p_workspace_id: workspaceId,
        p_agent_id: agentId
    });

    if (rpcErr || !rpcRes?.success) {
        throw new Error(rpcRes?.error || '크레딧 차감 중 오류가 발생했습니다.');
    }

    console.log(`[Credit] ${agentId} 가동 차감 완료 (RPC 연산 성립)`);
    return { success: true };
}
