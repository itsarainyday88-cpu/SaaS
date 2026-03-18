import { createClient } from '@/lib/supabase-server';
import { AgentProvider } from '@/context/AgentContext';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. [정석] 서버 전용 클라이언트 인장 가동
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let initialTier = 'Basic';

    if (user) {
        // 2. [정석] 화면이 켜지기도 전에 데이터베이스에서 등급 선점 조회
        const { data: member } = await supabase
            .from('workspace_members')
            .select('workspace_settings(subscription_tier)')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (member?.workspace_settings) {
            const settings: any = member.workspace_settings;
            const actualSettings = Array.isArray(settings) ? settings[0] : settings;
            
            if (actualSettings?.subscription_tier) {
                initialTier = actualSettings.subscription_tier as string;
            }
        }
    }

    return (
        <AgentProvider initialSubscriptionTier={initialTier}>
            <SidebarLayout>
                {children}
            </SidebarLayout>
        </AgentProvider>
    );
}
