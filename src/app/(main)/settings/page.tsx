'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [remainingDays, setRemainingDays] = useState<number | null>(null);
    const [recentContexts, setRecentContexts] = useState<any[]>([]);

    useEffect(() => {
        fetchContexts();
    }, []);

    const fetchContexts = async () => {
        try {
            const res = await fetch('/api/context');
            const data = await res.json();
            if (data.context) {
                setRecentContexts(data.context);
            }
        } catch (e) {
            console.error('컨텍스트 로드 실패:', e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setLoading(true);
        setMessage(null);

        try {
            const res = await fetch('/api/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: '배경지식이 성공적으로 가공 및 저장되었습니다.' });
                setContent('');
                setRemainingDays(30); // 즉시 락다운 모방
                fetchContexts();
            } else {
                setMessage({ type: 'error', text: data.error || '저장에 실패했습니다.' });
                if (data.remainingDays) {
                    setRemainingDays(data.remainingDays);
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: '서버 연동 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-amber-500" /> 자율 온보딩 및 배경지식 설정
                    </h1>
                    <p className="text-sm text-slate-500">에이전트에게 비즈니스의 철학, 비즈니스 팩트, RAG용 기획 데이터를 주입합니다.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Form (2 Columns) */}
                    <div className="lg:col-span-2 space-y-6">
                        <form onSubmit={handleSubmit} className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-800">배경지식 기재 (브랜드 정체성, 가이드라인)</label>
                                {remainingDays !== null && (
                                    <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-amber-200/50">
                                        <Clock className="w-3.5 h-3.5" /> {remainingDays}일 후 수정 가능
                                    </span>
                                )}
                            </div>

                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                disabled={loading || (remainingDays !== null && remainingDays > 0)}
                                placeholder="비즈니스의 고유한 교육 철학, 대표님의 문체 특성, 타겟 학부모층, 주요 성과 등 AI 에이전트가 마케팅 글 작성 시 참조할 내용을 상세히 입력해주세요."
                                className="w-full h-80 p-5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all outline-none text-sm leading-relaxed text-slate-700 resize-none font-medium disabled:opacity-50"
                            />

                            {message && (
                                <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${
                                    message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200/50' : 'bg-red-50 text-red-800 border border-red-200/50'
                                }`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !content.trim() || (remainingDays !== null && remainingDays > 0)}
                                className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" /> 
                                {loading ? '인덱싱 및 분석 중...' : '배경지식 저장 및 RAG 자동화 동기화'}
                            </button>
                        </form>
                    </div>

                    {/* Right Info pane (1 Column) */}
                    <div className="space-y-6">
                        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3 border-slate-100">
                                📌 설정 가이드라인
                            </h4>
                            <ul className="space-y-3 text-[12px] text-slate-600 font-medium leading-relaxed">
                                <li className="flex gap-2"><span className="text-amber-500">✔</span> 입력된 데이터는 파쇄 및 인덱싱되어 **RAG 컨텍스트**로만 활용됩니다.</li>
                                <li className="flex gap-2"><span className="text-amber-500">✔</span> 비용 및 RAG 가용성을 위해 **월 1회 수정 주기** 제약이 적용됩니다.</li>
                                <li className="flex gap-2"><span className="text-amber-500">✔</span> 구체적인 성과(ex: 의대 OO명 합격 등)가 있을 경우 적극 기재하는 것이 에이전트 퀄리티 향상에 도움을 줍니다.</li>
                            </ul>
                        </div>

                        {recentContexts.length > 0 && (
                            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b pb-3 border-slate-100">
                                    🗄️ 최근 등록된 컨텍스트
                                </h4>
                                <div className="space-y-3">
                                    {recentContexts.map((post: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/40">
                                            <p className="text-xs text-slate-700 truncate font-medium">{post.content}</p>
                                            <span className="text-[10px] text-slate-400 block mt-1">
                                                {new Date(post.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
