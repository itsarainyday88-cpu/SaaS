const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

// 프로젝트 루트 경로를 기준으로 .env.local 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error("Missing required environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

/**
 * 사용자 쿼리에 가장 유사한 과거 문체를 Supabase에서 검색합니다.
 * @param {string} query 사용자가 작성하고자 하는 글의 주제나 핵심 키워드
 * @param {number} matchCount 반환할 최대 참고 문서 수 (기본값: 3)
 * @returns {Promise<string>} 프롬프트에 주입할 컨텍스트 텍스트 블록
 */
async function retrieveContext(query, matchCount = 3) {
    try {
        // 1. 사용자 쿼리 벡터 변환
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(query);
        const queryEmbedding = result.embedding.values;

        // 2. Supabase match_documents 함수 호출 (pgvector 유사도 검색)
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5, // 유사도 임계값 (0.5 이상이면 꽤 유사함)
            match_count: matchCount,
        });

        if (error) {
            console.error("Supabase RPC Error:", error);
            return "";
        }

        if (!documents || documents.length === 0) {
            console.log("-> [알림] 유사한 과거 참조 문서가 DB에 없습니다.");
            return "";
        }

        // 3. 검색된 문서들을 하나의 컨텍스트 문단으로 결합
        console.log(`-> [알림] 총 ${documents.length}개의 관련 문서를 찾았습니다.`);
        let context = "--- [원장님 과거 작성 글 참조 (RAG Context)] ---\n";
        documents.forEach((doc, idx) => {
            context += `[참조 ${idx + 1}]: ${doc.content}\n\n`;
        });

        return context;

    } catch (err) {
        console.error("Retrieve Error:", err);
        return "";
    }
}

/**
 * 쿼리와 참조 컨텍스트를 결합하여 Gemini에게 글 작성을 요청합니다.
 * @param {string} topic 작성할 글의 주제 
 */
async function generateBespokeContent(topic) {
    console.log(`\n주제 [${topic}]에 대한 Bespoke 글 생성 시작...\n`);

    // 1. RAG 기반 문맥(과거 글) 가져오기
    const context = await retrieveContext(topic);

    // 2. 마스터 프롬프트 조립
    let prompt = `당신은 서울시내 명문 학원장님의 마음을 완벽히 읽고 그를 대신해 학부모 대상 커뮤니케이션(블로그, 알림장)을 작성하는 최고급 AI 비서입니다.

`;

    if (context) {
        prompt += `다음은 원장님이 과거에 직접 작성하셨던 글에서 발췌한 내용들입니다. 이 데이터에는 원장님 고유의 '문체', '어투', '자주 쓰는 비유', '강조점'이 담겨 있습니다.
반드시 이 참고 자료들의 톤 앤 매너(Tone & Manner)를 완벽하게 모방하여 글을 작성해 주세요. 
단, 참조 자료의 내용을 그대로 베끼는 것이 아니라 '형식과 어투'만 빌려와 전혀 새로운 아래의 [주제]에 맞게 써야 합니다.

${context}
`;
    } else {
        prompt += `현재 시스템에 학습된 원장님의 과거 문체 데이터가 부족합니다.
따라서, 서울대 출신의 깐깐하지만 학생을 진심으로 아끼는, 품격 있고 가독성이 높은 원장님의 페르소나를 스스로 가정하여 글을 작성해 주세요.\n\n`;
    }

    prompt += `
[작성 지시]
다음 주제에 대해 학부모님들이 읽기 좋도록 한 편의 정성스러운 안내문을 작성해 주세요. 전문성, 확신, 그리고 학부모에 대한 공감이 드러나야 합니다.

주제: ${topic}
`;

    try {
        // 3. 텍스트 생성
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite", generationConfig: { temperature: 0.7 } });
        const response = await model.generateContent(prompt);
        const text = response.response.text();

        console.log("\n================ [생성 결과] ================\n");
        console.log(text);
        console.log("\n=============================================\n");

        return text;
    } catch (err) {
        console.error("Generation Error:", err);
        throw err;
    }
}

// 스크립트를 직접 실행할 때 테스트 (원하는 주제 지정)
if (require.main === module) {
    const testTopic = process.argv[2] || "겨울방학 기말고사 대비 초밀착 수행평가 가이드";
    generateBespokeContent(testTopic);
}

module.exports = { generateBespokeContent };
