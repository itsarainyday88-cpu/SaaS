import { NextResponse } from 'next/server';
import { instagramPublish } from '@/lib/instagram';

export async function POST(req: Request) {
    try {
        const { caption, images } = await req.json();

        if (!caption || !images || !Array.isArray(images) || images.length === 0) {
            return NextResponse.json({ error: '본문 또는 이미지가 누락되었습니다.' }, { status: 400 });
        }

        // 인스타그램 API는 퍼블릭 URL만 인식하므로, 배포된 도메인 주소로 절대경로 변환 필요
        const origin = new URL(req.url).origin;
        const absoluteImageUrls = images.map(url => {
            if (url.startsWith('/')) return `${origin}${url}`;
            return url;
        });

        console.log('[Instagram API] Starting publish process for:', absoluteImageUrls.length, 'images');

        const result = await instagramPublish(absoluteImageUrls, caption);

        return NextResponse.json({
            success: true,
            message: '인스타그램 게시물이 성공적으로 발행되었습니다!',
            postId: result.postId
        });

    } catch (error: any) {
        console.error('[Instagram API Route Error]', error);
        return NextResponse.json({
            error: error.message || '인스타그램 발행 중 오류가 발생했습니다.'
        }, { status: 500 });
    }
}
