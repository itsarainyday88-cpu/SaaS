import fs from 'fs';
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), '.thinking_history');
const HEAD_FILE = path.join(HISTORY_DIR, 'HEAD');

// Ensure history directory exists
if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

interface ThinkingStep {
    id: number;
    timestamp: string;
    type: 'plan' | 'execution' | 'observation' | 'criticism';
    content: string;
}

interface ThinkingSession {
    sessionId: string;
    goal: string;
    status: string;
    steps: ThinkingStep[];
}

function getCurrentSessionPath(): string | null {
    if (!fs.existsSync(HEAD_FILE)) return null;
    const filename = fs.readFileSync(HEAD_FILE, 'utf8').trim();
    return path.join(HISTORY_DIR, filename);
}

function saveSession(data: ThinkingSession): string {
    const filename = `session_${data.sessionId}.json`;
    const filePath = path.join(HISTORY_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(HEAD_FILE, filename, 'utf8'); // Update HEAD
    return filename;
}

export const thinkingTools = {
    init_thinking: (args: { goal: string }) => {
        const sessionId = new Date().toISOString().replace(/[:.]/g, '-');
        const sessionData: ThinkingSession = {
            sessionId,
            goal: args.goal,
            status: "in_progress",
            steps: []
        };
        saveSession(sessionData);
        return { msg: "Thinking session initialized", sessionId, goal: args.goal };
    },

    add_thought_step: (args: { content: string; type: 'plan' | 'execution' | 'observation' | 'criticism' }) => {
        const filePath = getCurrentSessionPath();
        if (!filePath || !fs.existsSync(filePath)) {
            return { error: "No active thinking session found. Please call 'init_thinking' first." };
        }

        const data: ThinkingSession = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const newStep: ThinkingStep = {
            id: data.steps.length + 1,
            timestamp: new Date().toISOString(),
            type: args.type,
            content: args.content
        };

        data.steps.push(newStep);
        saveSession(data);

        return { msg: "Step recorded", stepId: newStep.id, totalSteps: data.steps.length };
    },

    reflect_thinking: () => {
        const filePath = getCurrentSessionPath();
        if (!filePath || !fs.existsSync(filePath)) {
            return { error: "No active thinking session found." };
        }

        const data: ThinkingSession = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const summary = data.steps.map(s => `[${s.type.toUpperCase()}] ${s.content}`).join('\n');

        return {
            msg: "Reflection on current session",
            goal: data.goal,
            history: summary,
            instruction: "Review the history for logical gaps."
        };
    }
};
