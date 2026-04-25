'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, User, Lock, ArrowRight, Loader2, CheckCircle, FileText, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
    // 온보딩 관련 신규 State
    const [step, setStep] = useState<'email' | 'verify' | 'certification' | 'details' | 'business' | 'persona' | 'rag'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreeTerms, setAgreeTerms] = useState(false); // 약관 동의 State 신설
    const [showTermsModal, setShowTermsModal] = useState(false); // 약관 모달 State 신설
    const [certificationData, setCertificationData] = useState<any>(null); // 본인인증 데이터 추가
    const router = useRouter();

    const [timer, setTimer] = useState(180); // 3분
    const [isTimeOut, setIsTimeOut] = useState(false);

    // 인증번호 제한시간 관리용 useEffect
    const { useEffect } = require('react'); 
    useEffect(() => {
        if (step !== 'verify') return;
        setIsTimeOut(false);
        setTimer(180);
        
        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setIsTimeOut(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [step]);

    // 추가 온보딩 State
    const [industry, setIndustry] = useState('workspace'); // 기본값 비즈니스
    const [businessName, setBusinessName] = useState('');
    const [facts, setFacts] = useState(''); // 백엔드 전송용 결합 파라미터
    const [infra, setInfra] = useState('');
    const [usp, setUsp] = useState('');
    const [results, setResults] = useState('');
    const [target, setTarget] = useState('');
    const [system, setSystem] = useState('');
    const [philosophy, setPhilosophy] = useState('');
    const [toneStyle, setToneStyle] = useState<string[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!agreeTerms) {
            setError('이용약관 및 개인정보 처리방침에 동의해 주세요.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send code');

            // [📌 개발 디버그 안내]
            if (data.debug_code) {
                 alert(`[🛠️ 개발 모드 임시인증번호 주입] 인증코드: [ ${data.debug_code} ]`);
            }

            setStep('verify');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/check-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Invalid code');

            setStep('certification'); // 본인인증 단계로 배선 연장격상
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNextToBusiness = (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setError('');
        setStep('business');
    };

    const handleNextToPersona = (e: React.FormEvent) => {
        e.preventDefault();
        
        // 5대 팩트 입력값을 하나의 텍스트(facts)로 결합합니다.
        const combinedFacts = [
            infra ? `[📍 위치 및 인프라]\n${infra}` : '',
            usp ? `[💡 차별성 및 강점]\n${usp}` : '',
            results ? `[🏆 누적 성과 / 주요 실적]\n${results}` : '',
            target ? `[🎯 주요 타겟]\n${target}` : '',
            system ? `[🛡️ 운영 관리 시스템]\n${system}` : ''
        ].filter(Boolean).join('\n\n');

        if (!combinedFacts) {
            setError('최소가 한 가지 이상의 비즈니스 팩트를 입력해 주세요.');
            return;
        }

        setFacts(combinedFacts);
        setError('');
        setStep('persona');
    };

    const handleNextToRAG = (e: React.FormEvent) => {
        e.preventDefault();
        setStep('rag');
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. 회원 정보 및 메타데이터 저장 API 호출
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, username, password, code,
                    industry, businessName, facts, philosophy, toneStyle,
                    isCertified: !!certificationData
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            // 2. 파일 업로드 로직 (RAG 학습용)
            if (uploadedFiles.length > 0) {
                const formData = new FormData();
                uploadedFiles.forEach(file => formData.append('files', file));
                formData.append('email', email); // ID 연동용

                await fetch('/api/auth/onboarding/upload', {
                    method: 'POST',
                    body: formData
                });
            }

            router.push('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleTone = (tone: string) => {
        setToneStyle(prev => prev.includes(tone) ? prev.filter(t => t !== tone) : [...prev, tone]);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-primary text-secondary relative overflow-hidden py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sand/20 via-transparent to-transparent" />

            <div className="w-full max-w-lg p-8 bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border border-sand/30 relative z-10 transition-all">
                
                {/* 상단 스텝 프로그레스 바 */}
                <div className="flex justify-between items-center mb-8 px-4">
                    {['인증', '계정', '비즈니스', '톤앤매너', '학습자료'].map((label, idx) => {
                        const stepOrder = ['email', 'details', 'business', 'persona', 'rag'];
                        const currentOrder = stepOrder.indexOf(step === 'verify' ? 'email' : step);
                        const isCompleted = idx < currentOrder;
                        const isCurrent = idx === currentOrder;

                        return (
                            <div key={label} className="flex flex-col items-center flex-1 relative">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    isCompleted ? 'bg-secondary text-white' : isCurrent ? 'bg-amber-100 text-secondary border-2 border-secondary' : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {isCompleted ? '✓' : idx + 1}
                                </div>
                                <span className={`text-[10px] mt-1.5 font-semibold ${isCurrent || isCompleted ? 'text-secondary' : 'text-gray-400'}`}>{label}</span>
                                {idx < 4 && <div className={`absolute top-3.5 left-1/2 w-full h-[2px] -z-10 ${idx < currentOrder ? 'bg-secondary' : 'bg-gray-100'}`} />}
                            </div>
                        );
                    })}
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-secondary tracking-tight">Intelligence Onboarding</h1>
                    <p className="text-xs text-secondary/60 tracking-wider uppercase mt-1">Setup your AI marketing agent</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded animate-pulse">
                        {error}
                    </div>
                )}

                {/* Step 1-1: 이메일 입력 */}
                {step === 'email' && (
                    <form onSubmit={handleSendCode} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-2">이메일 인증</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary outline-none text-sm" placeholder="name@example.com" required />
                            </div>

                            <div className="flex items-center gap-2 mt-3 p-1">
                                <input 
                                    type="checkbox" 
                                    id="terms" 
                                    checked={agreeTerms} 
                                    onChange={(e) => setAgreeTerms(e.target.checked)} 
                                    className="w-4 h-4 text-secondary border-gray-300 rounded focus:ring-offset-2 focus:ring-secondary/30 cursor-pointer" 
                                />
                                <label htmlFor="terms" className="text-[11px] font-bold text-secondary/70 cursor-pointer">
                                    가입 시 <button type="button" onClick={() => setShowTermsModal(true)} className="underline text-secondary hover:text-secondary/80">이용약관 및 개인정보 처리방침</button>에 동의합니다.
                                </label>
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-secondary text-white font-bold hover:bg-secondary/90 transition-all flex justify-center items-center text-sm">
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : '인증번호 발송'}
                        </button>
                    </form>
                )}

                {/* Step 1-2: 인증번호 검증 */}
                {step === 'verify' && (
                    <form onSubmit={handleVerifyCode} className="space-y-5">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-secondary/80">인증번호 6자리 입력</label>
                                <span className={`text-[11px] font-black ${isTimeOut ? 'text-red-500 animate-pulse' : 'text-amber-600'}`}>
                                    {isTimeOut ? '시간 만료 (다시 전송하세요)' : `남은 시간 ${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`}
                                </span>
                            </div>
                            <div className="relative">
                                <CheckCircle className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    value={code} 
                                    onChange={(e) => setCode(e.target.value)} 
                                    className={`w-full pl-11 pr-4 py-3 bg-white border ${isTimeOut ? 'border-red-400' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary outline-none text-sm text-center tracking-widest font-bold`} 
                                    placeholder="000000" 
                                    maxLength={6} 
                                    disabled={isTimeOut}
                                    required 
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={loading || isTimeOut} className="w-full py-3 rounded-xl bg-secondary text-white font-bold hover:bg-secondary/90 transition-all flex justify-center items-center text-sm disabled:opacity-50">
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : '번호 확인'}
                        </button>
                    </form>
                )}

                {/* Step 1.5: 대표자 본인인증 (PortOne 연동 임시 가시설) */}
                {step === 'certification' && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-amber-800">⚠️ 최초 1회 실명 본인인증 필수</span>
                                <span className="text-[10px] text-amber-700 leading-relaxed">
                                    Faire Click 에서는 어뷰징 방지 및 포인트 남용 감시를 위해 대표자님의 폰 인증이 완료되어야 계정이 개통되며, 중복 가입 시 웰컴 1,000pt 가 지급되지 않습니다.
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full">
                            <button 
                                type="button" 
                                onClick={() => {
                                    alert('포트원 PASS 인증 창이 기폭 되는 위치입니다.\n완료되면 가정한 인증 성공 시뮬레이션을 타설합니다.');
                                    setCertificationData({ certified: true }); // 임시 플래그 저장
                                    setStep('details'); 
                                }} 
                                disabled={loading} 
                                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-lg shadow-amber-500/10 flex justify-center items-center gap-2 transition-all scale-[1.01] hover:scale-[1.03]"
                            >
                                <ShieldAlert className="w-4 h-4" />
                                웰컴 150pt 받기 (PASS 본인인증)
                            </button>
                            <button 
                                type="button" 
                                onClick={() => {
                                    setCertificationData(null); // 스킵 시 데이터 비움
                                    setStep('details'); 
                                }} 
                                className="w-full py-2.5 text-secondary/40 hover:text-secondary font-bold text-xs transition-colors text-center"
                            >
                                인증 없이 나중에 가입하기 (0pt 지급)
                            </button>
                        </div>
                    </div>
                )}
                {step === 'details' && (
                    <form onSubmit={handleNextToBusiness} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-1.5">사용자 ID</label>
                            <div className="relative"><User className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" /><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-sm" placeholder="아이디" required /></div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-1.5">비밀번호</label>
                            <div className="relative"><Lock className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-sm" placeholder="••••••••" required /></div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-1.5">비밀번호 확인</label>
                            <div className="relative"><Lock className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-sm" placeholder="••••••••" required /></div>
                        </div>
                        <button type="submit" className="w-full py-3 mt-2 rounded-xl bg-secondary text-white font-bold hover:bg-secondary/90 transition-all flex justify-center items-center text-sm gap-2">다음 단계 <ArrowRight className="w-4 h-4" /></button>
                    </form>
                )}

                {/* Step 3: 비즈니스 기본 정보 */}
                {step === 'business' && (
                    <form onSubmit={handleNextToPersona} className="space-y-4 max-h-[450px] overflow-y-auto px-1">
                        {/* ⚠️ 30일 상한 안내 배너 신설 */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-2">
                            <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-amber-800">⚠️ 신중하게 기입해 주세요 (30일 제한)</span>
                                <span className="text-[10px] text-amber-700 leading-relaxed">
                                    Faire Click 에서는 어뷰징 방지를 위해 플랫폼 등록된 비즈니스 상세 팩트를 **30일에 1회**로만 수정할 수 있게 이용 상한이 제한됩니다. 오탈자가 없도록 신중하게 기재해 주시기 바랍니다.
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-1.5">대표 업종</label>
                            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-sm font-semibold">
                                <option value="workspace">📚 교육/비즈니스</option>
                                <option value="f&b">🍔 외식업/카페</option>
                                <option value="fashion">👕 패션/쇼핑몰</option>
                                <option value="medical">🏥 병원/의료</option>
                                <option value="generic">💼 기타 서비스업</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-1.5">상호명</label>
                            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-sm" placeholder="예: 살롱 드 패션, 서울비즈니스" required />
                        </div>

                        <div className="border-t border-sand/20 pt-4">
                            <h3 className="text-xs font-bold text-secondary mb-3">상세 비즈니스 팩트 (Fact) 기재</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-secondary/70 mb-1">📍 위치 및 인프라</label>
                                    <textarea value={infra} onChange={(e) => setInfra(e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-xs h-16 resize-none" placeholder="예: 분당역 3번 출구 도보 5분, 자습실 상시 개방" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-secondary/70 mb-1">💡 대표 차별성 및 강점 (USP)</label>
                                    <textarea value={usp} onChange={(e) => setUsp(e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-xs h-16 resize-none" placeholder="예: 대치동 10년 차 원장 직강, 전문의 협진" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-secondary/70 mb-1">🏆 누적 성과 및 실적</label>
                                    <textarea value={results} onChange={(e) => setResults(e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-xs h-16 resize-none" placeholder="예: 의대 누적 50명 합격, 누적 교정 5,000건" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-secondary/70 mb-1">🎯 주요 타겟 고객군</label>
                                    <textarea value={target} onChange={(e) => setTarget(e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-xs h-16 resize-none" placeholder="예: 상위권 대입 준비생, 삐뚤빼뚤한 치아가 고민인 2030" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-secondary/70 mb-1">🛡️ 운영 관리 / 사후 관리 시스템</label>
                                    <textarea value={system} onChange={(e) => setSystem(e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-xs h-16 resize-none" placeholder="예: 24시간 피드백 관리, 교정 완증 후 평생보증" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button type="button" onClick={() => setStep('details')} className="w-1/4 py-3 rounded-xl border border-gray-200 bg-white text-gray-500 font-bold hover:bg-gray-50 text-sm flex justify-center items-center">이전</button>
                            <button type="submit" className="flex-1 py-3 rounded-xl bg-secondary text-white font-bold hover:bg-secondary/90 transition-all flex justify-center items-center text-sm gap-2">페르소나 설정하기 <ArrowRight className="w-4 h-4" /></button>
                        </div>
                    </form>
                )}

                {/* Step 4: 브랜드 퍼소나 & 문체 */}
                {step === 'persona' && (
                    <form onSubmit={handleNextToRAG} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-1.5">대표 운영 철학 및 방향성</label>
                            <textarea value={philosophy} onChange={(e) => setPhilosophy(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 outline-none text-sm h-24" placeholder="예: '단순 기술이 아닌 진심을 팝니다', '원칙을 지키는 교육'" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-2">선호하는 글 일관된 문체 (다중 선택)</label>
                            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                                {['친근하고 다정한 경어체', '전문적이고 건조한 신뢰체', '강렬한 헤드라인 임팩트체', '스토리텔링 중심의 에세이체'].map(tone => (
                                    <button type="button" key={tone} onClick={() => toggleTone(tone)} className={`p-2.5 border rounded-xl transition-all ${toneStyle.includes(tone) ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{tone}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button type="button" onClick={() => setStep('business')} className="w-1/4 py-3 rounded-xl border border-gray-200 bg-white text-gray-500 font-bold hover:bg-gray-50 text-sm flex justify-center items-center">이전</button>
                            <button type="submit" className="flex-1 py-3 rounded-xl bg-secondary text-white font-bold hover:bg-secondary/90 transition-all flex justify-center items-center text-sm gap-2">마지막: 대용량 학습자료 주입 <ArrowRight className="w-4 h-4" /></button>
                        </div>
                    </form>
                )}

                {/* Step 5: RAG 학습 자료 업로드 및 최종 가입 */}
                {step === 'rag' && (
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-secondary/80 mb-2">AI 학습용 가이드 문서 / 매뉴얼 (RAG)</label>
                            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/80 transition-colors cursor-pointer" onClick={() => document.getElementById('rag-upload')?.click()}>
                                <FileText className="w-10 h-10 text-gray-400 mb-2" />
                                <span className="text-xs font-bold text-gray-600">클릭하여 학습용 파일 업로드</span>
                                <span className="text-[10px] text-gray-400 mt-1">PDF, DOC, TXT 지원 (최대 5개)</span>
                                <input type="file" id="rag-upload" className="hidden" multiple onChange={(e) => {
                                    if (e.target.files) setUploadedFiles(Array.from(e.target.files));
                                }} />
                            </div>
                            {uploadedFiles.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                    {uploadedFiles.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-100 text-xs font-medium"><span className="truncate flex-1">{f.name}</span><button type="button" className="text-red-500 text-xs" onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}>삭제</button></div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button type="button" onClick={() => setStep('persona')} className="w-1/4 py-3 rounded-xl border border-gray-200 bg-white text-gray-500 font-bold hover:bg-gray-50 text-sm flex justify-center items-center">이전</button>
                            <button type="submit" disabled={loading} className="flex-1 py-3.5 rounded-xl bg-secondary text-white font-black hover:bg-secondary/90 transition-all flex justify-center items-center text-sm gap-2">
                                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : '온보딩 완료 및 지능 가동'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-6 text-center text-xs">
                    <Link href="/login" className="text-gray-400 hover:text-secondary hover:underline font-bold">
                        기존 계정으로 로그인
                    </Link>
                </div>
            </div>

            {/* 📜 이용약관 및 개인정보 처리방침 팝업 모달 - 최상위 Viewport 위치로 이격 */}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-white rounded-3xl w-full max-w-md max-h-[70vh] flex flex-col p-7 shadow-2xl animate-fade-in border border-sand/10">
                        <h2 className="text-sm font-black text-secondary mb-4 border-b border-sand/30 pb-3 flex items-center gap-1.5">
                            <FileText className="w-5 h-5 text-secondary" /> Faire Click 이용약관 및 개인정보 처리방침
                        </h2>
                        <div className="flex-1 overflow-y-auto text-[11px] text-gray-500 space-y-4 leading-relaxed pr-2 scrollbar-thin">
                            <p className="font-bold text-secondary text-xs">📌 제 1조 (목적)</p>
                            <p>본 약관은 회사가 제공하는 AI 마케팅 에이전트 서비스(이하 "Faire Click")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                            
                            <p className="font-bold text-secondary text-xs">📌 제 2조 (개인정보의 수집 및 이용)</p>
                            <p>회사는 서비스 제공을 위해 필요한 최소한의 개인정보(이메일, 비밀번호)를 수집하며, 사용자의 명시적 탈퇴 시까지 안전하게 보존 및 이용됩니다.</p>
                            
                            <p className="font-bold text-secondary text-xs">📌 제 3조 (비즈니스 데이터 및 자산 관리)</p>
                            <p>인텔리전스 온보딩 시 기입하신 회사의 문체/철학/RAG 학습 매뉴얼과 같은 사내 자문 자산은 에이전트 생성 외의 목적으로 유출되거나 가공되지 않음을 보장합니다.</p>
                            
                            <p className="font-bold text-secondary text-xs">📌 제 4조 (이용요금 및 결제 / 환불 정책) 💳</p>
                            <p>1. 사용자는 플랫폼이 제시한 요금제(구독형 등)에 따라 선결제 후 서비스를 이용할 수 있습니다.<br />
                            2. 디지털 콘텐츠 및 AI 생성 서비스 특성상, 결제 후 **사용 이력(AI 생성 1회 이상)이 있는 경우**에는 전자상거래법 e-상거래법에 의거하여 환불이 절대 불가합니다.<br />
                            3. 사용 이력이 없으며 결제 후 7일 이내인 경우에 한해 고객센터를 통해 전액 환불을 요청할 수 있습니다.</p>

                            <p className="font-bold text-secondary text-xs">📌 제 5조 (서비스 이용 상한 및 어뷰징 제한) 🚨</p>
                            <p>플랫폼에 주입된 비즈니스 정적 팩트 및 장기 기억의 누적 갱신 주기는 타 가맹점/타 매장 명의 무단 교환(어뷰징)을 방지하기 위하여 <span className="text-xs font-black underline text-secondary">30일에 1회</span>로 엄격하게 수정 및 업데이트 상한이 제한됩니다.</p>
                            
                            <p className="font-bold text-secondary text-xs">📌 제 6조 (회사의 면책 및 보증의 한계)</p>
                            <p>1. 인공지능(AI)이 생성하는 모든 마케팅 기획안, 글투, 이미지의 정확성/적법성에 대한 최종 검토 귀속 책임은 전적으로 회원(사용자)에게 있습니다.<br />
                            2. AI 생성물의 도작이나 저작권 상 충돌로 인한 법적 분쟁 시 회사는 일체의 책임을 지지 않으며, 어떠한 보증도 제공하지 않습니다.</p>

                            <p className="font-bold text-secondary text-xs">📌 제 7조 (관할 법원)</p>
                            <p>본 이용약관과 관련하여 발생하는 모든 분쟁은 회사의 본점 소재지를 관할하는 법원을 전속 관할 법원으로 하여 해결하기로 합니다.</p>
                        </div>
                        <button type="button" onClick={() => setShowTermsModal(false)} className="mt-6 w-full py-3 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-md">
                            확인 및 닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
