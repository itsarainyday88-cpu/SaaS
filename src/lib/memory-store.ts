import { supabase } from './supabase';

export const codeStore = {
    async get(email: string) {
        const { data } = await supabase
            .from('ephemeral_store')
            .select('payload')
            .eq('id', `code:${email}`)
            .single();
        return data?.payload || null;
    },
    async set(email: string, payload: { code: string; expires: number }) {
        await supabase
            .from('ephemeral_store')
            .upsert({
                id: `code:${email}`,
                type: 'verification_code',
                payload,
                expires_at: new Date(payload.expires).toISOString()
            });
    },
    async delete(email: string) {
        await supabase
            .from('ephemeral_store')
            .delete()
            .eq('id', `code:${email}`);
    }
};

export const dataStore = {
    async get(id: string) {
        const { data } = await supabase
            .from('ephemeral_store')
            .select('payload')
            .eq('id', `data:${id}`)
            .single();
        return data?.payload || null;
    },
    async set(id: string, payload: { type: string; data: any; expires: number }) {
        await supabase
            .from('ephemeral_store')
            .upsert({
                id: `data:${id}`,
                type: 'handoff_data',
                payload,
                expires_at: new Date(payload.expires).toISOString()
            });
    },
    async has(id: string) {
        const { data } = await supabase
            .from('ephemeral_store')
            .select('id')
            .eq('id', `data:${id}`)
            .single();
        return !!data;
    },
    async delete(id: string) {
        await supabase
            .from('ephemeral_store')
            .delete()
            .eq('id', `data:${id}`);
    }
};
