import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/memory-store';
import crypto from 'crypto';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', // Support high-quality image transfers
        },
    },
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, data } = body;

        const id = crypto.randomUUID();
        // Expires in 5 minutes
        dataStore.set(id, { type, data, expires: Date.now() + 5 * 60 * 1000 });

        return NextResponse.json({ success: true, id });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save handoff data' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !dataStore.has(id)) {
        return NextResponse.json({ error: 'Data not found or expired' }, { status: 404 });
    }

    const entry = dataStore.get(id)!;

    // Check expiry
    if (Date.now() > entry.expires) {
        dataStore.delete(id);
        return NextResponse.json({ error: 'Data expired' }, { status: 410 });
    }

    // Optional: Delete after read (One-time use) - but keeping it for a moment is safer for refresh
    // dataStore.delete(id);

    return NextResponse.json({ success: true, type: entry.type, data: entry.data });
}
