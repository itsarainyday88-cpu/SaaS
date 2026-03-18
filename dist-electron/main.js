"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
// --- Single Instance Lock ---
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
    process.exit(0);
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
// --- IPC Listeners ---
electron_1.ipcMain.on('open-external', (event, url) => {
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    const chromePath = chromePaths.find(p => fs.existsSync(p));
    if (chromePath) {
        (0, child_process_1.exec)(`"${chromePath}" "${url}"`);
    }
    else {
        electron_1.shell.openExternal(url);
    }
});
// --- Load config.txt (customer-editable settings) ---
const configPath = path.join(path.dirname(electron_1.app.getPath('exe')), 'config.txt');
const fallbackConfigPath = path.join(__dirname, '..', 'config.txt');
const cfgFile = fs.existsSync(configPath) ? configPath : (fs.existsSync(fallbackConfigPath) ? fallbackConfigPath : null);
if (cfgFile) {
    const lines = fs.readFileSync(cfgFile, 'utf-8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('='))
            continue;
        const [key, ...rest] = trimmed.split('=');
        process.env[key.trim()] = rest.join('=').trim();
    }
}
// --- Configuration ---
const isDev = process.env.NODE_ENV === 'development';
let NEXT_PORT = 3000;
let NEXT_URL = `http://localhost:${NEXT_PORT}`;
let mainWindow = null;
let nextServerProcess = null;
function killPortSync(port) {
    try {
        const { execSync } = require('child_process');
        // Find PID listening on the port
        const output = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes(`:${port}`) && line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0') {
                    console.log(`Killing process ${pid} using port ${port}`);
                    // Force kill the process tree
                    execSync(`taskkill /PID ${pid} /F /T`);
                }
            }
        }
    }
    catch (e) {
        // Ignore errors if no process found or taskkill fails
        console.log(`No process found listening on port ${port} or failed to kill.`);
    }
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: '서울연세학원 마케팅 OS',
        backgroundColor: '#f5f0e8',
        icon: path.join(__dirname, '..', 'public', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
    });
    if (isDev) {
        mainWindow.loadURL(NEXT_URL);
    }
    else {
        mainWindow.loadURL(NEXT_URL);
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Handle external links - Chrome 강제 실행 (Hwack 확장프로그램이 Chrome에만 있음)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        ];
        const chromePath = chromePaths.find(p => fs.existsSync(p));
        if (chromePath) {
            (0, child_process_1.exec)(`"${chromePath}" "${url}"`);
        }
        else {
            electron_1.shell.openExternal(url); // Chrome 없으면 기본 브라우저 fallback
        }
        return { action: 'deny' };
    });
}
function waitForNextServer(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            http.get(url, (res) => {
                if (res.statusCode === 200 || res.statusCode === 307) {
                    resolve();
                }
                else {
                    retry();
                }
            }).on('error', retry);
        };
        const retry = () => {
            if (Date.now() - start > timeout) {
                reject(new Error(`Next.js server did not start within ${timeout}ms`));
            }
            else {
                setTimeout(check, 500);
            }
        };
        check();
    });
}
electron_1.app.whenReady().then(async () => {
    if (!isDev) {
        // [Stage 2: Fixed Port Allocation]
        // Faire Click chrome extension expects port 3000 exactly. Dynamic port breaks it.
        try {
            killPortSync(3000); // Force free the port if a zombie process is holding it
        }
        catch (e) {
            console.error('kill port error', e);
        }
        NEXT_PORT = 3000;
        NEXT_URL = `http://localhost:${NEXT_PORT}`;
        const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const serverPath = path.join(process.resourcesPath, 'app', 'server.js');
        const logPath = path.join(path.dirname(electron_1.app.getPath('exe')), 'server_log.txt');
        const logStream = fs.createWriteStream(logPath, { flags: 'a' });
        logStream.write(`\n--- Server Start Attempt: ${new Date().toISOString()} ---\n`);
        logStream.write(`Server Path: ${serverPath}\n`);
        logStream.write(`Assigned Port: ${NEXT_PORT}\n`);
        nextServerProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: String(NEXT_PORT) },
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: path.dirname(serverPath),
        });
        nextServerProcess.stdout?.on('data', (data) => {
            logStream.write(`[STDOUT] ${data}\n`);
        });
        nextServerProcess.stderr?.on('data', (data) => {
            logStream.write(`[STDERR] ${data}\n`);
            console.error(`Next.js server error: ${data}`);
        });
        nextServerProcess.on('error', (err) => {
            logStream.write(`[ERROR] Failed to start server: ${err.message}\n`);
        });
        // We removed server.unref() so Node keeps track of it.
    }
    await waitForNextServer(NEXT_URL);
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// [Stage 1: Graceful Shutdown of Next.js Server]
electron_1.app.on('before-quit', () => {
    if (nextServerProcess) {
        nextServerProcess.kill();
    }
});
