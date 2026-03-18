import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error('Missing required environment variables in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

/**
 * 텍스트를 적절한 길이(청크)로 나눕니다.
 * @param {string} text - 원본 텍스트
 * @param {number} chunkSize - 청크 당 최대 글자 수 (기본값: 800)
 */
function chunkText(text, chunkSize = 800) {
    // [LOGIC RETAINED]
    // 간단하게 문단 단위로 먼저 나누고, 너무 길면 강제로 자릅니다.
    const paragraphs = text.split('\n\n').filter((p) => p.trim() !== '');
    const chunks = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length <= chunkSize) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            // 문단 자체가 너무 길면 강제로 자름
            if (paragraph.length > chunkSize) {
                let p = paragraph;
                while (p.length > 0) {
                    chunks.push(p.substring(0, chunkSize));
                    p = p.substring(chunkSize);
                }
                currentChunk = '';
            } else {
                currentChunk = paragraph;
            }
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}

/**
 * 텍스트 배열을 임베딩 모델을 사용해 벡터 배열로 변환합니다.
 * @param {string[]} texts - 텍스트 배열
 * @returns {Promise<number[][]>} 벡터(Number 배열) 배열
 */
async function generateEmbeddings(texts) {
    const embeddings = [];
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    for (const text of texts) {
        try {
            // @google/generative-ai 를 사용한 임베딩 생성
            const result = await model.embedContent(text);
            embeddings.push(result.embedding.values);
        } catch (error) {
            console.error("Embedding error for chunk:", text.substring(0, 50) + "...", error);
            // 오류 발생 시 null 반환 등으로 처리할 수 있지만 여기선 빈 배열 처리
            embeddings.push([]);
        }
    }
    return embeddings;
}

/**
 * 메인 실행 함수: 텍스트 파일을 읽어 청크로 나누고, 임베딩을 생성한 뒤 Supabase에 저장합니다.
 */
async function processAndStoreData() {
    console.log('--- STARTING RAG ONBOARDING PROCESS ---');

    // 1. 데이터 읽기 (더미 파일 또는 실제 파일 경로)
    const dataPath = path.join(process.cwd(), 'scripts', 'sample_data.txt');

    if (!fs.existsSync(dataPath)) {
        console.log(`[안내] ${dataPath} 파일이 없습니다.`);
        console.log(`테스트를 위해 더미 텍스트로 진행합니다.`);

        // 테스트용 더미 데이터
        const dummyText = `
학원 운영에서 가장 중요한 것은 진정성입니다. 
아이들의 성적 향상도 중요하지만, 그 과정에서 아이들이 스스로 공부의 즐거움을 깨닫는 것이 먼저입니다.
저희 강사진은 단순히 지식을 전달하는 것을 넘어 아이들의 멘토가 되고자 합니다.

수학 클리닉의 핵심은 오답 노트에 있습니다.
틀린 문제를 단순히 다시 푸는 것이 아니라, 왜 틀렸는지를 스스로 고민하고,
그 과정에서 논리적 사고의 빈틈을 메우는 것이 진정한 수학 실력 향상의 지름길입니다.
수동적인 문제 풀이 기계가 아닌 수학적 사고를 하는 아이로 키워야 합니다.

이번 겨울 방학 특강은 이러한 철학을 바탕으로 기획되었습니다.
단기간에 선행 학습 진도를 빼는 것보다, 지난 학기의 취약점을 완벽히 보완하고
새 학기 과정을 여유 있게 받아들일 수 있는 탄탄한 기초 공사에 집중할 계획입니다.
학부모님들의 많은 관심 부탁드립니다.
      `;
        // 테스트 편의상 파일 생성 (옵션)
        // fs.writeFileSync(dataPath, dummyText.trim());
        processTextData(dummyText);
    } else {
        const actualText = fs.readFileSync(dataPath, 'utf-8');
        processTextData(actualText);
    }
}

async function processTextData(rawText) {
    console.log('1. 텍스트 분할(Chunking) 중...');
    const chunks = chunkText(rawText);
    console.log(`-> 총 ${chunks.length}개의 청크로 분할 완료.`);

    console.log('2. 텍스트 임베딩(Vector 변환) 중...');
    const embeddings = await generateEmbeddings(chunks);
    console.log(`-> 임베딩 변환 완료.`);

    console.log('3. Supabase DB 저장 시작...');
    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        // 임베딩이 정상 생성되지 않은 경우 스킵
        if (!embedding || embedding.length === 0) continue;

        const { error } = await supabase.from('archive_posts').insert({
            content: chunk,
            embedding: embedding,
            metadata: { source: 'onboarding_script', chunk_index: i },
        });

        if (error) {
            console.error(`[에러] 청크 ${i} 저장 실패:`, error.message);
        } else {
            successCount++;
            console.log(`[성공] 청크 ${i} 저장 완료.`);
        }
    }

    console.log('--- PROCESS COMPLETE ---');
    console.log(`총 ${chunks.length}개 중 ${successCount}개의 데이터가 DB에 저장되었습니다.`);
    console.log('이제 RAG 기반 유사도 검색 준비가 완료되었습니다.');
}

// 스크립트 실행
processAndStoreData();
