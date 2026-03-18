'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<'email' | 'verify' | 'reset'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
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
            setStep('reset');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, code }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Reset failed');

            router.push('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-primary text-secondary relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sand/20 via-transparent to-transparent" />

            <div className="w-full max-w-md p-8 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-sand/30 relative z-10">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-serif font-bold text-secondary mb-2">Password Recovery</h1>
                    <p className="text-sm text-secondary/70 tracking-wide uppercase">Secure Account Access</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded animate-pulse">
                        {error}
                    </div>
                )}

                {step === 'email' && (
                    <form onSubmit={handleSendCode} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Registered Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all outline-none"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-secondary text-white font-semibold hover:bg-secondary/90 transition-all flex justify-center items-center">
                            {loading ? <Loader2 className="animate-spin" /> : 'Send Verification Code'}
                        </button>
                    </form>
                )}

                {step === 'verify' && (
                    <form onSubmit={handleVerifyCode} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Enter code sent to email</label>
                            <div className="relative">
                                <CheckCircle className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all outline-none"
                                    placeholder="000000"
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-secondary text-white font-semibold hover:bg-secondary/90 transition-all flex justify-center items-center">
                            {loading ? <Loader2 className="animate-spin" /> : 'Verify identity'}
                        </button>
                    </form>
                )}

                {step === 'reset' && (
                    <form onSubmit={handleReset} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">New Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Confirm New Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl "
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-secondary text-white font-semibold hover:bg-secondary/90 transition-all flex justify-center items-center">
                            {loading ? <Loader2 className="animate-spin" /> : 'Reset Password'}
                        </button>
                    </form>
                )}

                <div className="mt-8 text-center text-sm">
                    <Link href="/login" className="text-gray-500 hover:text-secondary hover:underline">
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
