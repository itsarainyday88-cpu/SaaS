/**
 * Global type declarations for the Electron Context Bridge API.
 * This makes `window.electron` type-safe in all React/Next.js components.
 */

import type { ElectronAPI } from '../electron/preload';

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}

export { };
