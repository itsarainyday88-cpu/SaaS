'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Search,
    FileText,
    Calendar as CalendarIcon,
    Download,
    Trash2,
    Send,
    Share2,
    GripVertical,
    Library
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Document = {
    id: string;
    agent_id: string;
    content: string;
    created_at: string;
    title?: string;
};

export default function ArchiveView() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [docListWidth, setDocListWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedWidth = localStorage.getItem('archiveDocListWidth');
        if (savedWidth) setDocListWidth(parseInt(savedWidth));
    }, []);

    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing && containerRef.current) {
            const containerLeft = containerRef.current.getBoundingClientRect().left;
            const newWidth = mouseMoveEvent.clientX - containerLeft;
            if (newWidth > 200 && newWidth < 600) {
                setDocListWidth(newWidth);
                localStorage.setItem('archiveDocListWidth', newWidth.toString());
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('marketing_outputs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error: any) {
            console.error('Error fetching docs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('문서를 영구 삭제하시겠습니까?')) return;

        try {
            const { error } = await supabase.from('marketing_outputs').delete().eq('id', id);
            if (error) throw error;
            if (selectedDoc?.id === id) setSelectedDoc(null);
            fetchDocuments();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const handleUploadToHwack = async (doc: Document, platform: 'NaverBlog' | 'Instagram' | 'Threads' | 'Shortform') => {
        try {
            const stripMarkdown = (text: string) => {
                return text
                    .replace(/^#+\s+/gm, '') // Headers
                    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
                    .replace(/(\*|_)(.*?)\1/g, '$2') // Italic
                    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
                    .replace(/^>\s+/gm, '') // Blockquotes
                    .replace(/^\s*[-*+]\s+/gm, '') // Unordered lists
                    .replace(/^\s*\d+\.\s+/gm, '') // Ordered lists
                    .trim();
            };

            const compressImage = async (dataUrl: string, maxWidth = 1024, quality = 0.8): Promise<string> => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        if (width > maxWidth) {
                            height = (maxWidth / width) * height;
                            width = maxWidth;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.src = dataUrl;
                });
            };

            let fullBody = doc.content.split(/🚦|🚥|Compliance Check/i)[0].trim();
            let handoffType = '';
            let postData: any = {};

            if (platform === 'NaverBlog') {
                handoffType = 'FAIRECLICK_UPLOAD_NAVER';
                let title = "보관함 포스팅";
                const lines = fullBody.split('\n');
                for (const line of lines) {
                    if (line.toLowerCase().startsWith('title:') || line.toLowerCase().startsWith('제목:')) {
                        title = line.replace(/title:|제목:/i, '').trim();
                        break;
                    } else if (line.startsWith('# ')) {
                        title = line.replace(/^#\s/, '').trim();
                        break;
                    }
                }

                const blocks = [];
                const imageRegex = /!\[.*?\]\((.*?)\)/g;
                let lastIndex = 0;
                let match;

                while ((match = imageRegex.exec(fullBody)) !== null) {
                    const textBefore = fullBody.substring(lastIndex, match.index).trim();
                    if (textBefore) blocks.push({ type: 'text', content: stripMarkdown(textBefore) });

                    const url = match[1];
                    try {
                        const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
                        const response = await fetch(fullUrl);
                        const blob = await response.blob();
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        const compressed = await compressImage(base64);
                        blocks.push({ type: 'image', data: compressed });
                    } catch (err) { }
                    lastIndex = imageRegex.lastIndex;
                }

                const remainingText = fullBody.substring(lastIndex).trim();
                if (remainingText) blocks.push({ type: 'text', content: stripMarkdown(remainingText) });

                postData = { title, content: fullBody, blocks };

            } else if (platform === 'Instagram') {
                handoffType = 'FAIRECLICK_UPLOAD_INSTA';
                const imageRegex = /!\[.*?\]\((.*?)\)/g;
                let rawCaption = fullBody.replace(/!\[.*?\]\(.*?\)/g, '').replace(/Nano Banana Prompt:.*?\n/gi, '');
                rawCaption = rawCaption.split(/🚦|🚥|Compliance Check/i)[0].trim();
                const cleanCaption = stripMarkdown(rawCaption);

                const blocks: any[] = [];
                let match;
                let downloadCount = 0;
                while ((match = imageRegex.exec(fullBody)) !== null) {
                    const url = match[1];
                    const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;

                    let nextMatchStart = fullBody.length;
                    const lookaheadRegex = /!\[.*?\]\((.*?)\)/g;
                    lookaheadRegex.lastIndex = imageRegex.lastIndex;
                    const nextMatch = lookaheadRegex.exec(fullBody);
                    if (nextMatch) nextMatchStart = nextMatch.index;

                    let slideText = fullBody.substring(imageRegex.lastIndex, nextMatchStart).trim();
                    slideText = stripMarkdown(slideText.replace(/Nano Banana Prompt:.*?\n/gi, ''));

                    try {
                        const response = await fetch(fullUrl);
                        const blob = await response.blob();
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });

                        const compressed = await compressImage(base64);

                        blocks.push({
                            type: 'slide',
                            title: `Image ${downloadCount + 1}`,
                            image: compressed, // Base64 for extension preview
                            content: slideText || '(캡션 없음)'
                        });

                        // 이미지 실제 다운로드 수행
                        const downloadUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `insta_card_${downloadCount + 1}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(downloadUrl);
                        downloadCount++;

                        // 브라우저의 다중 다운로드 차단 혹은 겹침 방지를 위한 딜레이 추가
                        await new Promise(r => setTimeout(r, 300));

                    } catch (err) {
                        console.error('Failed to process image:', url, err);
                    }
                }
                postData = { caption: cleanCaption, blocks };
            } else if (platform === 'Threads') {
                handoffType = 'FAIRECLICK_UPLOAD_THREADS';
                postData = { content: fullBody };
            } else if (platform === 'Shortform') {
                // Shortform doesn't have a direct upload yet, just copy to clipboard for now
                const cleanContent = fullBody.split(/🚦|🚥|Compliance Check/i)[0].trim();
                navigator.clipboard.writeText(cleanContent);
                alert('숏폼 대본이 클립보드에 복사되었습니다!');
                return;
            }

            const res = await fetch('/api/handoff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: handoffType, data: postData })
            });
            const { id } = await res.json();

            if (id) {
                if ((window as any).electronAPI) {
                    (window as any).electronAPI.send('open-external', `${window.location.origin}/handoff?id=${id}`);
                } else {
                    window.open(`/handoff?id=${id}`, '_blank', 'noreferrer,noopener');
                }
            }
        } catch (error) {
            console.error('Handoff error:', error);
            alert('데이터 전송 중 오류가 발생했습니다.');
        }
    };

    const filteredDocs = documents.filter(doc =>
        doc.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.agent_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDownload = (doc: Document) => {
        const element = document.createElement("a");
        const file = new Blob([doc.content], { type: 'text/markdown' });
        element.href = URL.createObjectURL(file);
        element.download = `Archive_${doc.agent_id}_${new Date(doc.created_at).toLocaleDateString()}.md`;
        document.body.appendChild(element);
        element.click();
    };

    return (
        <div ref={containerRef} className="flex h-full bg-white overflow-hidden relative">
            {/* List Side */}
            <aside
                className="flex flex-col border-r border-gray-100 bg-white relative shrink-0"
                style={{ width: `${docListWidth}px` }}
            >
                {/* Resizer Handle */}
                <div
                    onMouseDown={startResizing}
                    className={`absolute right-0 top-0 w-1.5 h-full cursor-col-resize transition-all z-20 flex items-center justify-center
                        ${isResizing ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                >
                    <div className={`w-[2px] h-12 rounded-full transition-colors ${isResizing ? 'bg-primary' : 'bg-gray-200 group-hover:bg-gray-300'}`} />
                </div>

                <div className="p-4 border-b border-gray-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="문서 내용 또는 에이전트 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>
                    ) : documents.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">저장된 문서가 없습니다.</div>
                    ) : (
                        filteredDocs.map((doc: Document) => (
                            <div
                                key={doc.id}
                                onClick={() => setSelectedDoc(doc)}
                                className={`p-4 border-b border-gray-50 cursor-pointer transition-all hover:bg-gray-50 group relative ${selectedDoc?.id === doc.id ? 'bg-secondary/30 border-l-4 border-l-primary' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${doc.agent_id === 'Marketer' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {doc.agent_id}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-gray-400 font-medium">
                                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '날짜 없음'}
                                        </span>
                                        <button
                                            onClick={(e) => handleDelete(doc.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all rounded-md hover:bg-red-50"
                                            title="삭제"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <h4 className="text-[13px] font-bold text-gray-800 line-clamp-1 mb-1 leading-tight pr-6">
                                    {doc.content.split('\n')[0].replace(/[#*]/g, '').trim() || '제목 없음'}
                                </h4>
                                <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed opacity-80">
                                    {doc.content.substring(0, 100).replace(/\n/g, ' ')}...
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {/* Content View Side */}
            <div className="flex-1 overflow-y-auto bg-[#FAFAFA] p-8">
                {selectedDoc ? (
                    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-sand/30 overflow-hidden">
                        <div className="p-6 border-b border-sand/30 bg-white sticky top-0 z-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <h2 className="text-[14px] font-bold text-gray-900 tracking-tight leading-none">작업 결과물 상세</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap opacity-80">
                                                {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleString() : '날짜 정보 없음'}
                                            </span>
                                            {selectedDoc.agent_id && (
                                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-tighter whitespace-nowrap">
                                                    {selectedDoc.agent_id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 ml-auto md:ml-0">
                                    <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100 shadow-inner">
                                        {selectedDoc.agent_id === 'Blog' && (
                                            <button
                                                onClick={() => handleUploadToHwack(selectedDoc, 'NaverBlog')}
                                                className="px-3 py-1.5 text-[10px] font-bold bg-[#2DB400] text-white rounded-md hover:bg-[#279c00] transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap active:scale-95"
                                            >
                                                <Send className="w-3 h-3" /> 네이버 블로그 업로드
                                            </button>
                                        )}
                                        {selectedDoc.agent_id === 'Insta' && (
                                            <button
                                                onClick={() => handleUploadToHwack(selectedDoc, 'Instagram')}
                                                className="px-3 py-1.5 text-[10px] font-bold bg-gradient-to-tr from-[#FFDC80] via-[#E1306C] to-[#5851DB] text-white rounded-md opacity-90 hover:opacity-100 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap active:scale-95"
                                            >
                                                <Share2 className="w-3 h-3" /> 인용/인스타 전송
                                            </button>
                                        )}
                                        {selectedDoc.agent_id === 'Threads' && (
                                            <button
                                                onClick={() => handleUploadToHwack(selectedDoc, 'Threads')}
                                                className="px-3 py-1.5 text-[10px] font-bold bg-black text-white rounded-md hover:bg-gray-800 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap active:scale-95"
                                            >
                                                <Share2 className="w-3 h-3" /> 스레드 업로드
                                            </button>
                                        )}
                                        {selectedDoc.agent_id === 'Shortform' && (
                                            <button
                                                onClick={() => handleUploadToHwack(selectedDoc, 'Shortform')}
                                                className="px-3 py-1.5 text-[10px] font-bold bg-secondary text-primary rounded-md hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap active:scale-95"
                                            >
                                                <Send className="w-3 h-3" /> 대본 복사하기
                                            </button>
                                        )}
                                        {/* Fallback for other agents if needed */}
                                        {!['Blog', 'Insta', 'Threads', 'Shortform'].includes(selectedDoc.agent_id) && (
                                            <span className="px-3 py-1.5 text-[10px] text-gray-400 italic">자동 업로드 미지원</span>
                                        )}
                                    </div>

                                    <div className="flex gap-0.5">
                                        <button
                                            onClick={() => handleDownload(selectedDoc)}
                                            className="p-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-100 rounded-lg"
                                            title="마크다운 다운로드"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(selectedDoc.id, e)}
                                            className="p-2 text-gray-400 hover:text-red-600 transition-all hover:bg-red-50 rounded-lg group/del"
                                            title="영구 삭제"
                                        >
                                            <Trash2 className="w-4 h-4 group-hover/del:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 prose prose-sm prose-slate max-w-none leading-relaxed">
                            <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                        <Library className="w-16 h-16 opacity-20" />
                        <p className="text-sm">보관함에서 확인하실 문서를 선택해 주세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
