/**
 * Instagram Graph API 라이브러리 (Direct Publishing)
 */

const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const BASE_URL = 'https://graph.facebook.com/v19.0';

/**
 * 1단계: 미디어 컨테이너 생성 (단일 이미지 전용)
 */
async function createMediaContainer(imageUrl: string, caption: string) {
    const response = await fetch(`${BASE_URL}/${INSTAGRAM_ACCOUNT_ID}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_url: imageUrl,
            caption: caption,
            access_token: ACCESS_TOKEN
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(`Media Container Error: ${data.error.message}`);
    return data.id;
}

/**
 * 2단계: 아이템 컨테이너 생성 (카드뉴스/슬라이드용 개별 이미지)
 */
async function createItemContainer(imageUrl: string) {
    const response = await fetch(`${BASE_URL}/${INSTAGRAM_ACCOUNT_ID}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: ACCESS_TOKEN
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(`Item Container Error: ${data.error.message}`);
    return data.id;
}

/**
 * 3단계: 캐러셀(슬라이드) 컨테이너 생성
 */
async function createCarouselContainer(itemIds: string[], caption: string) {
    const response = await fetch(`${BASE_URL}/${INSTAGRAM_ACCOUNT_ID}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            media_type: 'CAROUSEL',
            children: itemIds,
            caption: caption,
            access_token: ACCESS_TOKEN
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(`Carousel Container Error: ${data.error.message}`);
    return data.id;
}

/**
 * 마지막 단계: 생성된 컨테이너 실제 발행 (Publish)
 */
async function publishMedia(creationId: string) {
    const response = await fetch(`${BASE_URL}/${INSTAGRAM_ACCOUNT_ID}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creation_id: creationId,
            access_token: ACCESS_TOKEN
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(`Publish Error: ${data.error.message}`);
    return data.id;
}

/**
 * [메인 함수] 인스타그램 직접 발행 실행
 */
export async function instagramPublish(images: string[], caption: string) {
    if (!INSTAGRAM_ACCOUNT_ID || !ACCESS_TOKEN) {
        throw new Error('인스타그램 연동 정보(Account ID/Token)가 설정되지 않았습니다.');
    }

    try {
        let creationId = '';

        if (images.length === 1) {
            // 단일 이미지 포스트
            creationId = await createMediaContainer(images[0], caption);
        } else {
            // 다중 이미지 (카드뉴스) 포스트
            console.log(`[Instagram] Creating ${images.length} item containers...`);
            const itemIds = [];
            for (const url of images) {
                const id = await createItemContainer(url);
                itemIds.push(id);
            }

            console.log('[Instagram] Creating carousel container...');
            creationId = await createCarouselContainer(itemIds, caption);
        }

        // 실제 발행
        console.log('[Instagram] Publishing final post...');
        const postId = await publishMedia(creationId);

        return { success: true, postId };
    } catch (error: any) {
        console.error('[Instagram API Error]', error);
        throw error;
    }
}
