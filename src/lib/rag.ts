import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from './supabase-server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "BUILD_TEMP_KEY");
// 🛡️ [빌드 방탄] Vercel 빌드 시 API 키 누락으로 인한 모듈 크래시 방지용 가드


/**
 * 사용자 메시지와 가장 유사한 대표님의 과거 문체 데이터를 검색하여
 * 시스템 프롬프트에 주입할 컨텍스트 블록을 반환합니다.
 *
 * @param query - 사용자 입력 메시지
 * @param matchCount - 가져올 최대 참조 문서 수 (기본값: 3)
 * @returns 프롬프트에 주입할 컨텍스트 문자열 (없으면 빈 문자열)
 */
export async function retrieveStyleContext(query: string, matchCount = 3): Promise<string> {
    try {
        const supabase = await createClient();
        // 1. 쿼리를 벡터로 변환
        const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await embeddingModel.embedContent(query);
        const queryEmbedding = result.embedding.values;

        // 2. Supabase에서 RAG 전용 테이블(archive_posts) 기반 유사 문체 데이터 검색
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.4, // 낮게 설정해 더 넓은 범위 매칭
            match_count: matchCount,
        });


        if (error || !documents || documents.length === 0) {
            if (error) console.warn('[RAG] Supabase RPC error:', error.message);
            return '';
        }

        // 3. 검색된 문서를 컨텍스트 블록으로 조합
        let context = `\n\n--- [대표님 과거 작성 글 참조 데이터 (RAG)] ---\n`;
        context += `다음은 이 비즈니스 대표님이 직접 작성하신 실제 글에서 발췌한 문장들입니다.\n`;
        context += `반드시 아래 참조 데이터의 어투, 문장 구조, 자주 쓰는 표현 방식을 철저히 따라야 합니다.\n\n`;

        documents.forEach((doc: { content: string }, idx: number) => {
            context += `[참조 ${idx + 1}]\n${doc.content}\n\n`;
        });

        context += `--- [참조 데이터 끝] ---\n`;
        return context;
    } catch (err) {
        // 오류 시 조용히 실패 — 기존 글 생성 로직은 정상 동작
        console.warn('[RAG] Context retrieval failed (silent fallback):', err);
        return '';
    }
}
