'use client';

import React from 'react';
import { X, Sparkles, CreditCard, ShoppingBag } from 'lucide-react';

interface CreditChargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    tier: 'Basic' | 'Pro';
}

// 👑 [원장님 지시 최종 확정 단가표 격실]
const TOPUP_PRICES = {
    Basic: [
        { points: 100, price: 25000, label: '에이전트 1회 가동분', discount: '' },
        { points: 300, price: 66000, label: '블로그 약 7회분', discount: '11% 할인' },
        { points: 500, price: 100000, label: '대량 충전 할인 적용', discount: '20% 할인' }
    ],
    Pro: [
        { points: 100, price: 18000, label: '에이전트 1회 가동분', discount: '28% 우대' },
        { points: 300, price: 48000, label: '블로그 약 7회분', discount: '35% 우대' },
        { points: 500, price: 75000, label: '대량 충전 할인 적용', discount: '40% 우대' }
    ]
};

export default function CreditChargeModal({ isOpen, onClose, tier = 'Basic' }: CreditChargeModalProps) {
    if (!isOpen) return null;

    const items = TOPUP_PRICES[tier];

    const handlePayment = (points: number, price: number) => {
        // [🚨 로드맵] 2단계 포트원(Portone) 결제 연동 브릿지 유도 예정 격실
        alert(`[결제 연동 예정] ${points}pt 상품 구매창 진입\n금액: ${price.toLocaleString()}원 (VAT 별도)`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Background Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Body */}
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header Container */}
                <div className="relative p-6 pb-4 border-b border-slate-800/80">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-1">
                        <ShoppingBag className="w-5 h-5 text-amber-500" />
                        <span className="text-xs font-bold text-amber-500 tracking-wider">CREDIT SHOP</span>
                    </div>
                    
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        추가 크레딧 충전
                        {tier === 'Pro' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                                <Sparkles className="w-3 h-3" /> 우대 요금 적용
                            </span>
                        )}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        구독 포인트 소진 시 유저가 별도로 구매하는 단가입니다. (VAT 별도)
                    </p>
                </div>

                {/* Content Container (Card List) */}
                <div className="p-6 space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="group relative rounded-xl bg-slate-800/50 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all cursor-pointer p-4 flex items-center justify-between"
                             onClick={() => handlePayment(item.points, item.price)}>
                            
                            {item.discount && (
                                <div className="absolute top-2 right-2 text-[10px] bg-red-500/20 text-red-500 border border-red-500/30 font-bold px-1.5 py-0.5 rounded">
                                    {item.discount}
                                </div>
                            )}

                            <div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-white">{item.points}</span>
                                    <span className="text-sm font-bold text-slate-400">pt</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    {item.label}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-lg font-black text-amber-400">
                                    {item.price.toLocaleString()}<span className="text-xs font-normal text-slate-400">원</span>
                                </div>
                                <button className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-300 group-hover:text-amber-400 transition-colors">
                                    <CreditCard className="w-3.5 h-3.5" /> 결제하기
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Notice */}
                <div className="p-4 bg-slate-800/30 border-t border-slate-800/50 text-center">
                    <p className="text-[10px] text-slate-500">
                        본 상품은 결제 즉시 보유 크레딧(Topup)에 합산 적립됩니다.
                    </p>
                </div>

            </div>
        </div>
    );
}
