import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
    // --- 1순위: config.txt에서 읽어온 process.env 값으로 직접 비교 ---
    const envId = process.env.LOGIN_ID;
    const envPw = process.env.LOGIN_PASSWORD;

    if (envId && envPw) {
        const idMatch = username.toLowerCase() === envId.toLowerCase();
        const pwMatch = password === envPw;
        console.log('[Auth] Using config.txt credentials. ID match:', idMatch, '/ PW match:', pwMatch);
        return idMatch && pwMatch;
    }

    // --- 2순위 (fallback): data/users.json + bcrypt ---
    try {
        const dataPath = path.join(process.cwd(), 'data', 'users.json');
        if (!fs.existsSync(dataPath)) return false;

        const users = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
        if (!user) return false;

        return await bcrypt.compare(password, user.password);
    } catch (error) {
        console.error('Auth error:', error);
        return false;
    }
}
