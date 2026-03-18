'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Users,
    MessageSquare,
    MessageCircle, // 💬 카카오톡용 아이콘 추가
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

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { 
        activeAgent, setActiveAgent, currentView, setCurrentView, 
        workspaceList, activeWorkspaceId, setActiveWorkspaceId,
        subscriptionTier, subscriptionBalance, topupBalance,
        isChargeModalOpen, setIsChargeModalOpen 
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
            className={`flex flex-col border-r border-sand/30 bg-white md:bg-white/50 backdrop-blur-sm shrink-0 
                        fixed md:relative inset-y-0 left-0 z-40 md:z-10 transition-transform duration-300 transform
                        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}
            style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '280px' : `${sidebarWidth}px`, maxWidth: '100%' }}
        >
            <div onMouseDown={startResizing} className={`absolute right-0 top-0 w-1.5 h-full cursor-col-resize transition-all z-20 flex items-center justify-center md:flex ${isResizing ? 'bg-primary/20' : 'hover:bg-primary/10'} hidden`}>
                <div className={`w-[2px] h-12 rounded-full transition-colors ${isResizing ? 'bg-primary' : 'bg-gray-200'}`} />
            </div>
            <div className="p-6 border-b border-sand/30 flex flex-col gap-4">
                <div className="flex justify-between items-center w-full">
                    <button onClick={() => window.location.href = '/'} className="text-left group hover:opacity-70 transition-opacity">
                        <h1 className="text-lg font-serif font-bold text-secondary">Faire Click</h1>
                        <p className="text-xs text-secondary/60 tracking-wider">by Prêt-à-Mode</p>
                    </button>
                    {subscriptionTier === 'Pro' ? (
                        <span className="flex items-center gap-1.5 bg-secondary text-amber-500 text-[11px] px-3 py-1 rounded-full font-black border border-amber-500/40 shadow-md animate-pulse">
                            👑 PRO
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[11px] px-3 py-1 rounded-full font-bold border border-slate-200 shadow-sm">
                            🛡️ BASIC
                        </span>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="flex bg-sand/20 rounded-lg p-1 gap-1 mb-6">
                    <button onClick={() => { setCurrentView('chat'); onClose(); }} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'chat' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><MessageSquare className="w-3.5 h-3.5" /> 채팅</button>
                    <button onClick={() => { setCurrentView('calendar'); onClose(); }} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'calendar' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><Calendar className="w-3.5 h-3.5" /> 캘린더</button>
                    <button onClick={() => { setCurrentView('archive'); onClose(); }} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'archive' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><Library className="w-3.5 h-3.5" /> 보관함</button>
                    <button onClick={() => { setCurrentView('mypage'); onClose(); }} className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-md flex items-center justify-center gap-1.5 ${currentView === 'mypage' ? 'bg-white shadow text-foreground' : 'text-gray-500'}`}><User className="w-3.5 h-3.5" /> 마이페이지</button>
                </div>
                <div className={`flex flex-col gap-3 transition-opacity ${currentView !== 'chat' ? 'opacity-40 pointer-events-none' : ''}`}>
                    {agents.map((agent) => (
                        <button key={agent.id} onClick={() => { setActiveAgent(agent.id as any); onClose(); }} className={`flex items-center gap-5 p-5 rounded-2xl border transition-all text-left group relative ${activeAgent === agent.id ? 'bg-secondary text-primary border-secondary shadow-xl scale-[1.02]' : 'bg-white border-sand/40 hover:bg-sand/5 text-foreground'}`}>
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
                        onClick={() => {
                            const url = 'https://chromewebstore.google.com/detail/kfldgophlmpejmlgjapbbnemnkdffobo';
                            window.open(url, '_blank', 'noreferrer,noopener');
                        }}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 group relative overflow-hidden flex items-center justify-between border border-amber-300/20 animate-fade-in"
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

function Header({ onToggleMenu }: { onToggleMenu: () => void }) {
    const { activeAgent, subscriptionBalance, topupBalance, setIsChargeModalOpen } = useAgent();
    return (
        <div className="absolute top-0 inset-x-0 z-20 p-4 bg-white/80 backdrop-blur-md border-b border-sand/30 flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
                {/* 🍔 [모바일 전용 햄버거 버튼] */}
                <button 
                    onClick={onToggleMenu} 
                    className="p-2 -ml-2 rounded-xl text-secondary hover:bg-slate-100 md:hidden active:scale-95 transition-all"
                >
                    <Users className="w-5 h-5" /> {/* 메뉴 아이콘 대신 임시 Users 또는 Menu 로 대체 */}
                </button>

                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="font-mono text-xs font-semibold uppercase text-secondary/80">활성: {activeAgent}</span>
            </div>

            {/* 👑 [원장님 지시 우측 상단 크레딧 통합 사출 바 - 프리미엄 세팅] */}
            <div className="flex items-center gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-50/90 to-amber-100/40 px-4 py-2 rounded-2xl border border-amber-200/50 shadow-sm">
                     <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-amber-400 text-xs font-black shadow-md">P</div>
                     <div className="flex flex-col -space-y-0.5">
                          <span className="text-[9px] font-bold text-amber-700/90 tracking-wider">보유 크레딧</span>
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false); // 👈 모바일 메뉴 스위치 설치

    return (
        <div className="flex flex-col md:flex-row h-screen bg-primary overflow-hidden relative">
            <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
            
            {/* 🔗 [모바일 오버레이 백드롭 레이어] */}
            {isMobileMenuOpen && (
                <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden animate-fade-in duration-200" />
            )}

            <main className="flex-1 flex flex-col relative overflow-hidden h-full">
                <Header onToggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
                <div className="flex-1 flex flex-col pt-16 min-h-0 overflow-hidden">{children}</div>

                {/* 💬 [원장님 지시] 카카오톡 채널 실시간 플로팅 고객센터 버튼 (호버 확장형) */}
                <button 
                    onClick={() => {
                        // 🚨 [가이드] 나중에 채널 개설하시면 아래 '_xxxxxx' 에 채널 ID를 덮어씌우면 연동 완료됩니다!
                        const channelUrl = 'https://pf.kakao.com/_xxxxxx/chat'; 
                        const width = 450;
                        const height = 650;
                        const left = window.screen.width / 2 - width / 2;
                        const top = window.screen.height / 2 - height / 2;
                        
                        window.open(
                            channelUrl, 
                            'KakaoTalk_Counsel', 
                            `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=yes,status=no`
                        );
                    }}
                    className="fixed bottom-6 right-6 z-50 bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#181600] p-3.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center border border-yellow-400 group flex items-center gap-1.5"
                    title="1:1 실시간 카톡 상담"
                >
                    <MessageCircle className="w-5 h-5 stroke-[2.5]" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs scale-0 group-hover:scale-100 transition-all duration-300 whitespace-nowrap text-[11px] font-black pl-0 group-hover:pl-0.5 flex items-center">
                         카톡 상담
                    </span>
                </button>
            </main>
        </div>
    );
}
