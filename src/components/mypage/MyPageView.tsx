'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
    Save, User, Key, Database, FileText, 
    Download, Trash2, UploadCloud, RefreshCw, KeyRound, ShieldAlert 
} from 'lucide-react';

export default function MyPageView() {
    const [activeTab, setActiveTab] = useState<'account' | 'facts' | 'rag'>('facts');
    const [loading, setLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);

    // Account State
    const [userEmail, setUserEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Workspace Settings State
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState('');
    const [brandFacts, setBrandFacts] = useState('');
    const [philosophy, setPhilosophy] = useState('');
    const [toneStyle, setToneStyle] = useState('');
    const [contentUpdatedAt, setContentUpdatedAt] = useState<string | null>(null);

    // RAG Files State
    const [ragFiles, setRagFiles] = useState<any[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // 1. Get User
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserEmail(user.email || '');

            // 2. Get Profile & Workspace id
            const { data: profile } = await supabase
                .from('profiles')
                .select('workspace_id')
                .single();

            if (profile?.workspace_id) {
                setWorkspaceId(profile.workspace_id);

                // 3. Get Workspace Settings
                const { data: workspace } = await supabase
                    .from('workspace_settings')
                    .select('*')
                    .eq('id', profile.workspace_id)
                    .single();

                if (workspace) {
                    setBusinessName(workspace.business_name || '');
                    setBrandFacts(workspace.brand_facts || '');
                    setPhilosophy(workspace.philosophy || '');
                    setToneStyle(workspace.tone_style || '');
                    setContentUpdatedAt(workspace.content_updated_at || null);
                }

                // 4. Get RAG Files (archive_posts) - content 포함 조회
                const { data: files } = await supabase
                    .from('archive_posts')
                    .select('id, content, metadata, created_at')
                    .eq('workspace_id', profile.workspace_id)
                    .order('created_at', { ascending: false });

                if (files) {
                    setRagFiles(files);
                }
            }
        } catch (error) {
            console.error('Error fetching MyPage data:', error);
        } finally {
            setLoading(false);
        }
    };

    // 30일 제한 검사 전용 유틸리티
    const checkUpdateLimit = () => {
        if (!contentUpdatedAt) return { restricted: false, nextDate: null };
        const lastUpdate = new Date(contentUpdatedAt);
        const nextDate = new Date(lastUpdate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const restricted = new Date() < nextDate;
        return { restricted, nextDate: nextDate.toLocaleDateString() };
    };

    // Update Password
    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword !== confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        setSaveLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('비밀번호가 안전하게 변경되었습니다.');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            alert(`변경 실패: ${error.message}`);
        } finally {
            setSaveLoading(false);
        }
    };

    // Update Workspace Settings
    const handleUpdateSettings = async () => {
        if (!workspaceId) return;
        
        const { restricted, nextDate } = checkUpdateLimit();
        if (restricted) {
            alert(`비즈니스 팩트는 30일에 한 번만 수정하실 수 있습니다.\n다음 변경 가능일: ${nextDate}`);
            return;
        }

        setSaveLoading(true);
        try {
            const { error } = await supabase
                .from('workspace_settings')
                .update({
                    business_name: businessName,
                    brand_facts: brandFacts,
                    philosophy: philosophy,
                    tone_style: toneStyle,
                    content_updated_at: new Date().toISOString()
                })
                .eq('id', workspaceId);

            if (error) throw error;
            alert('비즈니스 팩트 설정이 저장되었습니다.');
            setContentUpdatedAt(new Date().toISOString());
        } catch (error: any) {
             alert(`저장 실패: ${error.message}`);
        } finally {
            setSaveLoading(false);
        }
    };

    // 📂 RAG 파일 다운로드 (텍스트 추출하여 브라우저 다운 유틸 가설)
    const handleDownloadFile = (content: string, filename: string) => {
        if (!content) { alert('다운로드할 수 있는 텍스트 데이터가 부재합니다.'); return; }
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 📂 RAG 신규 파일 신입 (업로드 가동)
    const handleUploadRagFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !workspaceId || !userEmail) return;

        const { restricted, nextDate } = checkUpdateLimit();
        if (restricted) {
            alert(`AI 장기 기억 자산 추가(갱신)는 30일에 한 번만 가능합니다.\n다음 변경 가능일: ${nextDate}`);
            return;
        }

        setSaveLoading(true);
        try {
            const formData = new FormData();
            Array.from(files).forEach(f => formData.append('files', f));
            formData.append('email', userEmail); // ID 연동용

            const res = await fetch('/api/auth/onboarding/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('파일 업로드 분석 주입 실패');
            
            alert('신규 파일이 장기 기억 공간(RAG) 파이프라인에 주착 연성되었습니다.');
            fetchInitialData(); // 리프레시
        } catch (error: any) {
            alert(`업로드 실패: ${error.message}`);
        } finally {
            setSaveLoading(false);
        }
    };

    // Delete RAG File
    const handleDeleteFile = async (id: string) => {
        const { restricted, nextDate } = checkUpdateLimit();
        if (restricted) {
            alert(`AI 장기 기억 자산 수정(삭제 포함)은 30일에 한 번만 가능합니다.\n다음 변경 가능일: ${nextDate}`);
            return;
        }

        if (!confirm('해당 학습 자료를 장기 기억에서 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase
                .from('archive_posts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setRagFiles(prev => prev.filter(f => f.id !== id));
            alert('학습 자료가 삭제되었습니다.');
            setContentUpdatedAt(new Date().toISOString()); // 타이머 리셋
        } catch (error: any) {
            alert(`삭제 실패: ${error.message}`);
        }
    };

    // 🚨 Delete Account (영구 연쇄 완전 소결 연동 삭제)
    const handleDeleteAccount = async () => {
        if (!confirm('정말로 회원 탈퇴를 진행하시겠습니까? 대화 기록, 팩트 및 모든 자산 정보가 영구 파괴되며 완전 불복 소멸됩니다.')) return;
        setSaveLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !workspaceId) return;

            // 1. 하위 격리 테이블 안전 폭파
            await supabase.from('calendar').delete().eq('workspace_id', workspaceId);
            await supabase.from('marketing_outputs').delete().eq('workspace_id', workspaceId);
            await supabase.from('archive_posts').delete().eq('workspace_id', workspaceId);
            
            // 2. 워크스위트 삭제
            await supabase.from('workspace_settings').delete().eq('id', workspaceId);

            // 3. 프로필 삭제
            const { error: profileError } = await supabase.from('profiles').delete().eq('id', user.id);
            if (profileError) throw profileError;

            // 4. 세션 로그아웃 소거 차단
            await supabase.auth.signOut();
            window.location.href = '/'; 
        } catch (error: any) {
            alert(`탈퇴 실패: ${error.message}`);
        } finally {
            setSaveLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 animate-pulse">
                    <RefreshCw className="w-8 h-8 text-secondary animate-spin" />
                    <span className="text-secondary text-sm font-bold">마이페이지 로딩 중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full p-6 flex flex-col gap-6 bg-sand/5 overflow-y-auto">
            <div className="flex justify-between items-center border-bottom pb-4 border-sand/20">
                <h1 className="text-2xl font-black text-secondary tracking-tight"> 마이페이지 </h1>
                <p className="text-xs text-secondary/60">회원 정보 및 AI 학습 자산을 관리합니다.</p>
            </div>

            {/* 내부 탭 패널 */}
            <div className="flex bg-white rounded-xl shadow-sm p-1 gap-1 w-fit border border-sand/30">
                <button
                    onClick={() => setActiveTab('facts')}
                    className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                        ${activeTab === 'facts' ? 'bg-secondary text-primary shadow-sm' : 'text-gray-500 hover:bg-sand/10'}`}
                >
                    <Database className="w-3.5 h-3.5" /> 비즈니스 팩트
                </button>
                <button
                    onClick={() => setActiveTab('rag')}
                    className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                        ${activeTab === 'rag' ? 'bg-secondary text-primary shadow-sm' : 'text-gray-500 hover:bg-sand/10'}`}
                >
                    <FileText className="w-3.5 h-3.5" /> AI 장기 기억 (RAG)
                </button>
                <button
                    onClick={() => setActiveTab('account')}
                    className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                        ${activeTab === 'account' ? 'bg-secondary text-primary shadow-sm' : 'text-gray-500 hover:bg-sand/10'}`}
                >
                    <KeyRound className="w-3.5 h-3.5" /> 계정 관리
                </button>
            </div>

            {/* 본문 패널 */}
            <div className="flex-1 bg-white rounded-2xl shadow-md border border-sand/20 p-8 min-h-0 flex flex-col">

                {/* 계정 관리 */}
                {activeTab === 'account' && (
                    <div className="flex flex-col gap-6 max-w-md">
                        <div className="flex flex-col gap-1.5 border-b pb-4">
                            <span className="text-xs text-gray-400 font-bold">이메일 계정</span>
                            <span className="text-sm font-black text-secondary">{userEmail}</span>
                        </div>
                        <div className="flex flex-col gap-4">
                            <h3 className="text-sm font-black text-secondary flex items-center gap-1.5"><Key className="w-4 h-4" /> 비밀번호 변경</h3>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-gray-500">새 비밀번호</label>
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="px-4 py-2.5 bg-sand/10 border border-sand/30 rounded-xl outline-none text-sm font-bold focus:border-secondary transition-colors"
                                    placeholder="새 비밀번호 입력"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-gray-500">새 비밀번호 확인</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="px-4 py-2.5 bg-sand/10 border border-sand/30 rounded-xl outline-none text-sm font-bold focus:border-secondary transition-colors"
                                    placeholder="새 비밀번호 다시 입력"
                                />
                            </div>
                            <button
                                onClick={handleUpdatePassword}
                                disabled={saveLoading}
                                className="px-6 py-2.5 bg-secondary text-primary rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 w-full mt-2"
                            >
                                <Save className="w-3.5 h-3.5" /> {saveLoading ? '저장 중...' : '비밀번호 저장'}
                            </button>
                        </div>

                        {/* 🚨 위험 구역 (Danger Zone) */}
                        <div className="border-t border-red-100 pt-6 mt-4 flex flex-col gap-4">
                            <h3 className="text-sm font-black text-red-600 flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4" /> 위험 구역 (Danger Zone)
                            </h3>
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                회원 탈퇴 시 모든 비즈니스 배경지식 및 누적 학습된 에셋 데이터 단자가 일괄 자동 파쇄되며 영구 복구할 수 없습니다.
                            </p>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={saveLoading}
                                className="px-6 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 w-full mt-1"
                            >
                                {saveLoading ? '삭제 진행 중...' : '🚨 회원 탈퇴하기'}
                            </button>
                        </div>
                    </div>
                )}

                {/* 비즈니스 팩트 */}
                {activeTab === 'facts' && (() => {
                    const { restricted, nextDate } = checkUpdateLimit();
                    return (
                        <div className="flex flex-col gap-5 flex-1 overflow-y-auto pr-4 scrollbar-thin">
                            
                            {/* 🚨 30일 잠금 상태 배너 */}
                            {restricted && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-black text-red-800">🔒 비즈니스 팩트 수정 잠금 상태</span>
                                        <span className="text-[10px] text-red-700 leading-relaxed">
                                            어뷰징 방지를 위해 데이터가 안전하게 보호되고 있습니다. **다음 변경 가능일은 {nextDate}** 입니다.
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-secondary">🏬 에이전트 페르소나 (상호명/이름)</label>
                                <input 
                                    type="text" 
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    disabled={restricted}
                                    className={`px-4 py-2.5 border border-sand/30 rounded-xl outline-none text-sm font-bold focus:border-secondary transition-colors ${restricted ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-sand/10'}`}
                                    placeholder="예: 시울 연세 학원"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-secondary">💡 브랜드 팩트 및 배경지식 (동적 학습선)</label>
                                <textarea 
                                    value={brandFacts}
                                    onChange={(e) => setBrandFacts(e.target.value)}
                                    disabled={restricted}
                                    rows={6}
                                    className={`px-4 py-3 border border-sand/30 rounded-xl outline-none text-sm font-medium focus:border-secondary transition-colors resize-none leading-relaxed ${restricted ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-sand/10'}`}
                                    placeholder="회사의 주요 팩트 지선을 자유롭게 고쳐주세요."
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-secondary">🎯 비즈니스 철학 (Philosophy)</label>
                                <textarea 
                                    value={philosophy}
                                    onChange={(e) => setPhilosophy(e.target.value)}
                                    disabled={restricted}
                                    rows={4}
                                    className={`px-4 py-3 border border-sand/30 rounded-xl outline-none text-sm font-medium focus:border-secondary transition-colors resize-none leading-relaxed ${restricted ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-sand/10'}`}
                                    placeholder="회사가 추구하는 가치를 입력해 주세요."
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-secondary">🗣️ 선호 톤앤매너 (Tone & Manner)</label>
                                <input 
                                    type="text" 
                                    value={toneStyle}
                                    onChange={(e) => setToneStyle(e.target.value)}
                                    disabled={restricted}
                                    className={`px-4 py-2.5 border border-sand/30 rounded-xl outline-none text-sm font-bold focus:border-secondary transition-colors ${restricted ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-sand/10'}`}
                                    placeholder="예: 친근하고 전문적인 어조, 격식 있는 말투 등"
                                />
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mt-2">
                                <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-black text-amber-800">⚠️ 신중하게 기입해 주세요 (30일 제한)</span>
                                    <span className="text-[10px] text-amber-700 leading-relaxed">
                                        비즈니스 팩트는 어뷰징 방지를 위해 **30일에 단 1회만 수정**하실 수 있습니다. 오탈자나 오류가 없도록 꼼꼼히 검토 후 저장해 주시기 바랍니다.
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleUpdateSettings}
                                disabled={saveLoading || restricted}
                                className={`px-6 py-3 bg-secondary text-primary rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 w-fit ml-auto ${restricted ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Save className="w-3.5 h-3.5" /> {saveLoading ? '저장 중...' : '팩트 설정 저장하기'}
                            </button>
                        </div>
                    );
                })()}

                {/* RAG 학습 자산 */}
                {activeTab === 'rag' && (() => {
                    const { restricted, nextDate } = checkUpdateLimit();
                    return (
                        <div className="flex flex-col gap-6 flex-1">
                            <div className="flex justify-between items-center border-b pb-4">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-sm font-black text-secondary">학습 자산 매니징 센터</h3>
                                    <p className="text-[10px] text-gray-500">인공지능이 과거 학습한 정적 파일이나 보조 에셋들의 기억을 격리/삭제합니다.</p>
                                </div>
                                
                                {/* ➕ RAG 신규 파일 신입 버튼 설치 */}
                                <label className={`px-4 py-2 border rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-sm
                                    ${restricted ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-secondary text-primary hover:opacity-90'}`}>
                                    <UploadCloud className="w-4 h-4" /> 학습자료 주입
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        multiple 
                                        disabled={restricted}
                                        onChange={handleUploadRagFile} 
                                    />
                                </label>
                            </div>

                            {/* ⚠️ 제한 배너 피드 (RAG) */}
                            {restricted && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-[11px] font-bold text-amber-800">
                                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                                    장기 기억 자산 신규 추가 및 삭제는 30일에 한 번만 가능합니다. (다음 가능일: {nextDate})
                                </div>
                            )}

                            {ragFiles.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-sand/40 rounded-2xl bg-sand/5">
                                    <FileText className="w-10 h-10 text-gray-300" />
                                    <span className="text-xs text-gray-400 font-bold">인덱싱된 장기 기억 에셋이 부재합니다.</span>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin flex flex-col gap-2">
                                    {ragFiles.map((file, idx) => (
                                        <div key={file.id || idx} className="flex items-center justify-between p-4 bg-sand/10 rounded-xl border border-sand/20 shadow-sm hover:bg-sand/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-secondary/10 p-2 rounded-lg">
                                                    <FileText className="w-4 h-4 text-secondary" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-secondary truncate max-w-xs">{file.metadata?.name || `학습 에셋 ${idx + 1}`}</span>
                                                    <span className="text-[9px] text-gray-400">{new Date(file.created_at).toLocaleDateString()} 업데이트됨</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {/* ⬇️ 다운로드 버튼 실물 장막 가동 */}
                                                <button 
                                                    onClick={() => handleDownloadFile(file.content, file.metadata?.name || 'learning_data')}
                                                    className="p-1.5 hover:bg-secondary/10 text-gray-500 hover:text-secondary rounded-lg transition-colors"
                                                    title="자산 다운로드"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteFile(file.id)}
                                                    disabled={restricted}
                                                    className={`p-1.5 rounded-lg transition-colors ${restricted ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                                                    title="자산 삭제"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

            </div>
        </div>
    );
}
