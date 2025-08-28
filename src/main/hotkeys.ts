import { globalShortcut } from 'electron';
import { SettingsRepository } from '../database/settings';

export async function registerGlobalHotkeys() {
  const settings = new SettingsRepository();
  const hotkey = await settings.getGlobalHotkey();
  
  // Register stop TTS playback hotkey
  const registered = globalShortcut.register(hotkey, () => {
    // Stop TTS playback through app coordinator
    if (global.appCoordinator) {
      global.appCoordinator.stopTTS();
    }
  });
  
  if (!registered) {
    console.error(`Failed to register global hotkey: ${hotkey}`);
  }
}

export async function updateGlobalHotkey(newHotkey: string) {
  // Unregister all hotkeys
  globalShortcut.unregisterAll();
  
  // Save new hotkey
  const settings = new SettingsRepository();
  await settings.setGlobalHotkey(newHotkey);
  
  // Re-register with new hotkey
  await registerGlobalHotkeys();
}

// Add to global for access
declare global {
  var appCoordinator: any;
}