import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    // 1. [공식] Supabase SSR 서버 클라이언트 연동 가설
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // 2. [공식] 서버사이드에서 세션 유저 강제 검증 (쿠키 자동 리프레시)
    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;

    const isPublicPath =
        path === '/login' ||
        path === '/register' ||
        path === '/forgot-password' ||
        path === '/handoff' ||
        path.startsWith('/api/handoff') ||
        path.startsWith('/api/auth') ||
        path.startsWith('/_next') ||
        path.startsWith('/static') ||
        path.includes('.');

    // Redirect logic
    if (!user && !isPublicPath) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (user && (path === '/login' || path === '/register')) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
