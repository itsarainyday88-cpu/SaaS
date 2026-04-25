import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { codeStore } from '@/lib/memory-store';

export async function POST(request: Request) {
    try {
        const { email, password, code } = await request.json();

        // Verify code again
        const record = codeStore.get(email);
        if (!record || record.code !== code || Date.now() > record.expires) {
            return NextResponse.json({ error: 'Invalid verification session' }, { status: 400 });
        }

        let updated = false;

        // 1. Update config.txt
        const configPath = path.join(process.cwd(), 'config.txt');
        if (fs.existsSync(configPath)) {
            let configContent = fs.readFileSync(configPath, 'utf8');
            if (configContent.includes('LOGIN_PASSWORD=')) {
                configContent = configContent.replace(/LOGIN_PASSWORD=.*/g, `LOGIN_PASSWORD=${password}`);
                fs.writeFileSync(configPath, configContent);
                process.env.LOGIN_PASSWORD = password; // Update in memory immediately
                updated = true;
            }
        }

        // 2. Update users.json
        const dataPath = path.join(process.cwd(), 'data', 'users.json');
        if (fs.existsSync(dataPath)) {
            const users = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            if (users.length > 0) {
                const hashedPassword = await bcrypt.hash(password, 10);
                users[0].password = hashedPassword;
                if (!users[0].email) users[0].email = email;
                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
                updated = true;
            }
        }

        if (!updated) {
            return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
        }

        // Consume code
        codeStore.delete(email);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
    }
}
