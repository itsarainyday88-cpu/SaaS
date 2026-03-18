import fs from 'fs';
import path from 'path';

const MEMORY_FILE = path.join(process.cwd(), 'memory.json');

// Ensure memory file exists
if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ strategy: {}, facts: {} }, null, 2), 'utf8');
}

export interface MemoryData {
    strategy: Record<string, string>;
    facts: Record<string, { value: string; timestamp: string; permanent?: boolean }>;
}

function readMemoryFile(): MemoryData {
    try {
        const data = fs.readFileSync(MEMORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { strategy: {}, facts: {} };
    }
}

function saveMemoryFile(data: MemoryData) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export const memoryTools = {
    read_memory: () => {
        return readMemoryFile();
    },

    set_memory: (args: { key: string; value: string }) => {
        const data = readMemoryFile();
        data.strategy[args.key] = args.value;
        saveMemoryFile(data);
        return { msg: "Saved to local memory", key: args.key, value: args.value };
    },

    add_fact: (args: { key: string; value: string; isPermanent?: boolean }) => {
        const data = readMemoryFile();
        data.facts[args.key] = {
            value: args.value,
            timestamp: new Date().toISOString(),
            permanent: args.isPermanent || false
        };
        saveMemoryFile(data);
        return { msg: "Fact saved locally", key: args.key, value: args.value };
    }
};
