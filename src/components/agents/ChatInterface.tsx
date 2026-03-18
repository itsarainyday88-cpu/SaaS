'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Mic, Cpu, Bot, User, Save, ShieldAlert, CheckCircle, AlertTriangle, X, FileText, Square, Sparkles, ExternalLink } from 'lucide-react';
import { useAgent } from '@/context/AgentContext';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface Message {
    role: 'user' | 'model';
    content: string;
    audit?: {
        status: 'pending' | 'safe' | 'warning';
        reason?: string;
    };
}

export default function ChatInterface() {
    const { activeAgent, setActiveAgent, agentMessagesRef, selectedTopic, setSelectedTopic, refreshCredits } = useAgent();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);

    // [📌 추가 크레딧 관련 UI 모달]
    const { setIsChargeModalOpen } = useAgent(); // 글로벌 모달 스위치 회수

    const CreditWarningModal = () => (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full border border-sand/30 shadow-2xl space-y-5 text-center">
                <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center border border-amber-300">
                    <Sparkles className="w-6 h-6 text-amber-600 animate-pulse" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-black text-xl text-secondary">크레딧이 부족합니다 🚨</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">오늘의 마케팅 캔버스가 막 개화했습니다.<br/>크레딧을 충전하고 연속 기획을 이어나가세요!</p>
                </div>
                <div className="space-y-2pt-2">
                    <button 
                        onClick={() => {
                            setShowCreditModal(false); // 경고창 닫고
                            setIsChargeModalOpen(true); // 👑 원장님 요금 단가표 충전창 띄우기
                        }} 
                        className="w-full p-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all scale-[1.02] hover:scale-[1.05] flex items-center justify-center gap-2"
                    >
                         <span>크레딧 충전하러 가기</span>
                         <ExternalLink className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowCreditModal(false)} className="w-full p-3 bg-white border border-sand/30 text-secondary/60 hover:bg-sand/5 font-bold rounded-2xl text-sm transition-colors">
                         나중에 충전하기
                    </button>
                </div>
            </div>
        </div>
    );
    const [attachments, setAttachments] = useState<{ name: string; content: string; url?: string }[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Watch for topic injection from CalendarView
    useEffect(() => {
        if (selectedTopic) {
            setInput(`[캘린더 작업 예약건]\n주제: ${selectedTopic}\n\n내용에 맞춰 콘텐츠를 작성해 주세요`);
            setSelectedTopic('');
        }
    }, [selectedTopic, setSelectedTopic]);

    // Save current agent's history and restore new agent's history
    const prevAgentRef = useRef<string>(activeAgent);

    // Save current messages when agent changes, restore new agent's history
    useEffect(() => {
        const prev = prevAgentRef.current;
        const current = activeAgent;

        if (prev !== current) {
            // Save previous agent's messages (only if more than welcome msg)
            if (messages.length > 1) {
                agentMessagesRef.current.set(prev, messages);
            }
            prevAgentRef.current = current;
        }

        // Restore or create welcome message for new agent
        const saved = agentMessagesRef.current.get(current);
        if (saved && saved.length > 0) {
            setMessages(saved);
        } else {
            setMessages([
                {
                    role: 'model',
                    content: `**[${activeAgent}]** 에이전트 가동 준비 완료`
                }
            ]);
        }
    }, [activeAgent, agentMessagesRef]);

    // Continuously sync messages to the global ref so we never lose them on unmount (HMR/Focus loss)
    useEffect(() => {
        if (messages.length > 0) {
            agentMessagesRef.current.set(activeAgent, messages);
        }
    }, [messages, activeAgent, agentMessagesRef]);

    // Define compressImage utility on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && !(window as any).compressImage) {
            (window as any).compressImage = async (dataUrl: string, maxWidth = 1024, quality = 0.8): Promise<string> => {
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
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, width, height);
                        }
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.src = dataUrl;
                });
            };
        }
    }, []);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);

        setLoading(true);

        // Initialize AbortController
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // --- [📸 3단계 파이프라인: 지연 이미지 업로드 트랜잭션 주입] ---
            let uploadedAttachments = [...attachments];
            const needsUpload = attachments.filter((a: any) => a.file);

            if (needsUpload.length > 0) {
                console.log('[Upload] Starting deferred upload for attachments:', needsUpload.length);
                const uploadPromises = attachments.map(async (at: any) => {
                    if (at.file) { // 아직 안 올라간 파일
                        const formData = new FormData();
                        formData.append('file', at.file);
                        formData.append('agentId', activeAgent);

                        const uploadRes = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                        });

                        if (!uploadRes.ok) throw new Error(`${at.name} 이미지 분석 및 업로드에 실패했습니다.`);
                        const data = await uploadRes.json();

                        return {
                            name: at.name,
                            content: data.text || `[분석 실패 파일: ${at.name}]`,
                            url: data.url
                        };
                    }
                    return at; // 이미 업로드 완료된 스펙 상속
                });

                uploadedAttachments = await Promise.all(uploadPromises);
                console.log('[Upload] Deferred upload finished successfully.');
            }

            setMessages(prev => [...prev, { role: 'model', content: '' }]);

            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);

            // Simple intent classification for tool switching
            const searchKeywords = ['검색', '찾아', '조사', 'search', '구글', 'google', '최신', '정보', '가격', '근황'];
            const shouldSearch = searchKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

            // --- 🏭 마케터 에이전트 컨텍스트: Blog/Insta/Threads/Shortform이면 오늘 Marketer 결과 불러오기 ---
            let contextInjection = '';
            if (['Blog', 'Insta', 'Threads', 'Shortform'].includes(activeAgent)) {
                try {
                    const ctxRes = await fetch('/api/context?agentId=Marketer', { signal: controller.signal });
                    const ctxData = await ctxRes.json();
                    if (ctxData.context) {
                        contextInjection = `\n\n[🏭 오늘 마케팅 분석 결과 참조]\n${ctxData.context}\n`;
                    }
                } catch (_) { /* 컨텍스트 없으면 조용히 무시 */ }
            }

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    agentId: activeAgent,
                    message: (uploadedAttachments.length > 0
                        ? (activeAgent === 'Insta'
                            ? `[📸 사용자 첨부 이미지]\n${uploadedAttachments.map((a: any) => `![${a.name}](${a.url})`).join('\n')}\n\n[필독 지시]\n이 이미지들을 인스타그램 게시물 최상단에 배치해라.\n\n[사용자 요청]\n${userMessage}\n\n[이미지 분석 정보]\n${uploadedAttachments.map((a: any) => `- ${a.name}: ${a.content}`).join('\n')}`
                            : `${userMessage}\n\n[📸 이미지 분석 데이터]\n${uploadedAttachments.map((a: any) => `- ${a.name}: ${a.content}`).join('\n\n')}`)
                        : userMessage) + (contextInjection ? contextInjection : ''),
                    history: messages,
                    useSearch: shouldSearch
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 402) {
                    setShowCreditModal(true);
                    setLoading(false);
                    setMessages(prev => prev.slice(0, -1)); // 로딩 중이던 빈 말풍선 걷어내기
                    return; // 기계적 에러 뿜지 말고 조용히 모달로 넘기기
                }
                throw new Error(data.error || 'Failed to connect');
            }

            // Clear attachments only after successful send
            setAttachments([]);

            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accumulatedResponse += chunk;

                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'model') {
                        lastMsg.content = accumulatedResponse;
                    }
                    return newMessages;
                });
            }

            // --- Marketer 결과 오늘 날짜로 로컬 저장 ---
            if (activeAgent === 'Marketer' && accumulatedResponse.length > 100) {
                fetch('/api/context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: 'Marketer', content: accumulatedResponse }),
                }).catch(() => { });
            }

            // [📸 크레딧 동기화 리프레시 타격]
            if (refreshCredits) refreshCredits().catch(() => {});

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Stream aborted by user');
                return;
            }
            console.error(error);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg?.role === 'model') {
                    lastMsg.content += '\n\n통신 오류: 응답이 중단되었습니다.';
                    return newMessages;
                }
                return [...prev, { role: 'model', content: `통신 오류: ${error.message || '통신 실패'}\n\n(잠시 후 다시 시도해 주세요)` }];
            });
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading(false);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg?.role === 'model' && !lastMsg.content) {
                    // Remove the empty message if we aborted before any content
                    return prev.slice(0, -1);
                }
                if (lastMsg?.role === 'model') {
                    lastMsg.content += `\n\n모듈 오류: 응답이 중단되었습니다.`;
                }
                return newMessages;
            });
        }
    };


    const handleSave = async () => {
        if (messages.length === 0) return;

        setLoading(true); // Indicate processing
        const date = new Date().toISOString().split('T')[0];
        const fileName = `SeoulYonsei_${activeAgent}_${date}.md`;

        let content = `# Sample Marketing OS Chat Log\nDate: ${date}\nAgent: ${activeAgent}\n\n---\n\n`;

        // Process messages to embed images
        for (const msg of messages) {
            const role = msg.role === 'user' ? 'User' : activeAgent;
            let processedContent = msg.content;

            // Find all image links relative to /generated-images/
            // Regex to find ![...](/generated-images/...)
            const imageRegex = /!\[(.*?)\]\((\/generated-images\/.*?)\)/g;
            let match;
            const replacements = [];

            while ((match = imageRegex.exec(msg.content)) !== null) {
                const fullMatch = match[0]; // ![alt](/url)
                const altText = match[1];
                const relativeUrl = match[2];

                try {
                    // Fetch the image
                    const response = await fetch(relativeUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        replacements.push({ fullMatch, newStr: `![${altText}](${base64})` });
                    }
                } catch (err) {
                    console.error('Failed to embed image:', relativeUrl, err);
                    // Keep original link if fail
                }
            }

            // Apply replacements
            for (const rep of replacements) {
                processedContent = processedContent.replace(rep.fullMatch, rep.newStr);
            }

            // Render Image Logic
            if (msg.content.includes('![AI 생성 이미지]')) {
                // Check if image failed (simple heuristic for now, or backend sends specific string)
                // Currently backend yields empty string on fail, so this might not be needed unless we send error marker.
                // let's add specific marker detection if we decide to implement it in gemini.ts later.
            }
            content += `## [${role}]\n${processedContent}\n\n---\n\n`;
        }

        // Use File System Access API if available
        try {
            // @ts-ignore
            if (window.showSaveFilePicker) {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'Markdown File',
                        accept: { 'text/markdown': ['.md'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
            } else {
                // Fallback
                const blob = new Blob([content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Failed to save file:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const results = Array.from(files).map(file => ({
            name: file.name,
            file: file,
            url: URL.createObjectURL(file),
            content: `[파일 분석 대기 중: ${file.name}]`
        }));

        setAttachments(prev => [...prev, ...results]);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };


    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                ref={(ref) => {
                    // Ref logic if needed
                }}
            >
                {/* Image Compression Utility */}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 
                    ${msg.role === 'model' ? 'bg-secondary text-primary' : 'bg-sand text-foreground'}`}>
                            {msg.role === 'model' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div className={`space-y-2 max-w-[80%]`}>
                            <div className={`p-4 rounded-2xl shadow-sm text-sm prose prose-sm max-w-none 
                                ${activeAgent === 'Shortform'
                                    ? 'prose-p:my-4 prose-p:leading-8 prose-headings:mb-3 prose-headings:mt-6 prose-ul:my-4 prose-li:my-4 prose-li:leading-8'
                                    : 'leading-relaxed prose-p:my-2'}
                        ${msg.role === 'model'
                                    ? 'bg-white rounded-tl-none border border-sand/30 text-foreground'
                                    : 'bg-secondary rounded-tr-none text-primary'}`}>
                                {(() => {
                                    let formattedContent = msg.content;

                                    // [?슚 Coding-Level Readability Engine] 
                                    if (msg.role === 'model' && activeAgent === 'Shortform') {
                                        formattedContent = formattedContent
                                            // 1. 紐⑤뱺 ??以?以꾨컮轅덉쓣 ?댁쨷 以꾨컮轅덉쑝濡?蹂??(?⑤씫 媛뺤젣 遺꾨━)
                                            .replace(/([^\n])\n([^\n])/g, '$1\n\n$2')
                                            // 2. ?レ옄由ъ뒪?? ?슗, ?ㅽ봽??蹂몃Ц/?대줈吏??ㅼ썙???욎뿉???쇱쨷 以꾨컮轅?(?뺤떎???뱀뀡 遺꾨━)
                                            .replace(/\n\s*(\d+\.)/g, '\n\n\n');
                                    }

                                    return (
                                        <ReactMarkdown
                                            rehypePlugins={[
                                                rehypeRaw,
                                                [rehypeSanitize, {
                                                    protocols: {
                                                        href: ['http', 'https', 'mailto', 'tel']
                                                    }
                                                }]
                                            ]}
                                            components={activeAgent === 'Shortform' ? {
                                                p: ({ node, ...props }) => <p className="mb-10 leading-[2.2] text-[15.5px] font-medium" {...props} />,
                                                li: ({ node, ...props }) => <li className="mb-6 leading-[2] list-none" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-xl font-black mt-14 mb-6 border-b-2 border-secondary/20 pb-2 text-secondary flex items-center gap-2" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="text-secondary font-black bg-secondary/5 px-1 rounded" {...props} />,
                                            } : {}}
                                        >
                                            {formattedContent}
                                        </ReactMarkdown>
                                    );
                                })()}
                            </div>


                            {/* HWACK: Smart Action Buttons */}
                            {msg.role === 'model' && (
                                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">

                                    {/* Cross-Agent Transfer Buttons (Marketer only) */}
                                    {activeAgent === 'Marketer' && idx > 0 && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    let fullBody = msg.content.split(/###|##|Compliance Check/i)[0].trim();
                                                    agentMessagesRef.current.set('Marketer', messages);
                                                    setActiveAgent('Blog');
                                                    setInput(`아래 마케팅 기획안을 바탕으로 네이버 블로그 글을 작성해 주세요:\n\n${fullBody}`);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                                            >
                                                블로그로 전달
                                            </button>
                                            <button
                                                onClick={() => {
                                                    let fullBody = msg.content.split(/###|##|Compliance Check/i)[0].trim();
                                                    agentMessagesRef.current.set('Marketer', messages);
                                                    setActiveAgent('Insta');
                                                    setInput(`아래 마케팅 기획안을 바탕으로 인스타그램 게시물을 작성해 주세요:\n\n${fullBody}`);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-pink-50 text-pink-700 border border-pink-200 rounded-lg hover:bg-pink-100 transition-colors"
                                            >
                                                인스타로 전달
                                            </button>
                                            <button
                                                onClick={() => {
                                                    let fullBody = msg.content.split(/###|##|Compliance Check/i)[0].trim();
                                                    agentMessagesRef.current.set('Marketer', messages);
                                                    setActiveAgent('Shortform');
                                                    setInput(`아래 마케팅 기획안을 바탕으로 숏폼 대본을 작성해 주세요:\n\n${fullBody}`);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                                            >
                                                숏폼으로 전달
                                            </button>
                                            <button
                                                onClick={() => {
                                                    let fullBody = msg.content.split(/###|##|Compliance Check/i)[0].trim();
                                                    agentMessagesRef.current.set('Marketer', messages);
                                                    setActiveAgent('Threads');
                                                    setInput(`아래 마케팅 기획안을 바탕으로 스레드 글을 작성해 주세요:\n\n${fullBody}`);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                스레드로 전달
                                            </button>
                                        </>
                                    )}

                                    {/* Naver Blog Button */}
                                    {(
                                        (activeAgent === 'Blog') ||
                                        (msg.content.includes('## 1. 블로그 포스트'))
                                    ) && idx === messages.length - 1 && (
                                            <button
                                                onClick={async () => {
                                                    let fullBody = msg.content.split(/###|##|Compliance Check/i)[0].trim();
                                                    let title = "블로그 포스트";

                                                    // Logic for specialized section extraction (if mixed content)
                                                    if (msg.content.includes('블로그 포스트')) {
                                                        const start = msg.content.indexOf('## 1. 블로그 포스트');
                                                        const end = msg.content.indexOf('## 2.');
                                                        fullBody = msg.content.substring(start, end === -1 ? undefined : end);

                                                        // Extract Title from section
                                                        const lines = fullBody.split('\n');
                                                        for (const line of lines) {
                                                            if (line.includes('## 1. 블로그 포스트')) continue;
                                                            if (line.toLowerCase().startsWith('title:')) {
                                                                title = line.replace(/title:/i, '').trim();
                                                                break;
                                                            } else if (line.startsWith('#') || line.startsWith('**')) {
                                                                title = line.replace(/[#*]/g, '').trim();
                                                                break;
                                                            }
                                                        }
                                                    } else {
                                                        // Logic for Blog Agent (Full Content)
                                                        const lines = msg.content.split('\n');
                                                        for (const line of lines) {
                                                            if (line.trim().startsWith('#') && !line.includes('##')) {
                                                                title = line.replace(/^#\s*/, '').trim();
                                                                break;
                                                            } else if (line.includes('블로그 포스트:') || line.includes('Title:')) {
                                                                title = line.split(':').slice(1).join(':').trim();
                                                                break;
                                                            }
                                                        }
                                                    }

                                                    // Sequential Block Parsing (Data Extraction)
                                                    const blocks = [];
                                                    const imageRegex = /!\[.*?\]\((.*?)\)/g;
                                                    let lastIndex = 0;
                                                    let match;

                                                    const stripMarkdown = (text: string) => {
                                                        return text
                                                            .replace(/^#+\s+/gm, '') // Headers
                                                            .replace(/(\*\*|__)([\s\S]*?)\1/g, '$2') // Bold
                                                            .replace(/(\*|_)([\s\S]*?)\1/g, '$2') // Italic
                                                            .replace(/\[([\s\S]*?)\]\([\s\S]*?\)/g, '$1') // Links
                                                            .replace(/^>\s+/gm, '') // Blockquotes
                                                            .replace(/^\s*[-*+]\s+/gm, '') // Unordered lists
                                                            .replace(/^\s*\d+\.\s+/gm, '') // Ordered lists
                                                            .trim();
                                                    };

                                                    while ((match = imageRegex.exec(fullBody)) !== null) {
                                                        const textBefore = fullBody.substring(lastIndex, match.index).trim();
                                                        if (textBefore) {
                                                            blocks.push({ type: 'text', content: stripMarkdown(textBefore) });
                                                        }

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

                                                            const compressed = await (window as any).compressImage(base64);
                                                            blocks.push({ type: 'image', data: compressed });
                                                        } catch (err) { }
                                                        lastIndex = imageRegex.lastIndex;
                                                    }

                                                    const remainingText = fullBody.substring(lastIndex).trim();
                                                    if (remainingText) {
                                                        blocks.push({ type: 'text', content: stripMarkdown(remainingText) });
                                                    }

                                                    const postData = {
                                                        title: title,
                                                        content: stripMarkdown(fullBody),
                                                        blocks: blocks
                                                    };

                                                    const dataSize = JSON.stringify(postData).length / (1024 * 1024);

                                                    // Use Handoff API to bridge Electron -> Chrome Extension
                                                    try {
                                                        const res = await fetch('/api/handoff', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ type: 'FAIRECLICK_UPLOAD_NAVER', data: postData })
                                                        });
                                                        const { id } = await res.json();
                                                        // Electron URL Click 諛⑹떇???고쉶?섏뿬 硫붿씤 ???곹깭瑜??좎??섎ŉ ?몃? 釉뚮씪?곗?濡??꾩?
                                                        if ((window as any).electronAPI) {
                                                            (window as any).electronAPI.send('open-external', `${window.location.origin}/handoff?id=${id}`);
                                                        } else {
                                                            window.open(`/handoff?id=${id}`, '_blank', 'noreferrer,noopener');
                                                        }
                                                    } catch (e) {
                                                        console.error('Handoff error:', e);
                                                        alert("전송 중 오류가 발생했습니다.");
                                                    }
                                                }
                                                }
                                                className="px-3 py-1.5 bg-[#03C75A] text-white rounded-lg text-xs font-bold hover:bg-[#02b351] transition-colors flex items-center gap-1"
                                            >
                                                <span>네이버 업로드</span>
                                            </button>
                                        )}

                                    {/* Instagram Button */}
                                    {(
                                        (activeAgent === 'Insta') ||
                                        (msg.content.includes('## 2.  Instagram Content'))
                                    ) && (
                                            <button
                                                onClick={async () => {
                                                    let fullContent = msg.content;
                                                    if (msg.content.includes('## 2.  Instagram Content')) {
                                                        const start = msg.content.indexOf('## 2.  Instagram Content');
                                                        const end = msg.content.indexOf('## 3.');
                                                        const section = msg.content.substring(start, end === -1 ? undefined : end);
                                                        fullContent = section.replace(/## 2\.\s*\s*Instagram\s*Content/i, '').trim();
                                                    }

                                                    // ?꾩슦誘?李??뺤옣?꾨줈洹몃옩) ?꾩넚 ???곗씠???몄쿃 (釉붾줈洹몄? ?숈씪 ?먮━)
                                                    fullContent = fullContent.split(/###|##|Compliance Check/i)[0].trim();

                                                    const imageRegex = /!\[.*?\]\((.*?)\)/g;
                                                    const stripMarkdown = (text: string) => text.replace(/^#+\s+/gm, '').replace(/(\*\*|__)([\s\S]*?)\1/g, '$2').trim();

                                                    // 1. Text Copy (Caption without image markers and without compliance check)
                                                    let rawCaption = fullContent.replace(/!\[.*?\]\(.*?\)/g, '').replace(/Nano Banana Prompt:.*?\n/gi, '');
                                                    rawCaption = rawCaption.split(/###|##|Compliance Check/i)[0].trim();

                                                    const cleanCaption = stripMarkdown(rawCaption);
                                                    try {
                                                        await navigator.clipboard.writeText(cleanCaption);
                                                    } catch (err) {
                                                        console.error('Failed to copy text:', err);
                                                    }

                                                    // 2. Image Download & Preview Logic (Slide Blocks)
                                                    let downloadCount = 0;
                                                    const blocks: any[] = [];
                                                    let lastIndex = 0;
                                                    let match;

                                                    // Loop through all images to create slides
                                                    while ((match = imageRegex.exec(fullContent)) !== null) {
                                                        const url = match[1];
                                                        const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;

                                                        let nextMatchStart = fullContent.length;
                                                        const lookaheadRegex = /!\[.*?\]\((.*?)\)/g;
                                                        lookaheadRegex.lastIndex = imageRegex.lastIndex;
                                                        const nextMatch = lookaheadRegex.exec(fullContent);
                                                        if (nextMatch) nextMatchStart = nextMatch.index;

                                                        let slideText = fullContent.substring(imageRegex.lastIndex, nextMatchStart).trim();
                                                        slideText = stripMarkdown(slideText.replace(/Nano Banana Prompt:.*?\n/gi, ''));

                                                        try {
                                                            const response = await fetch(fullUrl);
                                                            const blob = await response.blob();
                                                            const base64 = await new Promise<string>((resolve) => {
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => resolve(reader.result as string);
                                                                reader.readAsDataURL(blob);
                                                            });

                                                            const compressed = await (window as any).compressImage(base64);

                                                            blocks.push({
                                                                type: 'slide',
                                                                title: `Image ${downloadCount + 1}`,
                                                                image: compressed, // Base64 for extension preview
                                                                content: slideText || '(캡션 없음)'
                                                            });

                                                            const downloadUrl = window.URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = downloadUrl;
                                                            a.download = `insta_card_${downloadCount + 1}.jpg`;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                            window.URL.revokeObjectURL(downloadUrl);
                                                            downloadCount++;

                                                            // 釉뚮씪?곗????ㅼ쨷 ?ㅼ슫濡쒕뱶 李⑤떒 ?뱀? 寃뱀묠 諛⑹?瑜??꾪븳 誘몄꽭??吏??                                                            await new Promise(r => setTimeout(r, 300));
                                                        } catch (err) {
                                                            console.error('Failed to process image:', url, err);
                                                        }
                                                        lastIndex = imageRegex.lastIndex;
                                                    }

                                                    // Handle any remaining text before the first image
                                                    if (blocks.length > 0 && fullContent.indexOf('![') > 0) {
                                                        const initialText = stripMarkdown(fullContent.substring(0, fullContent.indexOf('![')).trim());
                                                        if (initialText) {
                                                            blocks.unshift({ type: 'text', content: initialText });
                                                        }
                                                    }

                                                    // Use Handoff API to bridge Electron -> Chrome Extension
                                                    try {
                                                        const res = await fetch('/api/handoff', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ type: 'FAIRECLICK_UPLOAD_INSTA', data: { caption: cleanCaption, blocks: blocks } })
                                                        });
                                                        const { id } = await res.json();
                                                        if ((window as any).electronAPI) {
                                                            (window as any).electronAPI.send('open-external', `${window.location.origin}/handoff?id=${id}`);
                                                        } else {
                                                            window.open(`/handoff?id=${id}`, '_blank', 'noreferrer,noopener');
                                                        }
                                                    } catch (e) {
                                                        console.error('Handoff error:', e);
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-gradient-to-tr from-[#FFDC80] via-[#F56040] to-[#833AB4] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                                            >
                                                <span>인스타 업로드</span>
                                            </button>
                                        )}

                                    {/* Shortform Script Copy Button */}
                                    {activeAgent === 'Shortform' && (
                                        <button
                                            onClick={() => {
                                                let fullBody = msg.content.split(/###|##|Compliance Check/i)[0].trim();
                                                navigator.clipboard.writeText(fullBody);
                                                alert('대본이 클립보드에 복사되었습니다.');
                                            }}
                                            className="px-3 py-1.5 bg-secondary text-primary rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                                        >
                                            <span>대본 복사하기</span>
                                        </button>
                                    )}

                                    {/* Threads Button */}
                                    {(
                                        (activeAgent === 'Threads') ||
                                        (msg.content.includes('Post 1:'))
                                    ) && idx === messages.length - 1 && (
                                            <button
                                                onClick={async () => {
                                                    let fullBody = msg.content.split(/###|##|Compliance Check/i)[0].trim();

                                                    // Copy to clipboard
                                                    try {
                                                        await navigator.clipboard.writeText(fullBody);
                                                    } catch (err) {
                                                        console.error('Failed to copy:', err);
                                                    }

                                                    // Use Handoff API to bridge Electron -> Chrome Extension
                                                    try {
                                                        const res = await fetch('/api/handoff', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ type: 'FAIRECLICK_UPLOAD_THREADS', data: { content: fullBody } })
                                                        });
                                                        const { id } = await res.json();
                                                        if ((window as any).electronAPI) {
                                                            (window as any).electronAPI.send('open-external', `${window.location.origin}/handoff?id=${id}`);
                                                        } else {
                                                            window.open(`/handoff?id=${id}`, '_blank', 'noreferrer,noopener');
                                                        }
                                                    } catch (e) {
                                                        console.error('Handoff error:', e);
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors flex items-center gap-1"
                                            >
                                                <span>스레드 업로드</span>
                                            </button>
                                        )}























                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-4 max-w-3xl animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                            <Cpu className="w-4 h-4 text-white animate-spin" />
                        </div>
                        <div className="bg-white/50 p-4 rounded-2xl rounded-tl-none border border-sand/20 text-secondary text-sm">
                            생각 중...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/50 backdrop-blur border-t border-sand/30">
                <div className="relative flex items-end gap-2 bg-white border border-sand/40 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-secondary/20 focus-within:border-secondary transition-all">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        multiple
                        accept=".pdf,.txt,.md,.pptx,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.csv"
                    />
                    {process.env.NEXT_PUBLIC_APP_MODE !== 'lite' && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-gray-400 hover:text-primary transition-all rounded-xl hover:bg-secondary/20 flex flex-col items-center gap-1 min-w-[60px]"
                            title="파일 업로드(PDF/Text)"
                        >
                            <Paperclip className="w-5 h-5" />
                            <span className="text-[10px] font-bold">파일 첨부</span>
                        </button>
                    )}

                    {attachments.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-4 flex flex-wrap gap-3 w-full px-2 max-h-48 overflow-y-auto pb-4 scrollbar-none">
                            {attachments.map((file: { name: string; content: string; url?: string }, idx: number) => {
                                const isImage = file.url && (file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i));

                                if (isImage) {
                                    return (
                                        <div key={idx} className="relative group animate-in zoom-in-90 fade-in duration-200">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-secondary/30 shadow-lg bg-gray-100 ring-4 ring-white/50">
                                                <img
                                                    src={file.url}
                                                    alt={file.name}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setAttachments(prev => prev.filter((_, i: number) => i !== idx))}
                                                className="absolute -top-2 -right-2 bg-secondary text-white p-1 rounded-full shadow-md hover:bg-primary hover:text-secondary transition-all z-10 scale-0 group-hover:scale-100 duration-200"
                                            >
                                                <X className="w-3.5 h-3.5 stroke-[3px]" />
                                            </button>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                                                <span className="text-[9px] text-white font-bold truncate px-1 w-full text-center">{file.name}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-secondary/30 px-4 py-2.5 rounded-xl text-[11px] font-bold text-secondary shadow-lg animate-in fade-in slide-in-from-bottom-2 h-fit">
                                        <div className="bg-secondary/10 p-1.5 rounded-lg">
                                            <FileText className="w-4 h-4 text-secondary" />
                                        </div>
                                        <span className="max-w-[120px] truncate">{file.name}</span>
                                        <button
                                            onClick={() => setAttachments(prev => prev.filter((_, i: number) => i !== idx))}
                                            className="p-1 px-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all ml-1"
                                        >
                                            <X className="w-3.5 h-3.5 stroke-[3px]" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`${activeAgent}에게 명령 입력...`}
                        className="flex-1 max-h-32 min-h-[60px] py-4 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-gray-400 resize-none ml-2"
                    />
                    <div className="flex flex-col gap-2 pb-1 pr-1">
                        <button
                            onClick={handleSave}
                            disabled={loading || messages.length === 0}
                            className="flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-primary hover:bg-secondary/30 rounded-xl transition-all font-bold text-[10px] border border-transparent hover:border-secondary/20"
                            title="대화 내용 저장(.md)"
                        >
                            <Save className="w-3.5 h-3.5" />
                            <span>대화 저장</span>
                        </button>
                        {loading ? (
                            <button
                                onClick={handleStop}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-md active:scale-95 group"
                            >
                                <span className="text-xs font-black tracking-tight">중단하기</span>
                                <Square className="w-4 h-4 fill-current" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-secondary rounded-xl hover:bg-primary/95 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <span className="text-xs font-black tracking-tight">전송하기</span>
                                <Send className="w-4 h-4 translate-x-0.5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>

                {/* REMOVED BOTTOM BUTTONS - Now in Sidebar Header */}
                <div className="mt-2 text-center text-[10px] text-gray-400 flex justify-center items-center gap-4">
                    <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> 시스템 활성화됨</span>
                    <span>ㅣ</span>
                    <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> {activeAgent.toUpperCase()} 연결됨</span>
                </div>
            </div>

            {/* 🚨 [크레딧 오링 자동 경고 팝업] */}
            {showCreditModal && <CreditWarningModal />}
        </div>
    );
}
