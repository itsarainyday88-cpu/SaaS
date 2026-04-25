import { NextResponse } from 'next/server';
import { codeStore } from '@/lib/memory-store';

export async function POST(request: Request) {
    try {
        const { email, code } = await request.json();

        const record = codeStore.get(email);
        if (!record) return NextResponse.json({ error: 'Validation code not found' }, { status: 400 });
        if (Date.now() > record.expires) return NextResponse.json({ error: 'Code expired' }, { status: 400 });
        if (record.code !== code) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
