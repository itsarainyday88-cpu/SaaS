import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSystemInstruction } from './agents/prompts';
import { generateAndSaveImage } from './imagen';
import { thinkingToolDefinitions, searchToolDefinitions } from './tools/definitions';
import { thinkingTools } from './tools/thinkingHelpers';
import { searchTools } from './tools/searchHelpers';
import { retrieveStyleContext } from './rag';
import { ACADEMY_HISTORY, ENTRANCE_YEAR_FACTS } from './agents/prompts';
import { supabase } from '@/lib/supabase';

const apiKey = process.env.GEMINI_API_KEY || "BUILD_TEMP_KEY";
const genAI = new GoogleGenerativeAI(apiKey);

/** 
 * 이미지 생성 실패 시 정책 엔진을 통해 최적의 실사 자산을 반환합니다.
 */
async function getFallbackImageAsync(promptText: string, usedUrls: string[] = []): Promise<string> {
    const { getFallbackImage } = await import('./image-policy');
    return getFallbackImage(promptText, usedUrls);
}

// [🚨 Academic Year Map] 서버 시간 기준 동적 학년도 계산
export const getAcademicYearContext = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // 입시 학년도 계산 (한국 기준: 현재 연도 + (4 - 학년))
    const hs3Year = currentYear + 1;
    const hs2Year = currentYear + 2;
    const hs1Year = currentYear + 3;
    const ms3Year = currentYear + 4;

    return `
[🚨 GLOBAL ACADEMIC YEAR FACT]
현재 시점: ${currentYear}년 ${currentMonth}월 (KST)
- 현 고3: ${hs3Year}학년도 대입
- 현 고2: ${hs2Year}학년도 대입
- 현 고1: ${hs1Year}학년도 대입
- 현 중3: ${ms3Year}학년도 대입
이 기준은 시스템 시각에 따른 물리적 사실이므로 모든 기획 시 반드시 준수하라.
    `;
};

// [🚨 User Intent Override] 사용자가 명시한 타겟을 코드가 직접 감지하여 AI에게 전역 강제 지침 주입
const getTargetOverrideInstruction = (message: string) => {
    const targets = [
        { patterns: /(중학|중교|중학생|중딩|중1|중2|중3)/, label: '중등부(Middle School)' },
        { patterns: /(초등|초교|초등부|초딩|초4|초5|초6)/, label: '초등부(Elementary School)' },
        { patterns: /(고3|수험생|N수|재수)/, label: '고3/N수(Senior High)' },
        { patterns: /(고2|현 고2)/, label: '고2(Junior High)' },
        { patterns: /(고1|현 고1)/, label: '고1(Freshman High)' }
    ];

    for (const t of targets) {
        if (t.patterns.test(message)) {
            return `\n\n[🚨 CRITICAL PRIORITY: USER TARGET CONTEXT]\n` +
                   `사용자가 명시적으로 특정 타겟(${t.label})을 지정했습니다.\n` +
                   `- 데이터 분석 단계를 포함한 모든 서론을 과감히 생략하고, 즉시 ${t.label} 맞춤형 전략을 출력하십시오.\n` +
                   `- "현재 김포 지역의 데이터에 따르면..." 식의 불필요한 서설을 절대 뱉지 마라. 바로 본론으로 들어가라.\n` +
                   `- 'search_local_trends' 도구는 오직 이 타겟(${t.label})의 구체적 근거를 보강하는 용도로만 사용하라.\n` +
                   `- 답변의 첫 문장부터 끝까지 오직 '${t.label}'을 위한 기획에만 매진하라.\n\n`;
        }
    }
    return '';
};

const agentTemperatures: Record<string, number> = {
    Insta: 0.95,
    Blog: 0.9,
    Threads: 0.85,
    Reputation: 0.8,
    Shortform: 0.7,
    Strategy: 0.7,
    Marketer: 0.7,
};

function getTodayContext() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const month = now.getMonth() + 1;
    const day = now.getDate();

    let academicSeason = "";
    if (month === 3) academicSeason = "새 학기 개강 및 적응기 (첫 단추의 중요성 강조)";
    else if (month === 4) academicSeason = "1학기 중간고사 대비 모드 (몰입도 극대화)";
    else if (month === 5) academicSeason = "학습 흐름 유지 및 취약점 보완기";
    else if (month === 6) academicSeason = "6월 모평 분석 및 기말고사 대비";
    else if (month === 7) academicSeason = "여름방학 특강 및 성적 반전 골든타임";
    else if (month === 8) academicSeason = "수시 원서 접수 준비 및 고3 파이널 돌입";
    else if (month === 9) academicSeason = "9월 모평 및 대입 실전 감각 강화";
    else if (month === 10) academicSeason = "2학기 중간고사 및 상위권 굳히기";
    else if (month === 11) academicSeason = "수능 마무리 및 기말고사 시즌";
    else if (month === 12) academicSeason = "학년 전환기 핵심 관리 및 겨울방학 준비";
    else if (month === 1) academicSeason = "겨울방학 초몰입 특강 시즌";
    else if (month === 2) academicSeason = "종업식 및 새 학기 선행 완성";

    return `- 오늘: ${dateStr}\n- 학사 일정 시즌: ${academicSeason}\n- 분위기: 현재 비즈니스가는 새 학기의 설렘 속에서도 상위권 도약을 위한 긴장감이 흐르고 있습니다.`;
}

// Export as a streaming generator
export async function* generateAgentResponseStream(agentId: string, message: string, history: any[] = [], useSearch: boolean = false, username: string = '', workspaceId?: string) {
    const usedImageUrls = new Set<string>(); // Track images in this post!
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    const cleanHistory = history.length > 0 && history[0].role === 'model'
        ? history.slice(1)
        : history;

    const tryStream = async function* (modelName: string, retries = 1) {
        // 모든 에이전트: 커스텀 검색 + 사고(Thinking) 도구 활성화
        let tools: any[] = [
            { googleSearch: {} }, // 👑 Tavily를 대신해 순수 구글 검색 결합 활성화
            {
                functionDeclarations: [
                    ...thinkingToolDefinitions[0].functionDeclarations,
                ]
            }
        ];

        console.log(`[Tool] Search + Thinking Tools Enabled on ${modelName}`);

        const todayContext = getTodayContext();
        let systemInstruction = getSystemInstruction(agentId, todayContext, message);

        // [🏭 SaaS Onboarding Facts Dynamic Load]
        let targetWorkspaceId = workspaceId;

        // 1. workspace_id가 없고 username만 있다면 workspace_id 조회 치환 연성
        if (!targetWorkspaceId && username) {
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('workspace_id')
                    .eq('username', username)
                    .single();
                if (profile?.workspace_id) {
                    targetWorkspaceId = profile.workspace_id;
                }
            } catch (err: any) {
                console.error('[Facts Load] Error fetching profile for workspace_id:', err.message);
            }
        }

        // 2. 통합된 targetWorkspaceId 기반으로 정보 Load
        if (targetWorkspaceId) {
            try {
                const { data: workspace } = await supabase
                    .from('workspace_settings')
                    .select('business_name, brand_facts, philosophy, tone_style')
                    .eq('id', targetWorkspaceId)
                    .single();

                if (workspace) {
                    systemInstruction += `\n\n[🏭 비즈니스 배경지식 (동적 Onboarding Data)]\n` +
                        `- 에이전트 페르소나 (상호명): ${workspace.business_name || '미설정'}\n` +
                        `- 비즈니스 철학: ${workspace.philosophy || '미설정'}\n` +
                        `- 선호 톤앤매너: ${workspace.tone_style || '미설정'}\n` +
                        `- 상세 주요 팩트:\n${workspace.brand_facts || '미설정'}\n`;
                        
                    console.log(`[Facts Load] Successfully loaded facts for workspace: ${targetWorkspaceId}`);
                }
            } catch (err: any) {
                console.error('[Facts Load] Error fetching workspace_settings:', err.message);
            }
        }

        // [🛠️ Vision Support] 메시지 내 이미지 URL 추출 및 Parts 변환 헬퍼 (초기화 단계 상단 격상)
        const prepareMessageParts = async (msg: string) => {
            const parts: any[] = [];
            const imageRegex = /!\[.*?\]\((https?:\/\/.*?|data:image\/.*?)\)/g;
            let lastIndex = 0;
            let match;

            while ((match = imageRegex.exec(msg)) !== null) {
                const textBefore = msg.substring(lastIndex, match.index);
                if (textBefore) parts.push({ text: textBefore });

                const fullTag = match[0];
                const url = match[1];

                parts.push({ text: fullTag });

                if (url.startsWith('http')) {
                    try {
                        console.log(`[Vision] Fetching image for analysis: ${url}`);
                        const response = await fetch(url);
                        if (response.ok) {
                            const buffer = await response.arrayBuffer();
                            const base64 = Buffer.from(buffer).toString('base64');
                            const mimeType = response.headers.get('content-type') || 'image/jpeg';

                            parts.push({
                                inlineData: {
                                    data: base64,
                                    mimeType: mimeType
                                }
                            });
                        }
                    } catch (err) {
                        console.error('[Vision] Failed to fetch image:', url, err);
                    }
                }
                lastIndex = imageRegex.lastIndex;
            }

            const remainingText = msg.substring(lastIndex);
            if (remainingText) parts.push({ text: remainingText });

            return parts.length > 0 ? parts : [{ text: msg }];
        };

        // --- [📸 멀티모달 3단계 파이프라인 Step 1 & 2 선행 사전 연산] ---
        const messageParts = await prepareMessageParts(message);
        const imageParts = messageParts.filter((p: any) => p.inlineData);
        let imageTags = '';

        if (imageParts.length > 0) {
            console.log('[Vision] Triggering Pre-Tagging Step 1...');
            try {
                // 속도가 가장 빠른 전술 스캔용 Flash 모델 가설 가동
                const flashModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const taggingPrompt = "이 사진에서 마케팅적으로 활용 가능한 3가지 핵심 요소(Mood, Object, Activity)를 단어 형태로 짤막하게 추출해줘. 사진에 존재하는 객관적 사실만 기술하라.";
                
                const { response } = await flashModel.generateContent([...imageParts, { text: taggingPrompt }]);
                imageTags = response.text();
                console.log('[Vision] Tagging Result:', imageTags);
            } catch (err) {
                console.error('[Vision] Pre-tagging failed:', err);
            }
        }

        if (imageTags) {
            systemInstruction += `\n\n[📸 이미지 마케팅 팩트 태그 (Step 1)]\n${imageTags}\n`;
            systemInstruction += `\n[💡 연결 기획 전략 (Step 2)]\n- 위의 [이미지 마케팅 팩트 태그]를 하단의 [🏭 비즈니스 배경지식] 과 절대적으로 융합 하십시오.\n- 사진 속 사물이 무의미한 깡통이 아님을 증명하세요. 사물이 원장의 스펙이나 학원의 구체적인 교육 철학(RAG 팩트)의 상징으로 귀결되게 사실에 근거한 스토리를 만드십시오.\n- 절대 사진에 없는 소설을 쓰지 말고 사실만 엮어라.\n`;
        }

        // [📌 핵심] 사용자가 직접 이미지를 첨부했는지 확인 (분석 우선순위 보존 목적)
        const hasUserAttachedImage = message.includes('![') || message.includes('사용자 첨부') || message.includes('이미지 정보');
        // [📌 전용 RAG] Blog 및 Threads 에이전트에 대해서만 대표님의 과거 글투(Style)를 검색하여 주입
        let styleContext = '';
        if (agentId === 'Blog' || agentId === 'Threads') {
            styleContext = await retrieveStyleContext(message);
        }
        
        if (styleContext) {
            systemInstruction += `\n\n[✍️ RAG Style Context - 실제 대표님 글투 데이터]\n` +
                `⚠️ 아래는 대표님이 직접 작성한 고퀄리티 포스팅 예시들입니다.\n` +
                `이 예시의 [단어 선택, 문장 종결 어미(하십시오체/해요체 등), 특유의 호흡]을 100% 모사하십시오.\n` +
                `어설픈 AI 말투는 지우고, 마치 대표님이 직접 쓴 것처럼 자연스럽게 작성하세요.\n\n` +
                styleContext;
        }

        // [🚨 Code-Level Precision] 모든 지능의 최정점에 사용자 의도(Override)를 배치
        const academicYearContext = getAcademicYearContext();
        const intentOverride = getTargetOverrideInstruction(message);
        
        // 대표님의 타겟 지시는 시스템 명령 중 가장 앞에 두어 AI의 기획 방향을 물리적으로 선점함
        const finalSystemInstruction = `${intentOverride}\n${systemInstruction}\n${academicYearContext}`;

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: finalSystemInstruction,
            tools: tools as any,
            generationConfig: {
                temperature: agentTemperatures[agentId] || 0.7,
                maxOutputTokens: 65536,
            },
        });

        // SDK 정석 포맷으로 변환 (History에도 시각 정보 반영)
        const chatHistory = await Promise.all(cleanHistory.map(async (msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: await prepareMessageParts(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)),
        })));

        const chat = model.startChat({
            history: chatHistory,
        });

        let currentInput: any = await prepareMessageParts(message);
        let functionCallCount = 0;
        const MAX_FUNCTION_CALLS = 10;

        // [📌 Truth-Guard] 신뢰할 수 있는 사실 정보 저장소 (숫자 기반 팩트 체크용)
        let verifiedFacts = `${message}\n${ACADEMY_HISTORY}\n${ENTRANCE_YEAR_FACTS}\n`;

        while (true) {
            let attempt = 0;
            let responseStream = null;

            while (attempt <= retries) {
                try {
                    const result = await chat.sendMessageStream(currentInput);
                    responseStream = result.stream;
                    break;
                } catch (error: any) {
                    attempt++;
                    console.error(`Gemini Stream Error (${modelName}) Attempt ${attempt}:`, error.message);
                    if (attempt > retries) throw error;
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }

            if (!responseStream) throw new Error("Failed to get response stream");

            let buffer = '';
            let isFirstTextPassed = false; // [Insta] 첫 줄 보정을 위한 플래그
            let instaHookText = ''; // [Insta] 본문 중복 검사를 위한 Hook 저장 변수
            let threadsLineCount = 0; // [Threads] 포스트당 라인수 제한
            let currentPostNum = 0; // [Threads] 현재 포스트 번호
            let inThreadsCompliance = false; // [Threads] 컴플라이언스 구간 여부
            let skipThreadsPost = false; // [Threads] 2개 초과 포스트 스킵 플래그
            let functionCallDetected = false;
            let functionCallData: any = null;

            for await (const chunk of responseStream) {
                const funcCalls = chunk.functionCalls();
                if (funcCalls && funcCalls.length > 0) {
                    functionCallDetected = true;
                    functionCallData = funcCalls[0];
                    continue;
                }

                let chunkText = '';
                try {
                    chunkText = chunk.text();
                } catch (e) {
                    continue;
                }

                if (!chunkText) continue;
                buffer += chunkText;

                if (buffer.includes('\n') || buffer.length > 2000) {
                    const lines = buffer.split('\n');
                    const remainder = buffer.endsWith('\n') ? '' : lines.pop() || '';

                    for (const line of lines) {
                        const markerRegex = /\[IMAGE_GENERATE:(.*?)\]/i;
                        const match = line.match(markerRegex);

                        if (match) {
                            // [🚨 Coding-Level Restriction] Shortform 에이전트는 이미지 생성을 원천 차단
                            if (agentId === 'Shortform') {
                                yield line.replace(match[0], '').trim() + '\n';
                                continue;
                            }

                            const fullMatch = match[0];
                            let promptText = match[1].trim().replace(/^[:\s]+/, '').trim();
                            if (promptText && promptText.length > 5) {
                                try {


                                    // Track used images to prevent duplicates in the same post
                                    const imageUrl = await generateAndSaveImage(promptText, Array.from(usedImageUrls), targetWorkspaceId);
                                    if (imageUrl) {
                                        usedImageUrls.add(imageUrl);
                                        yield line.replace(fullMatch, `\n\n![AI 생성 이미지](${encodeURI(imageUrl)})\n\n`) + '\n';
                                    } else {
                                        const fallback = await getFallbackImageAsync(promptText, Array.from(usedImageUrls));
                                        if (fallback && fallback.trim().length > 0) {
                                            usedImageUrls.add(fallback);
                                            yield line.replace(fullMatch, `\n\n![비즈니스 이미지](${encodeURI(fallback)})\n\n`) + '\n';
                                        } else {
                                            // 🛡️ [격리 완성] 대체용 로컬 사진이 없으면 엑박을 띄우지 않고 AI 텍스트만 출력함
                                            yield line.replace(fullMatch, '').trim() + '\n';
                                        }
                                    }
                                } catch (err) {
                                    const fallback = await getFallbackImageAsync(promptText, Array.from(usedImageUrls));
                                    if (fallback && fallback.trim().length > 0) {
                                        usedImageUrls.add(fallback);
                                        yield line.replace(fullMatch, `\n\n![비즈니스 이미지](${encodeURI(fallback)})\n\n`) + '\n';
                                    } else {
                                        yield line.replace(fullMatch, '').trim() + '\n';
                                    }
                                }
                            } else {
                                yield line + '\n';
                            }
                        } else {
                            let processedLine = line + '\n';

                            // [🚨 Coding-Level Restriction] Shortform 에이전트는 모든 마크다운 이미지 출력을 차단
                            if (agentId === 'Shortform') {
                                processedLine = processedLine.replace(/!\[.*?\]\(.*?\)/g, '');
                                if (!processedLine.trim()) continue; // 이미지만 있는 라인은 건너뜀
                            }

                            // [🚨 Coding-Level Filters]
                            // 1. 유령 인용구 삭제
                            processedLine = filterPhantomReferences(processedLine) + '\n';

                            // 2. [📌 Truth-Guard] 출처 불분명한 수치 환각 차단 (블로그/마케터 등 전문가 모드에서 강력 작동)
                            if (agentId !== 'Insta') {
                                processedLine = verifyFactIntegrity(processedLine, verifiedFacts);
                            }

                            if (agentId === 'Threads') {
                                // [🚨 Coding-Level Restriction] 스레드 포스트 본문/개수 제한
                                const postMatch = processedLine.match(/^Post\s+(\d+):/i);
                                if (postMatch) {
                                    const pNum = parseInt(postMatch[1]);
                                    if (pNum > 2) {
                                        skipThreadsPost = true;
                                        continue; // Post 3 이상은 표시하지 않음
                                    }
                                    currentPostNum = pNum;
                                    threadsLineCount = 0;
                                    inThreadsCompliance = false;
                                    skipThreadsPost = false;
                                    yield processedLine;
                                } else if (processedLine.trim().includes('🚦')) {
                                    inThreadsCompliance = true;
                                    skipThreadsPost = false;
                                    yield processedLine;
                                } else if (inThreadsCompliance) {
                                    yield processedLine;
                                } else if (!skipThreadsPost && processedLine.trim().length > 0) {
                                    threadsLineCount++;
                                    if (threadsLineCount <= 2) yield processedLine;
                                } else if (!skipThreadsPost) {
                                    yield processedLine;
                                }
                            } else if (agentId === 'Insta') {
                                if (!isFirstTextPassed && processedLine.trim().length > 0) {
                                    // [🚨 Fix] 이미지 라인이면 후킹 로직을 건너뛰고 '첫 번째 텍스트'로 간주하지 않음
                                    if (processedLine.trim().startsWith('![')) {
                                        yield processedLine;
                                    } else {
                                        processedLine = enforceInstaHook(processedLine.trim()) + '\n';
                                        instaHookText = processedLine.trim();
                                        isFirstTextPassed = true;
                                        yield processedLine;
                                    }
                                } else if (isFirstTextPassed && processedLine.trim().startsWith('📌')) {
                                    // 본문의 핵심 팩트가 Hook과 너무 겹치는지 검사
                                    if (!isSimilarToHook(instaHookText, processedLine)) {
                                        yield processedLine;
                                    } else {
                                        console.log(`[Insta Filter] Skipping redundant line: ${processedLine.trim()}`);
                                    }
                                } else {
                                    yield processedLine;
                                }
                            } else {
                                yield processedLine;
                            }
                        }
                    }
                    buffer = remainder;
                }
            }

            if (buffer.trim()) {
                const markerRegex = /\[IMAGE_GENERATE:(.*?)\]/i;
                const match = buffer.match(markerRegex);
                if (match) {
                    const fullMatch = match[0];
                    let promptText = match[1].trim();
                    if (promptText && promptText.length > 5) {
                        try {

                            const imageUrl = await generateAndSaveImage(promptText, Array.from(usedImageUrls), targetWorkspaceId);
                            if (imageUrl) {
                                usedImageUrls.add(imageUrl);
                                yield buffer.replace(fullMatch, `\n\n![AI 생성 이미지](${encodeURI(imageUrl)})\n\n`);
                            } else {
                                const fallback = await getFallbackImageAsync(promptText, Array.from(usedImageUrls));
                                if (fallback && fallback.trim().length > 0) {
                                    usedImageUrls.add(fallback);
                                    yield buffer.replace(fullMatch, `\n\n![비즈니스 이미지](${encodeURI(fallback)})\n\n`);
                                } else {
                                    // 🛡️ [격리 최종] 신규 가입자나 과거 이력이 없는 유저는 엑박을 아예 띄우지 않고 텅 비워버립니다.
                                    yield buffer.replace(fullMatch, '').trim();
                                }
                            }
                        } catch (e) {
                            const fallback = await getFallbackImageAsync(promptText, Array.from(usedImageUrls));
                            if (fallback && fallback.trim().length > 0) {
                                usedImageUrls.add(fallback);
                                yield buffer.replace(fullMatch, `\n\n![비즈니스 이미지](${encodeURI(fallback)})\n\n`);
                            } else {
                                yield buffer.replace(fullMatch, '').trim();
                            }
                        }
                    } else {
                        let textToYield = buffer;
                        if (agentId === 'Insta' && !isFirstTextPassed && buffer.trim().length > 0) {
                            textToYield = enforceInstaHook(buffer);
                            isFirstTextPassed = true;
                        }
                        yield textToYield;
                    }
                } else {
                    let textToYield = buffer;

                    // [🚨 Marketer 전용: 의도 기반 물리적 섹션 추출]
                    // 대표님이 특정 채널(블로그/인스타 등)만 요청했을 경우, 다른 채널의 전략은 코드가 직접 폐기함
                    if (agentId === 'Marketer') {
                        const isBlogOnly = message.includes('블로그');
                        const isInstaOnly = message.includes('인스타') || message.includes('인스타그램');
                        const isShortOnly = message.includes('숏폼') || message.includes('릴스');

                        // 특정 채널 하나만 언급된 경우, 해당 XML 태그 내용과 [Compliance Check]를 함께 추출
                        if (isBlogOnly && !isInstaOnly && !isShortOnly) {
                            const complianceMatch = textToYield.match(/(🚦 Compliance Check[\s\S]*?)$/i);
                            const complianceText = complianceMatch ? `\n\n---\n\n${complianceMatch[1]}` : '';

                            if (textToYield.includes('<blog_strategy>')) {
                                const match = textToYield.match(/<blog_strategy>([\s\S]*?)<\/blog_strategy>/);
                                if (match) {
                                    textToYield = match[1].trim() + complianceText;
                                } else {
                                    textToYield = (textToYield.split('<blog_strategy>')[1] || '') + complianceText;
                                }
                            } else if (!textToYield.includes('블로그 기획') && !textToYield.includes('Blog Strategy')) {
                                textToYield = '[기획 분석 중...]';
                            }
                        } else if (isInstaOnly && !isBlogOnly && !isShortOnly) {
                            const complianceMatch = textToYield.match(/(🚦 Compliance Check[\s\S]*?)$/i);
                            const complianceText = complianceMatch ? `\n\n---\n\n${complianceMatch[1]}` : '';

                            if (textToYield.includes('<insta_strategy>')) {
                                const match = textToYield.match(/<insta_strategy>([\s\S]*?)<\/insta_strategy>/);
                                if (match) {
                                    textToYield = match[1].trim() + complianceText;
                                } else {
                                    textToYield = (textToYield.split('<insta_strategy>')[1] || '') + complianceText;
                                }
                            } else if (!textToYield.includes('인스타') && !textToYield.includes('Insta Strategy')) {
                                textToYield = '[인스타그램 전략 수립 중...]';
                            }
                        }
                    }

                    // [🚨 Coding-Level Restriction] 모든 영문 내부 태그 찌꺼기 소거
                    textToYield = textToYield.replace(/<[^>]*>/g, ''); 
                    textToYield = textToYield.replace(/\[(Strategy|Hook|Insight|Philosophy|Vibe|Visual|Scenario|CTA|Part).*?\]/gi, '');
                    textToYield = textToYield.replace(/(Strategy|Insight|Action|Trust|Authority|Role|Prompt):\s*/gi, '');

                    // [🚨 엑박 및 텍스트 이미지 라벨 원천 차단] 
                    if (agentId === 'Shortform' || agentId === 'Marketer') {
                        textToYield = textToYield.replace(/!\[.*?\](\(.*?\))?/g, ''); 
                        textToYield = textToYield.replace(/\[IMAGE_GENERATE:.*?\]/gi, '');
                        // AI가 텍스트로 장난치는 '이미지 자리표시자' 단어들 삭제 (단독 행으로 존재할 때만 삭제하여 본문 보호)
                        textToYield = textToYield.replace(/^\s*(비즈니스 로고|원장진|원장 사진|AI 이미지|배경 이미지|비즈니스 내부|시각 자료|이미지 전략)\s*(\n|$)/gim, '');
                    }

                    // [📊 가독성 강화] 소제목(#) 위아래 여백 최적화 (2줄로 제한)
                    textToYield = textToYield.replace(/(^|\n)(#+.*?)(\n|$)/g, '$1\n$2\n');
                    textToYield = textToYield.replace(/\n{2,}/g, '\n\n'); 

                    // [🚨 Coding-Level Restriction] Threads 에러 방지용 최종 필터
                    if (agentId === 'Threads') {
                        const lines = textToYield.split('\n');
                        let finalLines = [];
                        let f_threadsLineCount = 0;
                        let f_skipThreadsPost = false;
                        let f_inThreadsCompliance = false;

                        for (const l of lines) {
                            const pm = l.match(/^Post\s+(\d+):/i);
                            if (pm) {
                                const pNum = parseInt(pm[1]);
                                if (pNum > 2) {
                                    f_skipThreadsPost = true;
                                    continue;
                                }
                                f_threadsLineCount = 0;
                                f_skipThreadsPost = false;
                                f_inThreadsCompliance = false;
                                finalLines.push(l);
                            } else if (l.trim().includes('🚦')) {
                                f_inThreadsCompliance = true;
                                f_skipThreadsPost = false;
                                finalLines.push(l);
                            } else if (f_inThreadsCompliance) {
                                finalLines.push(l);
                            } else if (!f_skipThreadsPost && l.trim().length > 0) {
                                f_threadsLineCount++;
                                if (f_threadsLineCount <= 2) finalLines.push(l);
                            } else if (!f_skipThreadsPost) {
                                finalLines.push(l);
                            }
                        }
                        textToYield = finalLines.join('\n');
                    }

                    if (agentId !== 'Insta') {
                        textToYield = verifyFactIntegrity(textToYield, verifiedFacts);
                    }
                    
                    // [🔥 결정적 수정] 마크다운 이미지 태그(![)가 포함된 버퍼는 절대 보정하지 않음 (완전할 때까지 대기)
                    if (agentId === 'Insta' && !isFirstTextPassed && buffer.trim().length > 0) {
                        const hasPartialImage = buffer.includes('![') && !buffer.includes(')');
                        if (!hasPartialImage) {
                            textToYield = enforceInstaHook(buffer);
                            isFirstTextPassed = true;
                        }
                    }
                    yield textToYield;
                }
            }

            // --- Multi-turn Function Chaining (연쇄 호출) ---
            if (functionCallDetected && functionCallData && functionCallCount < MAX_FUNCTION_CALLS) {
                functionCallCount++;
                const fnName = functionCallData.name;
                const fnArgs = functionCallData.args;

                console.log(`[Tool] Executing ${fnName}...`, fnArgs);

                // toolLabels에 따른 메시지 출력을 없애서 최종 결과물(마크다운 본문)이 오염되지 않도록 합니다.

                let toolResult: any;
                try {
                    if (fnName === 'init_thinking') toolResult = thinkingTools.init_thinking(fnArgs);
                    else if (fnName === 'add_thought_step') toolResult = thinkingTools.add_thought_step(fnArgs);
                    else if (fnName === 'reflect_thinking') toolResult = thinkingTools.reflect_thinking();
                    else toolResult = { error: "Unknown tool" };
                } catch (err: any) {
                    toolResult = { error: err.message };
                }

                // [📌 Truth-Guard] 도구 실행 결과를 사실 정보 저장소에 추가하여 실시간 검증에 활용
                if (toolResult && typeof toolResult === 'object') {
                    verifiedFacts += JSON.stringify(toolResult) + "\n";
                }

                // [Fix] SDK 요구 규격에 맞춰 content.parts 구조로 응답 전달
                const responsePart = {
                    functionResponse: {
                        name: fnName,
                        response: { content: toolResult }
                    }
                };

                currentInput = [responsePart];
                continue;
            }

            if (functionCallDetected && functionCallCount >= MAX_FUNCTION_CALLS) {
                currentInput = '지금까지 수집한 모든 정보와 도구 실행 결과를 바탕으로 최종 분석 및 기획안을 한국어로 작성하라. 더 이상 도구를 호출하지 말고 결론을 내라.';
                functionCallDetected = false;
                continue;
            }

            break;
        }
    };

    // [Final Queue] 2026 최신 모델 인텔리전스 반영 (대표님 가이드 기준)
    const modelQueue = [
        'gemini-3.1-pro-preview',       // 플래그십 (복잡한 문제 해결)
        'gemini-3-deep-think',          // 고난도 추론 특화 (Stable)
        'gemini-3-flash-preview',       // 실시간 에이전트 권장 (범용)
        'gemini-3.1-flash-lite-preview', // 가성비/저지연
        'gemini-2.5-pro',               // 멀티모달 분석 표준
        'gemini-2.5-flash'              // 안정적인 메인스트림
    ];

    let lastError: any = null;
    for (const modelName of modelQueue) {
        try {
            console.log(`[Stream] Attempting with: ${modelName}`);
            yield* tryStream(modelName, 1);
            return;
        } catch (error: any) {
            lastError = error;
            console.warn(`[Stream] Model ${modelName} failed. Reason:`, error.message);
        }
    }

    throw lastError || new Error('All latest Gemini models failed. Please check network or API quota.');
}

/**
 * [Insta 전용] 전문가 조언에 따른 물리적 출력 보정
 * 1. 첫 줄을 후킹 멘트로 간주 (지능형 길이 제한)
 * 2. 이모지가 없으면 강제 삽입 (앞/뒤/양측 유연)
 */
function enforceInstaHook(text: string): string {
    if (!text.trim()) return text;

    // [🚨 Fix] 이미지가 포함된 라인(![...])은 후킹 멘트 보정 대상에서 절대 제외 (데이터 훼손 방지)
    if (text.includes('![AI 생성 이미지]') || text.includes('![비즈니스 이미지]') || text.includes('![')) return text;

    const lines = text.split('\n');
    let firstTextLineIdx = -1;

    // 1. [성역 보호] 이미지 태그가 있는 줄은 건드리지 않고 '진짜 텍스트'가 시작되는 줄을 찾습니다.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('![') && line.includes('](')) continue; 
        if (line.length > 3) {
            firstTextLineIdx = i;
            break;
        }
    }

    if (firstTextLineIdx === -1) return text;

    let firstLine = lines[firstTextLineIdx].trim();

    // 2. [기존 기능 복구] 지능형 길이 보정 (25~30자 유연)
    // 문장 부호(. ! ?)가 20~35자 사이에 있다면 거기서 끊는 대표님의 원본 로직입니다.
    if (firstLine.length > 25) {
        const punctuationMatch = firstLine.substring(15, 35).match(/[.!?]/);
        if (punctuationMatch && punctuationMatch.index !== undefined) {
            firstLine = firstLine.substring(0, 15 + punctuationMatch.index + 1);
        } else {
            // 문장 부호가 없으면 마지막 공백 위치를 찾아 어절 단위로 자름
            const lastSpace = firstLine.lastIndexOf(' ', 28);
            if (lastSpace > 15) {
                firstLine = firstLine.substring(0, lastSpace) + '...';
            } else {
                firstLine = firstLine.substring(0, 22) + '...';
            }
        }
    }

    // 3. [기존 기능 복구] 이모지 체크 및 자동 보강
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    if (!emojiRegex.test(firstLine)) {
        firstLine = `📌 ${firstLine} 💡`;
    }

    lines[firstTextLineIdx] = firstLine;
    return lines.join('\n');
}

/**
 * [전용 필터] 존재하지 않는 이미지/카드뉴스/안내문 인용구를 코드 레벨에서 삭제합니다.
 * AI가 이미지 분석 내용을 바탕으로 "위 안내문에서 보듯" 같은 말을 지어내는 것을 방지합니다.
 */
function filterPhantomReferences(text: string): string {
    if (!text.trim()) return text;

    // 필터링할 유령 인용구 리스트 (정규식)
    const phantomPatterns = [
        /위\s+카드뉴스(에서)?\s+(확인하듯|보듯|보시는 것처럼|나와\s+있듯|제공하듯)/g,
        /위\s+안내문(에서)?\s+(확인하듯|보듯|보시는 것처럼|나와\s+있듯|제공하듯)/g,
        /이미지(에서)?\s+(확인하듯|보듯|보시는 것처럼|나와\s+있듯|적힌|나와있는)/g,
        /사진(에서)?\s+(확인하듯|보듯|보시는 것처럼|나와\s+있듯|적힌|나와있는)/g,
        /이미지\s+속\s+(정보|수치|내용|데이터|문구)/g,
        /사진\s+속\s+(정보|수치|내용|데이터|문구)/g,
        /카드뉴스\s+콘텐츠(에서)?\s+확인하듯/g,
        /카드뉴스\s+내용대로/g,
        /카드뉴스(가)?\s+말해주는/g,
        /안내문에\s+나와\s+있듯/g,
        /^위\s+내용처럼\s+/g,
        /^이미지(가)?\s+증명하듯\s+/g
    ];

    // [🚨 사용자 첨부 사진 예외] 사용자가 직접 사진을 올린 경우, 사진 묘사를 삭제하지 않음
    const hasUserImages = text.includes('![') && text.includes('supabase');
    if (hasUserImages) return text;

    let cleanedText = text;
    for (const pattern of phantomPatterns) {
        cleanedText = cleanedText.replace(pattern, '').trim();
    }

    // 문장 시작이 어색하게 짤린 경우 보정 (예: " 확인하듯 ~" -> "~")
    cleanedText = cleanedText.replace(/^\s+/, '');

    return cleanedText;
}

/**
 * [Insta 전용] Hook과 본문의 중복도를 체크합니다.
 * 명사/핵심 키워드가 60% 이상 겹치면 중복으로 판단합니다.
 */
function isSimilarToHook(hook: string, line: string): boolean {
    const clean = (t: string) => t.replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(w => w.length > 1);
    const hookWords = clean(hook);
    const lineWords = clean(line);

    if (lineWords.length === 0) return false;

    let matches = 0;
    for (const word of lineWords) {
        if (hookWords.some(hw => hw.includes(word) || word.includes(hw))) {
            matches++;
        }
    }

    // 중복 비중이 60%를 넘으면 필터링 대상
    return (matches / lineWords.length) > 0.6;
}

/**
 * [📌 Truth-Guard 엔진] 
 * 수치 데이터(인원, 확률, 연도 등)가 신뢰할 수 있는 소스에 있는지 물리적으로 검증합니다.
 * 출처가 밝혀지지 않은 허구의 수치를 뱉는 즉시 차단하거나 표시합니다.
 */
function verifyFactIntegrity(text: string, knownFacts: string): string {
    if (!text.trim()) return text;

    // 입시에서 의미 있는 수치 패턴 (명, %, 점, 학년도, 백분위, 등급 등)
    // 숫자가 포함된 민감한 입시 팩트를 정밀 타겟팅
    const factPattern = /([1-9]\d*)\s*(명|%|점|학년도|등급|위|%p|원|건|개|배|학기|대|곳|가지)/g;

    return text.replace(factPattern, (match, value) => {
        // [검증 정책] 
        // 1. 숫자가 '10' 이하라면 일반적인 서술일 가능성이 높으므로 통과
        if (parseInt(value) <= 10) return match;

        // 2. 숫자가 신뢰할 수 있는 사실(knownFacts) 문자열에 포함되어 있는지 확인
        // (단순 포함 여부만으로도 1차적인 강력한 Hallucination 차단 효과가 있음)
        if (knownFacts.includes(value)) {
            return match; // 검증 성공
        }

        // 3. 검증 실패 시: James님(개발자) 확인용 로그 및 사용자 시각화
        console.warn(`[🚨 FACT CHECK FAILED] Unverified number detected: ${match}. This value is currently NOT in our verified fact 리스트.`);
        return `[🚨 확인 필요: ${match}]`;
    });
}

