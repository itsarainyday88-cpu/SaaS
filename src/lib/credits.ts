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
export async function deductCredits(workspaceId: string, action: keyof typeof CREDIT_COSTS) {
    const cost = CREDIT_COSTS[action];
    
    // 0 크레딧 소모는 다이렉트 패스
    if (cost === 0) return { success: true, message: 'Free Action' };

    // 1. 현재 소유 크레딧 잔액 투시 호출
    const { data: wallet, error: walletError } = await supabase
        .from('credit_wallets')
        .select('id, subscription_balance, topup_balance')
        .eq('workspace_id', workspaceId)
        .single();

    if (walletError || !wallet) {
        console.error('[Credit] Wallet not found for Workspace:', workspaceId);
        throw new Error('크레딧 지갑을 찾을 수 없습니다. 관리자에게 문의하세요.');
    }

    let currentSub = wallet.subscription_balance;
    let currentTopup = wallet.topup_balance;

    const totalAvailable = currentSub + currentTopup;

    // 2. 전량 잔액 부족 시 402 에러 대응형 분기 폭격
    if (totalAvailable < cost) {
        throw new Error(`크레딧이 부족합니다. (필요: ${cost} / 보유: ${totalAvailable})`);
    }

    // 3. 차감 순위 정밀 분기 연산
    if (currentSub >= cost) {
        // 소멸성에서 100% 처리 가능
        currentSub -= cost;
    } else {
        // 소멸성 털어내고 충전성에서 누수 차감
        const remainder = cost - currentSub;
        currentSub = 0;
        currentTopup -= remainder;
    }

    // 4. DB 일괄 트랜잭션 주차 (Wallet 업데이트 + 로그 삽입)
    const { error: updateError } = await supabase
        .from('credit_wallets')
        .update({
            subscription_balance: currentSub,
            topup_balance: currentTopup,
            updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id);

    if (updateError) {
        throw new Error(`크레딧 차감 실패: ${updateError.message}`);
    }

    // 로그 기록 폭격 (비동기로 가볍게 던져도 무방하지만 정석 동기화 유도)
    await supabase.from('credit_logs').insert([{
        workspace_id: workspaceId,
        action_type: action,
        amount: -cost,
        balance_after_sub: currentSub,
        balance_after_topup: currentTopup
    }]);

    console.log(`[Credit] ${action} 차감 완료 (-${cost}p). 남은잔액 [Sub: ${currentSub} / Topup: ${currentTopup}]`);
    return { success: true, remaining: { sub: currentSub, topup: currentTopup } };
}
