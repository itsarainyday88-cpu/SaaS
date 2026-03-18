'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

import { BRAND } from '@/lib/brand';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // 비밀번호 보기 상태
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, remember }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            router.push('/');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="min-h-screen flex items-center justify-center bg-primary text-secondary relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent" />

            {/* 📱 [모바일 꽉 찬 세로 꽉 찬 프레임 분사] */}
            <div className="w-full h-full md:h-auto md:max-w-md p-6 md:p-8 bg-white/90 md:bg-white/80 backdrop-blur-md md:rounded-2xl md:shadow-xl border-t md:border border-sand/30 md:border-sand/30 relative z-10 flex flex-col justify-center">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-serif font-bold text-secondary mb-2">Faire Click</h1>
                    <p className="text-sm text-secondary/60">by Pret-A-Mode</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded animate-pulse">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-secondary mb-2">아이디</label>
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all outline-none text-secondary"
                                placeholder="아이디를 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-secondary mb-2">비밀번호</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all outline-none text-secondary"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-3.5 text-gray-400 hover:text-secondary focus:outline-none transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between mt-3 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer text-secondary/80 hover:text-secondary group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                    />
                                    <div className="w-4 h-4 border border-sand rounded bg-white peer-checked:bg-secondary peer-checked:border-secondary transition-all"></div>
                                    <svg className="w-3 h-3 text-white absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                자동 로그인
                            </label>
                            <Link href="/forgot-password" className="text-secondary/60 hover:text-secondary hover:underline">
                                비밀번호 찾기
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center py-3.5 px-6 border border-transparent rounded-xl text-base font-semibold text-white bg-secondary hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                            <>
                                로그인 <ArrowRight className="ml-2 h-5 w-5" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-sand/30 flex justify-center text-sm">
                    <span className="text-gray-400 mr-2">계정이 없으신가요?</span>
                    <Link href="/register" className="font-semibold text-secondary hover:underline">
                        회원가입
                    </Link>
                </div>
            </div>

            <div className="absolute bottom-6 text-center w-full text-xs text-secondary/40">
                관계자 외 출입 금지
            </div>
        </div>
    );
}
