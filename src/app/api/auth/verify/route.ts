import { NextResponse } from 'next/server';
import { codeStore } from '@/lib/memory-store';
import { login } from '@/lib/session';

export async function POST(request: Request) {
    try {
        const { email, code } = await request.json();

        const record = codeStore.get(email);

        if (!record) {
            return NextResponse.json({ error: 'No verification code found. Request a new one.' }, { status: 400 });
        }

        if (Date.now() > record.expires) {
            codeStore.delete(email);
            return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
        }

        if (record.code !== code) {
            return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
        }

        // Success
        codeStore.delete(email); // Invalidate code
        await login(email);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
