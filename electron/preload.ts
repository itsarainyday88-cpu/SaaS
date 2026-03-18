import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    openExternal: (url: string) => ipcRenderer.send('open-external', url),
});
