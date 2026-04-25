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
 * 프롬프트를 분석하여 AI 생성을 허용할지, 아니면 실물 사진을 반환할지 결정합니다.
 */
export function getImagePolicy(prompt: string, excludedPaths: string[] = []): {
    shouldGenerate: boolean;
    selectedImagePath?: string;
    reason?: string;
} {
    const p = prompt.toLowerCase();

    // 0. 강제 생성 백도어 (FORCE_GENERATE)
    if (p.includes('[force_generate]')) {
        return {
            shouldGenerate: true,
            reason: 'Force generation requested via [FORCE_GENERATE] tag.'
        };
    }

    // 1. 강사/대표님 관련 키워드 (PEOPLE) - '브랜드 핵심 키워드'만 실사 매칭
    const highIntentKeywords = [
        '원장', '백성현', '이주연', '변호사', '치과', '서울대', '연세대', 
        '0.5%', 'directors', 'lawyer', 'dentist'
    ];

    // 키워드가 포함되어 있고, 70%의 확률로 실사 사진 선택 (30%는 AI의 창의적 연출을 위해 양보)
    if (highIntentKeywords.some(k => p.includes(k)) && Math.random() < 0.7) {
        let tag: ImageTag = 'group';
        
        if (p.includes('수학') || p.includes('math') || p.includes('치과') || p.includes('0.5%')) tag = 'math';
        else if (p.includes('국어') || p.includes('korean') || p.includes('변호사') || p.includes('서울대')) tag = 'korean';
        else if (p.includes('부부') || p.includes('directors')) tag = 'directors';

        const filtered = metadata.filter(img =>
            img.category === 'PEOPLE' &&
            img.tag === tag &&
            !excludedPaths.includes(img.path)
        );

        if (filtered.length > 0) {
            const selected = filtered[Math.floor(Math.random() * filtered.length)];
            return {
                shouldGenerate: false,
                selectedImagePath: selected.path,
                reason: `Brand specific real asset matched: ${tag}`
            };
        }
    }

    // 2. 비즈니스 시설 (FACILITY) - 명확한 시설 명칭일 때만 실사 매칭
    const specificFacilityKeywords = ['외관', '외경', '입구', '현관', 'exterior', 'entrance'];
    
    if (specificFacilityKeywords.some(k => p.includes(k))) {
        let facilityTag = p.includes('외') ? 'exterior' : 'entrance';
        const filtered = metadata.filter(img =>
            img.category === 'FACILITY' &&
            img.tag === facilityTag &&
            !excludedPaths.includes(img.path)
        );
        if (filtered.length > 0) {
            const selected = filtered[Math.floor(Math.random() * filtered.length)];
            return {
                shouldGenerate: false,
                selectedImagePath: selected.path,
                reason: `Specific facility asset matched: ${facilityTag}`
            };
        }
    }

    // 3. 그 외 '공부하는 학생', '교실 분위기', '열정', '신뢰' 등 추상적/일반적 키워드는 
    // AI 생성을 기본(Default)으로 하여 다채로운 비주얼을 확보함.
    return {
        shouldGenerate: true,
        reason: 'General atmosphere requested. Preferring AI generation for visual variety.'
    };

    // 3. 로고 관련 (BRANDING)
    if (p.includes('로고') || p.includes('logo')) {
        return {
            shouldGenerate: false,
            selectedImagePath: '/images/logo.png',
            reason: 'Branding asset requested'
        };
    }

    // 4. 그 외 구체적이지 않은 키워드만 AI 생성 허용 (학생 뒷모습 등)
    return {
        shouldGenerate: true,
        reason: 'No specific real asset match found. Proceeding with AI generation.'
    };
}

/**
 * AI 생성 실패 시 사용할 폴백 이미지를 선택합니다.
 */
export function getFallbackImage(prompt: string, excludedPaths: string[] = []): string {
    const policy = getImagePolicy(prompt, excludedPaths);
    // 폴백 시에도 가급적 실제 존재하는 이미지를 내보냄
    return policy.selectedImagePath || '/images/lecturers/lec_2인_01.webp';
}
