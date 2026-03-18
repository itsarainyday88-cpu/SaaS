import metadata from '../../public/images/assets-metadata.json';

export type ImageCategory = 'PEOPLE' | 'FACILITY' | 'BRANDING';
export type ImageTag = 'math' | 'korean' | 'directors' | 'group' | 'exterior' | 'entrance' | 'study_room' | 'classroom' | 'general';

interface ImageAsset {
    id: string;
    category: string;
    tag: string;
    path: string;
    original_name: string;
}

/**
 * 프롬프트를 분석하여 AI 생성을 허용할지 결정합니다.
 * 범용 SaaS 환경에서는 모든 산업군(헬스, 병원, 학원 등)의 다양성을 위해
 * 기본적으로 100% AI 생성을 원칙으로 합니다.
 */
export function getImagePolicy(prompt: string, excludedPaths: string[] = []): {
    shouldGenerate: boolean;
    selectedImagePath?: string;
    reason?: string;
} {
    // 🛡️ [마이그레이션] 이전 프로젝트의 학원 전용 실사 자산 맵핑 제거
    return {
        shouldGenerate: true,
        reason: 'General multi-tenant SaaS environment. Enforcing 100% AI Generation for diversity.'
    };
}

/**
 * AI 생성 실패 시 사용할 폴백 이미지를 선택합니다.
 * 대체할 실사 자산이 없으므로 빈 문자열("")을 반환하여 gemini.ts 가 엑박을 소거하도록 합니다.
 */
export function getFallbackImage(prompt: string, excludedPaths: string[] = []): string {
    return "";
}
