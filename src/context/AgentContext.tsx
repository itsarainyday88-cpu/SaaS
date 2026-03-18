'use client';

import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type AgentId = 'Marketer' | 'Blog' | 'Insta' | 'Shortform' | 'Threads' | 'Reputation' | 'Analyst' | 'Web_D';
type ViewMode = 'chat' | 'calendar' | 'archive' | 'mypage';

interface AgentContextType {
    activeWorkspaceId: string | null;
    setActiveWorkspaceId: (id: string) => void;
    workspaceList: any[];
    subscriptionTier: string;
    refreshWorkspaceList: () => Promise<void>;

    // 📸 [크레딧 관리 변수]
    subscriptionBalance: number;
    topupBalance: number;
    refreshCredits: () => Promise<void>;

    // 👑 [충전 모달 스위치 격실]
    isChargeModalOpen: boolean;
    setIsChargeModalOpen: (open: boolean) => void;

    // 기존 속성
    activeAgent: AgentId;
    setActiveAgent: (id: AgentId) => void;
    currentView: ViewMode;
    setCurrentView: (view: ViewMode) => void;
    selectedTopic: string;
    setSelectedTopic: (topic: string) => void;
    agentMessagesRef: React.MutableRefObject<Map<string, any[]>>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ 
    children, 
    initialSubscriptionTier = 'Basic' 
}: { 
    children: ReactNode; 
    initialSubscriptionTier?: string; 
}) {
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [workspaceList, setWorkspaceList] = useState<any[]>([]);
    const [subscriptionTier, setSubscriptionTier] = useState<string>(initialSubscriptionTier);

    const [subscriptionBalance, setSubscriptionBalance] = useState<number>(0);
    const [topupBalance, setTopupBalance] = useState<number>(0);
    const [isChargeModalOpen, setIsChargeModalOpen] = useState<boolean>(false); // 👈 글로벌 충전 모달 스위치

    const [activeAgent, setActiveAgent] = useState<AgentId>('Blog');
    const [currentView, setCurrentView] = useState<ViewMode>('chat');
    const [selectedTopic, setSelectedTopic] = useState<string>('');
    const agentMessagesRef = useRef<Map<string, any[]>>(new Map());

    const fetchCredits = async (workspaceId: string) => {
        const { data } = await supabase
            .from('credit_wallets')
            .select('subscription_balance, topup_balance')
            .eq('workspace_id', workspaceId)
            .single();
        if (data) {
            setSubscriptionBalance(data.subscription_balance);
            setTopupBalance(data.topup_balance);
        }
    };

    const fetchWorkspaces = async () => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const { data: members, error } = await supabase
            .from('workspace_members')
            .select('workspace_id, role, workspace_settings(*)')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching workspaces:', error);
            return;
        }

        if (members && members.length > 0) {
            // [📌 조인 구조 안전 추출] 객체 인지 배열 인지 분기 처리 방어선 구축 (폭망 방지)
            const list = members.map((m: any) => {
                const settings = m.workspace_settings;
                return Array.isArray(settings) ? settings[0] : settings;
            }).filter(Boolean);

            setWorkspaceList(list);

            if (list.length > 0 && !activeWorkspaceId) {
                const activeId = list[0].workspace_id || list[0].id;
                setActiveWorkspaceId(activeId);
                setSubscriptionTier(list[0].subscription_tier || 'Basic');
                fetchCredits(activeId); // 배선 명확화
            } else if (activeWorkspaceId && list.length > 0) {
                const active = list.find((w: any) => (w.workspace_id === activeWorkspaceId || w.id === activeWorkspaceId));
                if (active) {
                    setSubscriptionTier(active.subscription_tier || 'Basic');
                    fetchCredits(activeWorkspaceId);
                } else {
                    const fallbackId = list[0].workspace_id || list[0].id;
                    setActiveWorkspaceId(fallbackId);
                    setSubscriptionTier(list[0].subscription_tier || 'Basic');
                    fetchCredits(fallbackId);
                }
            }
        }
    };

    useEffect(() => {
        fetchWorkspaces();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                fetchWorkspaces();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSwitchWorkspace = (id: string) => {
        setActiveWorkspaceId(id);
        const active = workspaceList.find(w => w.id === id);
        if (active) {
            setSubscriptionTier(active.subscription_tier || 'Basic');
            fetchCredits(id); // 스위치 시 크레딧 동기화
        }
    };

    return (
        <AgentContext.Provider            value={{
                activeWorkspaceId,
                setActiveWorkspaceId,
                workspaceList,
                subscriptionTier,
                subscriptionBalance,
                topupBalance,
                isChargeModalOpen, // 👈 밸류 익스포트 배선 주입 완료
                setIsChargeModalOpen,
                refreshWorkspaceList: fetchWorkspaces,
                refreshCredits: () => fetchCredits(activeWorkspaceId || ''),
                activeAgent,
                setActiveAgent,
                currentView,
                setCurrentView,
                selectedTopic,
                setSelectedTopic,
                agentMessagesRef
            }}>
            {children}
        </AgentContext.Provider>
    );
}

export function useAgent() {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider');
    }
    return context;
}
