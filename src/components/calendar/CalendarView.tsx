'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAgent } from '@/context/AgentContext';
import { PlusCircle, Calendar as CalendarIcon, CheckCircle, Clock, FileText, Trash2 } from 'lucide-react';

type CalendarEntry = {
    id: string;
    work_date: string;
    agent_id: string;
    topic: string;
    status: string;
};

export default function CalendarView() {
    const [entries, setEntries] = useState<CalendarEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { setActiveAgent, setCurrentView, setSelectedTopic } = useAgent();

    // Create new entry states
    const [isCreating, setIsCreating] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [selectedAgents, setSelectedAgents] = useState<string[]>(['Blog']);
    const [newTopic, setNewTopic] = useState('');

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    useEffect(() => {
        fetchCalendar();
    }, []);

    const fetchCalendar = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('calendar')
                .select('*')
                .order('work_date', { ascending: true });

            if (error) throw error;
            setEntries(data || []);
        } catch (error: any) {
            console.error('Error fetching calendar:', error.message || error);
            alert(`일정 불러오기 실패: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newDate || !newTopic || selectedAgents.length === 0) {
            alert('날짜, 주제를 입력하고 에이전트를 최소 한 명 이상 선택해주세요.');
            return;
        }

        try {
            const inserts = selectedAgents.map(agent => ({
                work_date: newDate,
                agent_id: agent,
                topic: newTopic,
                status: 'planned'
            }));

            const { error } = await supabase
                .from('calendar')
                .insert(inserts);

            if (error) throw error;

            setIsCreating(false);
            setNewTopic('');
            setSelectedAgents(['Blog']);
            fetchCalendar();
        } catch (error) {
            console.error('Error creating entry:', error);
            alert('일정 등록에 실패했습니다.');
        }
    };

    const handleStartWork = (agentId: string, topic: string) => {
        setSelectedTopic(topic);
        setActiveAgent(agentId as any);
        setCurrentView('chat');
    };

    const handleDelete = (id: string) => {
        setDeleteTargetId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;

        try {
            const { error } = await supabase
                .from('calendar')
                .delete()
                .eq('id', deleteTargetId);

            if (error) throw error;
            fetchCalendar();
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert('삭제에 실패했습니다.');
        } finally {
            setShowDeleteModal(false);
            setDeleteTargetId(null);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        if (status === 'planned') return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> 계획됨</span>;
        if (status === 'generated') return <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><FileText className="w-3 h-3" /> 원고완료</span>;
        if (status === 'posted') return <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 발행됨</span>;
        return null;
    };

    return (
        <div className="flex flex-col h-full bg-[#FAFAFA] text-foreground p-6 overflow-y-auto">
            <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-6">
                <div>
                    <h2 className="text-2xl font-extrabold font-serif flex items-center gap-2 text-gray-800">
                        <CalendarIcon className="w-6 h-6 text-[#71161A]" /> 마케팅 캘린더
                        <span className="ml-1 px-2 py-0.5 bg-green-50 text-green-600 text-[10px] rounded-full font-bold flex items-center gap-1 border border-green-100 uppercase tracking-tighter">
                            <Clock className="w-3 h-3" /> Autopilot ON (09:00)
                        </span>
                    </h2>
                    <p className="text-sm text-gray-400 mt-1 font-medium italic">매일 아침 9시, 예약된 주제로 원고가 자동 생성됩니다.</p>
                </div>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="shrink-0 bg-white text-[#71161A] border-2 border-[#71161A] px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#71161A] hover:text-white transition-all shadow-md active:scale-95 ml-6"
                >
                    <PlusCircle className="w-5 h-5" /> 새 일정 추가
                </button>
            </div>

            {isCreating && (
                <div className="bg-white p-6 rounded-xl border border-sand/50 shadow-md mb-8 animate-in fade-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">발행 예정일</label>
                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">작업 주제 (Topic)</label>
                            <input type="text" placeholder="예: 3월 신학기 대비 내신 설명회 안내" value={newTopic} onChange={e => setNewTopic(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-4 border-t border-gray-100">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">담당 에이전트 (다중 선택 가능)</label>
                            <div className="flex flex-wrap gap-2">
                                {['Blog', 'Insta', 'Threads', 'Shortform', 'Reputation', 'Marketer'].map(agent => (
                                    <button
                                        key={agent}
                                        onClick={() => setSelectedAgents(prev => prev.includes(agent) ? (prev.length > 1 ? prev.filter(a => a !== agent) : prev) : [...prev, agent])}
                                        className={`px-4 py-2 rounded-full text-xs font-bold border transition-all duration-200 shadow-sm ${selectedAgents.includes(agent) ? 'bg-[#71161A] text-white border-[#71161A] scale-105' : 'bg-white text-gray-500 border-gray-200 hover:border-[#71161A]/30 hover:bg-gray-50'}`}
                                    >
                                        {agent}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsCreating(false)} className="px-6 py-3 rounded-lg font-bold text-gray-400 hover:text-gray-600 transition-colors">
                                취소
                            </button>
                            <button onClick={handleCreate} className="bg-[#71161A] text-white px-10 py-3 rounded-lg font-bold hover:bg-[#5a1215] transition-all shadow-lg active:scale-95">
                                일정 저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-sand/50 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-sand/10 border-b border-sand/30 text-gray-600 text-sm">
                            <th className="p-4 font-bold">날짜</th>
                            <th className="p-4 font-bold">상태</th>
                            <th className="p-4 font-bold">에이전트</th>
                            <th className="p-4 font-bold">주제</th>
                            <th className="p-4 font-bold text-right">상세 및 액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">데이터를 불러오는 중입니다...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">등록된 일정이 없습니다. 우측 상단의 [새 일정 추가]를 클릭해보세요.</td></tr>
                        ) : (
                            entries.map(entry => (
                                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 font-mono text-sm text-gray-600 flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                                        {entry.work_date}
                                    </td>
                                    <td className="p-4"><StatusBadge status={entry.status || 'planned'} /></td>
                                    <td className="p-4"><span className={`font-bold text-sm px-2 py-1 rounded ${entry.agent_id === 'Blog' ? 'text-blue-600 bg-blue-50' : entry.agent_id === 'Insta' ? 'text-pink-600 bg-pink-50' : entry.agent_id === 'Threads' ? 'text-slate-900 bg-gray-100' : entry.agent_id === 'Shortform' ? 'text-purple-600 bg-purple-50' : entry.agent_id === 'Reputation' ? 'text-purple-600 bg-purple-50' : 'text-slate-600 bg-slate-100'}`}>{entry.agent_id}</span></td>
                                    <td className="p-4 text-gray-800 font-medium">{entry.topic}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleStartWork(entry.agent_id, entry.topic)}
                                                className="text-[11px] bg-secondary text-primary border border-primary/20 px-3 py-1.5 rounded-full font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-1"
                                            >
                                                <FileText className="w-3 h-3" /> 작업 열기
                                            </button>
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Custom Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-sand/50 animate-in zoom-in-95 duration-200">
                        <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <Trash2 className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-center mb-2">일정 삭제</h3>
                        <p className="text-gray-500 text-center mb-8 leading-relaxed px-2">
                            선택하신 일정을 캘린더에서 정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-100 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg active:scale-95 transition-all"
                            >
                                삭제하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
