/**
 * Search & Scrape Tool Helpers (Phase 2 - Deep Research)
 * 
 * 두 가지 마케터 전용 AI 도구:
 * 1. search_local_trends: 키워드로 네이버/구글 블로그 최신 URL 리스트를 검색
 * 2. scrape_website: 특정 URL의 본문을 마크다운으로 추출
 * 
 * Tavily API (tavily.com) 사용 - AI 전용 검색/스크래핑 서비스
 * 환경변수: TAVILY_API_KEY
 */

const TAVILY_API_BASE = 'https://api.tavily.com';

/**
 * 주변 비즈니스 관련 최신 블로그 글/URL 리스트를 검색해서 반환.
 * 마케터가 자율적으로 "트렌드 조사" 지시를 받았을 때 호출.
 */
export async function search_local_trends(args: { query: string; max_results?: number; days?: number; exclude_domains?: string[] }) {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
        console.warn('[Search] TAVILY_API_KEY not set. Returning mock data.');
        return {
            error: 'TAVILY_API_KEY가 설정되지 않았습니다. .env.local 파일에 TAVILY_API_KEY를 추가해 주세요.',
            fallback_message: '실시간 검색 기능을 사용하려면 Tavily API 키가 필요합니다. tavily.com에서 무료로 발급받을 수 있습니다.'
        };
    }

    try {
        const resp = await fetch(`${TAVILY_API_BASE}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: args.query,
                search_depth: 'basic',
                include_domains: ['blog.naver.com', 'blog.daum.net', 'm.blog.naver.com'],
                exclude_domains: [
                    'blog.naver.com/seoul_yonsei',
                    'm.blog.naver.com/seoul_yonsei',
                    ...(args.exclude_domains ?? [])
                ],
                max_results: args.max_results ?? 7,
                // 최근 90일(3개월) 이내 문서만 수집하여 최신 트렌드 보장.
                days: args.days ?? 90,
                include_answer: false,
                include_raw_content: false,
            })
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('[Search] Tavily API error:', resp.status, errText);
            return { error: `검색 API 오류 (${resp.status}): ${errText}` };
        }

        const data = await resp.json();
        const results = (data.results || []).map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.content?.substring(0, 300),
            published_date: r.published_date,
        }));

        console.log(`[Search] Found ${results.length} results for "${args.query}"`);
        return { query: args.query, count: results.length, results };

    } catch (e: any) {
        console.error('[Search] Network error:', e.message);
        return { error: `네트워크 오류: ${e.message}` };
    }
}

/**
 * 특정 URL의 웹페이지 본문을 마크다운 텍스트로 추출.
 * 마케터가 search_local_trends로 찾은 URL을 직접 읽을 때 호출.
 */
export async function scrape_website(args: { url: string }) {
    const apiKey = process.env.TAVILY_API_KEY;

    // [🚨 Security] 자사 블로그 스크래핑 방지 (자기 복제 및 검색 누락 방지)
    if (args.url.includes('blog.naver.com/seoul_yonsei') || args.url.includes('m.blog.naver.com/seoul_yonsei')) {
        console.warn(`[Scrape] Blocked self-scraping attempt: ${args.url}`);
        return { error: '자사 블로그의 내용은 스크래핑할 수 없습니다. 대신 자신의 지식과 다른 외부 자료를 참고하세요.' };
    }

    if (!apiKey) {
        return {
            error: 'TAVILY_API_KEY가 설정되지 않았습니다.',
        };
    }

    try {
        const resp = await fetch(`${TAVILY_API_BASE}/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                urls: [args.url],
                include_images: false,
            })
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('[Scrape] Tavily extract error:', resp.status, errText);
            return { error: `스크래핑 API 오류 (${resp.status}): ${errText}` };
        }

        const data = await resp.json();
        const result = data.results?.[0];
        if (!result || !result.raw_content) {
            return { error: '해당 URL에서 본문을 추출하지 못했습니다.' };
        }

        // 본문을 3000자 이내로 잘라서 토큰 낭비 방지
        const content = result.raw_content.substring(0, 3000);
        console.log(`[Scrape] Extracted ${content.length} chars from "${args.url}"`);

        return {
            url: args.url,
            title: result.title,
            content,
        };

    } catch (e: any) {
        console.error('[Scrape] Network error:', e.message);
        return { error: `네트워크 오류: ${e.message}` };
    }
}

export const searchTools = { search_local_trends, scrape_website };
