import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
// In a real app, store codes in DB/Redis. Here using global variable for demo purposes (NOT FOR PRODUCTION SCALING). 
// Since this is a local app for one user, it's acceptable-ish but better to use a simple file or in-memory map if the server doesn't restart often.
// We'll use a simple in-memory Map for now.
import crypto from 'crypto';

// Basic in-memory store for verification codes
// Map<email, { code, expires }>
import { codeStore } from '@/lib/memory-store';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        // [보안 임시 해제] 온보딩 테스트를 위해 모든 이메일 인증번호 발송 허용
        /*
        const allowedEmails = [process.env.GMAIL_USER, 'itsarainyday88@gmail.com'].filter(Boolean);
        if (!allowedEmails.includes(email)) {
            return NextResponse.json({ error: 'Unauthorized email address' }, { status: 401 });
        }
        */

        // Generate 6-digit code
        const code = crypto.randomInt(100000, 999999).toString();
        const expires = Date.now() + 3 * 60 * 1000; // 3 minutes

        await codeStore.set(email, { code, expires });

        // Send email
        const subject = '[Faire Click] 이메일 인증번호 안내';
        const text = `안녕하세요. Faire Click 입니다.\n본인 확인을 위한 인증번호는 [ ${code} ] 입니다.\n\n해당 인증번호는 3분간 유효합니다.`;

        // Attempt to send email
        const result = await sendEmail({ to: email, subject, text });

        // Fail gracefully if email fails (development mode fallback info)
        if (!result.success) {
            console.error(`[SMTP ERROR] Failed to send email to ${email}`);
            // [📌 개발 모드 우회] 이메일 발송 실패 시 콘솔에 코드를 출력하고 그냥 성공 처리 시전!
            console.log(`\n\n[🚨 DEV MODE VERIFICATION CODE] [ ${email} ] ➡️ [ ${code} ]\n\n`);
            return NextResponse.json({ success: true, message: 'Code printed to console (DEV)', debug_code: code });
        }

        return NextResponse.json({ success: true, message: 'Code sent' });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
