import { contextBridge, ipcRenderer } from 'electron';

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // TTS log operations
  getLogs: (limit?: number) => ipcRenderer.invoke('get-logs', limit),
  
  // Window operations
  showLogWindow: () => ipcRenderer.invoke('show-log-window'),
  
  // Listen for events from main process
  onConfigError: (callback: (error: string) => void) => {
    ipcRenderer.on('config-error', (_, error) => callback(error));
  },
  
  onTTSUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('tts-update', (_, data) => callback(data));
  },
  
  // Profile operations
  toggleProfile: (profileName: string, enabled: boolean) => {
    ipcRenderer.send('toggle-profile', profileName, enabled);
  },
  
  // Playback control
  playEntry: (entryId: number) => {
    ipcRenderer.send('play-entry', entryId);
  },
  
  pausePlayback: () => {
    ipcRenderer.send('pause-playback');
  },
  
  stopPlayback: () => {
    ipcRenderer.send('stop-playback');
  },
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key: string, value: any) => {
    ipcRenderer.send('update-setting', key, value);
  }
});