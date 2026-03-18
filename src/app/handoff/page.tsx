'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Cpu, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

function HandoffContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('데이터를 불러오는 중...');

    const fetchedRef = typeof window !== 'undefined' ? (window as any)._handoffFetchedRefs || ((window as any)._handoffFetchedRefs = {}) : {};

    useEffect(() => {
        if (!id || fetchedRef[id]) return;

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/handoff?id=${id}`);
                const result = await res.json();

                if (!res.ok) throw new Error(result.error || 'Failed to fetch');

                // Send to Extension
                window.postMessage({
                    type: result.type,
                    data: result.data
                }, '*');

                fetchedRef[id] = true;
                setStatus('success');
                setMessage(`데이터 전송 완료! (${result.type})`);

            } catch (error: any) {
                setStatus('error');
                setMessage(error.message);
            }
        };

        const timer = setTimeout(fetchData, 500);
        return () => clearTimeout(timer);

    }, [id, fetchedRef]);

    return (
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
            <div className="flex justify-center mb-6">
                {status === 'loading' && <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />}
                {status === 'success' && <CheckCircle className="w-16 h-16 text-green-500" />}
                {status === 'error' && <AlertTriangle className="w-16 h-16 text-red-500" />}
            </div>

            <h1 className="text-xl font-bold mb-2 text-gray-800">
                {status === 'loading' && '확장 프로그램 연결 중...'}
                {status === 'success' && '전송 성공!'}
                {status === 'error' && '전송 실패'}
            </h1>

            <p className="text-gray-500 text-sm mb-6 break-keep">
                {message}
                {status === 'success' && <br />}
                {status === 'success' && <span className="text-xs text-blue-600 font-medium">이제 크롬 확장 프로그램(Faire Click)이 자동으로 동작할 것입니다.</span>}
            </p>

            {status === 'success' && (
                <button
                    onClick={() => window.close()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                    창 닫기
                </button>
            )}
        </div>
    );
}

export default function HandoffPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-4 font-sans text-center">
            <Suspense fallback={<Loader2 className="w-10 h-10 animate-spin text-gray-400" />}>
                <HandoffContent />
            </Suspense>
            <div className="mt-8 text-xs text-gray-400">
                Seoul Yonsei Marketing OS • Secure Handoff Bridge
            </div>
        </div>
    );
}
