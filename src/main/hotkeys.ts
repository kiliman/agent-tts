import { globalShortcut } from 'electron';
import { SettingsRepository } from '../database/settings';

export function registerGlobalHotkeys() {
  const settings = new SettingsRepository();
  const hotkey = settings.getGlobalHotkey();
  
  // Register stop TTS playback hotkey
  const registered = globalShortcut.register(hotkey, () => {
    // Emit stop event to TTS queue (will be implemented in Phase 2)
    if (global.ttsQueue) {
      global.ttsQueue.stopCurrent();
    }
  });
  
  if (!registered) {
    console.error(`Failed to register global hotkey: ${hotkey}`);
  }
}

export function updateGlobalHotkey(newHotkey: string) {
  // Unregister all hotkeys
  globalShortcut.unregisterAll();
  
  // Save new hotkey
  const settings = new SettingsRepository();
  settings.setGlobalHotkey(newHotkey);
  
  // Re-register with new hotkey
  registerGlobalHotkeys();
}

// Add to global for access
declare global {
  var ttsQueue: any;
}