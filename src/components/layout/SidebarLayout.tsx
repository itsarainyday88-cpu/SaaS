'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Users,
    MessageSquare,
    LogOut,
    Sparkles,
    Calendar,
    Library,
    FileText,
    Share2,
    Instagram,
    Code,
    TrendingUp,
    Video,
    CheckCircle,
    ExternalLink,
    User,
    PlusCircle // 👈 플러스 서클 아이콘 보강
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAgent } from '@/context/AgentContext';
import CreditChargeModal from '@/components/credits/CreditChargeModal'; // 👈 충전 모달 임포트

function Sidebar() {
    const { 
        activeAgent, setActiveAgent, currentView, setCurrentView, 
        workspaceList, activeWorkspaceId, setActiveWorkspaceId,
        subscriptionTier, subscriptionBalance, topupBalance,
        isChargeModalOpen, setIsChargeModalOpen // 👈 충전 스위치 격실 가동선 분사
    } = useAgent();
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    const router = useRouter();

    const activeWorkspace = workspaceList.find(w => w.id === activeWorkspaceId);

    // 단독 브랜드 체계 가동선 정착 완료

    useEffect(() => {
        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) setSidebarWidth(parseInt(savedWidth));
    }, []);

    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = mouseMoveEvent.clientX;
            if (newWidth > 250 && newWidth < 800) {
                setSidebarWidth(newWidth);
                localStorage.setItem('sidebarWidth', newWidth.toString());
            }
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const agents = [
        { id: 'Blog', name: 'Blog', role: '원장 직강 전문 라이터', icon: FileText, color: 'text-green-600', bg: 'bg-green-50', desc: '국어/수학 전문 칼럼니스트 및 블로그 컨텐츠 제작' },
        { id: 'Insta', name: 'Insta', role: '비즈니스 비주얼 디렉터', icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50', desc: '수강생 모집 중심 카드뉴스 기획' },
        { id: 'Threads', name: 'Threads', role: '스레드 디렉터', icon: Share2, color: 'text-slate-900', bg: 'bg-slate-100', desc: '짧고 강렬한 텍스트 타래(타이포) 기획' },
        { id: 'Shortform', name: 'Shortform', role: '숏폼/릴스 디렉터', icon: Video, color: 'text-purple-600', bg: 'bg-purple-50', desc: '숏폼 전용 고밀도 대본 생성' },
        { id: 'Marketer', name: 'Marketer', role: '전략가 + 감시관', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', desc: '비즈니스 동향 분석 및 리스크 감시' },
    ];

    return (
        <aside
            className="flex flex-col border-r border-sand/30 bg-white/50 backdrop-blur-sm relative shrink-0"
            style={{ width: `${sidebarWidth}px` }}
        >
            <div onMouseDown={startResizing} className={`absolute right-0 top-0 w-1.5 h-full cursor-col-resize transition-all z-20 flex items-center justify-center ${isResizing ? 'bg-primary/20' : 'hover:bg-primary/10'}`}>
                <div className={`w-[2px] h-12 rounded-full transition-colors ${isResizing ? 'bg-primary' : 'bg-gray-200'}`} />
            </div>
            <div className="p-6 border-b border-sand/30 flex flex-col gap-4">
                <div className="flex justify-between items-center w-full">
                    <button onClick={() => window.location.href = '/'} className="text-left group hover:opacity-70 transition-opacity">
                        <h1 className="text-lg font-serif font-bold text-secondary">Faire Click</h1>
                        <p className="text-xs text-secondary/60 tracking-wider">by Prêt-à-Mode</p>
                    </button>
                    {subscriptionTier === 'Pro' ? (
                        <span className="shrink-0 text-[10px] font-black tracking-widest bg-amber-500 text-white border border-amber-600/20 px-2.5 py-0.5 rounded-full shadow-md animate-fade-in flex items-center gap-1">👑 PRO</span>
                    ) : (
                        <span className="shrink-0 text-[10px] font-black tracking-widest bg-slate-200 text-slate-700 border border-slate-300/40 px-2.5 py-0.5 rounded-full shadow-sm animate-fade-in flex items-center gap-0.5">🛡️ BASIC</span>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="flex bg-sand/20 rounded-lg p-1 gap-1 mb-6">
                    <button onClick={() => setCurrentView('chat')} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'chat' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><MessageSquare className="w-3.5 h-3.5" /> 채팅</button>
                    <button onClick={() => setCurrentView('calendar')} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'calendar' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><Calendar className="w-3.5 h-3.5" /> 캘린더</button>
                    <button onClick={() => setCurrentView('archive')} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'archive' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><Library className="w-3.5 h-3.5" /> 보관함</button>
                    <button onClick={() => setCurrentView('mypage')} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'mypage' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><User className="w-3.5 h-3.5" /> 마이페이지</button>
                </div>
                <div className={`flex flex-col gap-3 transition-opacity ${currentView !== 'chat' ? 'opacity-40 pointer-events-none' : ''}`}>
                    {agents.map((agent) => (
                        <button key={agent.id} onClick={() => setActiveAgent(agent.id as any)} className={`flex items-center gap-5 p-5 rounded-2xl border transition-all text-left group relative ${activeAgent === agent.id ? 'bg-secondary text-primary border-secondary shadow-xl scale-[1.02]' : 'bg-white border-sand/40 hover:bg-sand/5 text-foreground'}`}>
                            <div className={`p-3 rounded-xl shrink-0 ${activeAgent === agent.id ? 'bg-white/20' : `${agent.bg} ${agent.color}`} `}><agent.icon className="w-6 h-6" /></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-black text-[17px] leading-tight">{agent.name}</h3>
                                    {activeAgent === agent.id && <div className="flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" /><span className="w-1.5 h-1.5 rounded-full bg-primary" /></div>}
                                </div>
                                <p className={`text-[12px] font-medium mt-1.5 truncate ${activeAgent === agent.id ? 'text-primary/90' : 'text-foreground/40'}`}>{agent.role}</p>
                            </div>
                        </button>
                    ))}
                </div>
                
                {/* 👑 [크롬 확장프로그램 설치 배너 전격 사출] */}
                <div className="mt-6">
                    <button 
                        onClick={() => window.open('https://chrome.google.com/webstore', '_blank')} 
                        className="w-full bg-gradient-to-r from-amber-400 to-amber-500 text-secondary p-4 rounded-2xl shadow-md hover:scale-[1.02] hover:shadow-lg transition-all text-left relative overflow-hidden group border border-amber-300/20 animate-fade-in"
                    >
                        <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:scale-110 transition-transform">
                            <Sparkles className="w-20 h-20 text-secondary" />
                        </div>
                        <h4 className="text-[14px] font-black tracking-tight flex items-center gap-1.5 text-secondary">
                            <ExternalLink className="w-4 h-4 text-secondary" /> 크롬 확장 프로그램
                        </h4>
                        <p className="text-[11px] text-secondary mt-1 font-black tracking-wide">Faire Click 자동화 도구 설치</p>
                    </button>
                </div>
            </div>
            <div className="p-6 border-t border-sand/30 bg-white/30">
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 transition-colors font-medium text-sm"><LogOut className="w-4 h-4" /> 로그아웃</button>
            </div>

            {/* 👑 [크레딧 충전소 실물 팝업 모달] */}
            <CreditChargeModal 
                isOpen={isChargeModalOpen} 
                onClose={() => setIsChargeModalOpen(false)} 
                tier={subscriptionTier as 'Basic' | 'Pro'} 
            />
        </aside>
    );
}

function Header() {
    const { activeAgent, subscriptionBalance, topupBalance, setIsChargeModalOpen } = useAgent();
    return (
        <div className="absolute top-0 inset-x-0 z-10 p-4 bg-white/80 backdrop-blur border-b border-sand/30 flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="font-mono text-xs font-semibold uppercase text-secondary/80">활성: {activeAgent} 에이전트</span>
            </div>

            {/* 👑 [원장님 지시 우측 상단 크레딧 통합 사출 바 - 프리미엄 세팅] */}
            <div className="flex items-center gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-50/80 to-amber-100/40 px-4 py-2 rounded-2xl border border-amber-200/50 shadow-sm">
                     <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-black shadow-inner shadow-black/10">P</div>
                     <div className="flex flex-col -space-y-0.5">
                          <span className="text-[9px] font-bold text-amber-700/80 tracking-wider">보유 크레딧</span>
                          <span className="text-[15px] font-black text-secondary font-mono">{(subscriptionBalance + topupBalance).toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-0.5">pt</span></span>
                     </div>
                </div>
                <button 
                    onClick={() => setIsChargeModalOpen(true)} 
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white text-[12px] font-black rounded-2xl shadow-md hover:shadow-lg flex items-center gap-1.5 transition-all duration-200 border border-amber-400/20"
                >
                     <PlusCircle className="w-4 h-4" /> 충전
                </button>
            </div>
        </div>
    );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-primary overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col relative overflow-hidden">
                <Header />
                <div className="flex-1 flex flex-col pt-16 min-h-0 overflow-hidden">{children}</div>
            </main>
        </div>
    );
}
