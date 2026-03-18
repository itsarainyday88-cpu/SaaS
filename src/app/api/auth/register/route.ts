import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Client 혹 서버용 Client 로드
import { codeStore } from '@/lib/memory-store';

export async function POST(request: Request) {
    try {
        const { 
            email, username, password, code,
            industry, businessName, facts, philosophy, toneStyle, isCertified,
            di, // 👈 [본인인증 고유값] DI 변수 수용 격상 (어뷰징 방지 극대화)
            tier 
        } = await request.json();

        // 1. 보안용 이메일 인증코드 최종 검증
        const record = await codeStore.get(email);
        if (!record || record.code !== code) {
            return NextResponse.json({ error: '인증 세션이 만료되었거나 올바르지 않습니다.' }, { status: 400 });
        }

        // 🛡️ [원장님 지시 4번] 중복 계정명(username) 사전 검증 격실
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .maybeSingle(); // 👈 error-safe 한 maybeSingle 전환

        if (existingUser) {
            return NextResponse.json({ error: '이미 사용 중인 계정명입니다.' }, { status: 400 });
        }

        // 2. Supabase Auth로 회원 생성 (credentials 적재)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    name: username
                }
            }
        });

        if (authError || !authData.user) {
            return NextResponse.json({ error: `회원가입 실패: ${authError?.message}` }, { status: 400 });
        }

        const userId = authData.user.id;

        // 3단계: workspaces 테이블에 테넌트를 먼저 생성하여 정식 UUID(고유키) 확보
        const { data: workspaceData, error: workspaceError } = await supabase
            .from('workspaces')
            .insert({
                name: businessName || '새 비즈니스',
                subdomain: `${username || userId.substring(0, 5)}.faireclick.com`
            })
            .select('id')
            .single();

        if (workspaceError) {
            console.error('Workspaces insert error:', workspaceError);
            return NextResponse.json({ error: `비즈니스 생성 실패: ${workspaceError.message}` }, { status: 500 });
        }

        const workspaceId = workspaceData.id;

        // 4단계: Profiles 테이블에 사용자 프로파일 적재
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                username: username,
                email: email,
                workspace_id: workspaceId
            });

        if (profileError) {
             console.error('Profile insert error:', profileError);
             return NextResponse.json({ error: `프로필 생성 실패: ${profileError.message}` }, { status: 500 });
        }

        // 4.5 단계: Workspace_Members 테이블에 소속 연동 적재 (매핑)
        const { error: memberError } = await supabase
            .from('workspace_members')
            .insert({
                user_id: userId,
                workspace_id: workspaceId,
                role: 'owner'
            });

        if (memberError) {
             console.error('Workspace Member insert error:', memberError);
             return NextResponse.json({ error: `비즈니스 소유권 지정 실패: ${memberError.message}` }, { status: 500 });
        }

        // 5단계: Workspace_Settings 테이블에 온보딩 메타데이터 적재
        const { error: settingsError } = await supabase
            .from('workspace_settings')
            .insert({
                workspace_id: workspaceId,
                brand_facts: facts,
                philosophy: philosophy,
                subscription_tier: tier || 'Basic',
                tone_style: toneStyle ? (Array.isArray(toneStyle) ? toneStyle.join(', ') : toneStyle) : ''
            });

        if (settingsError) {
             console.error('Settings insert error:', settingsError);
             return NextResponse.json({ error: `설정 저장 실패: ${settingsError.message}` }, { status: 500 });
        }

        // --- [🛡️ 재가입 판독 마스터 파이프라인 고도화] ---
        let isReRegister = false;

        if (di) {
            // 1순위: DI(Duplicate Information) 기반 물리 거주지 중복 판독
            const { data: pastCertByDi } = await supabase
                .from('certified_history')
                .select('id')
                .eq('di', di)
                .maybeSingle();
            if (pastCertByDi) isReRegister = true;
        } else {
            // 2순위: Email 기반 차선책 탐색 (DI 부재 시)
            const { data: pastCertByEmail } = await supabase
                .from('certified_history')
                .select('email')
                .eq('email', email)
                .maybeSingle();
            if (pastCertByEmail) isReRegister = true;
        }

        // 👑 [요구사항 가이드 가동] Pro = 2700P / Basic = 1000P 기초 타설량 자동 맵핑
        const initialQuota = tier === 'Pro' ? 2700 : 1000;

        // 6단계: Credit Wallet 생성 및 웰컴 포인트 지급 (첫 인증 시에만 150 pt / 재가입 or 미인증 시 0 pt)
        const { error: walletError } = await supabase
            .from('credit_wallets')
            .insert({
                workspace_id: workspaceId,
                subscription_balance: initialQuota + ((isCertified && !isReRegister) ? 150 : 0),
                topup_balance: 0,
                subscription_renewal_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
            });

        if (walletError) {
             console.error('Wallet insert error:', walletError);
             return NextResponse.json({ error: `크레딧 지갑 생성 실패: ${walletError.message}` }, { status: 500 });
        }

        // 인증 이력 영구 기록 (최초 인증 가입자만)
        if (isCertified && !isReRegister) {
            await supabase.from('certified_history').insert({ 
                email: email,
                di: di || null // 👈 DI 값 함께 보존
            });
        }

        // 사용한 인증코드 소모
        await codeStore.delete(email);


        return NextResponse.json({ 
            success: true, 
            message: '회원가입 및 비즈니스 설정이 완료되었습니다.',
            workspaceId: workspaceId
        });

    } catch (error: any) {
        console.error('------- REGISTER API ERROR -------');
        console.error('Error Message:', error.message);
        return NextResponse.json({ error: `서버 오류: ${error.message}` }, { status: 500 });
    }
}
