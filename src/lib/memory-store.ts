// Basic in-memory store for verification codes
// Map<email, { code, expires }>
// Note: In a production serverless environment, this would need to be Redis/DB.
// Since this is a standalone Electron app/server output, in-memory works for the session.
const globalForStore = globalThis as unknown as {
    codeStore: Map<string, { code: string; expires: number }>;
    dataStore: Map<string, { type: string; data: any; expires: number }>;
};

export const codeStore = globalForStore.codeStore || new Map<string, { code: string; expires: number }>();
export const dataStore = globalForStore.dataStore || new Map<string, { type: string; data: any; expires: number }>();

if (process.env.NODE_ENV !== 'production') {
    globalForStore.codeStore = codeStore;
    globalForStore.dataStore = dataStore;
}
