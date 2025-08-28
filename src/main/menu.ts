import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'path';
import { store, mainWindow, createWindow } from './main';
import { SettingsRepository } from '../database/settings';

let tray: Tray | null = null;

export function createSystemTrayMenu(): Tray {
  // Create tray icon
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  
  // For macOS, create a smaller icon
  let icon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 16, height: 16 });
  }
  
  tray = new Tray(icon);
  tray.setToolTip('Agent TTS');
  
  updateTrayMenu();
  
  return tray;
}

export async function updateTrayMenu() {
  if (!tray) return;
  
  const settings = new SettingsRepository();
  const profiles = store.get('profiles', []) as string[];
  const isMuted = await settings.getMuteAll();
  
  // Build profile menu items
  const profileItems = await Promise.all(profiles.map(async (profileName) => {
    const isEnabled = await settings.getProfileEnabled(profileName);
    return {
      label: profileName,
      type: 'checkbox' as const,
      checked: isEnabled && !isMuted,
      enabled: !isMuted,
      click: async () => {
        await settings.setProfileEnabled(profileName, !isEnabled);
        await updateTrayMenu();
        // Notify app coordinator to update profile state
        if (global.appCoordinator) {
          global.appCoordinator.toggleProfile(profileName, !isEnabled);
        }
      }
    };
  }));
  
  const contextMenu = Menu.buildFromTemplate([
    ...profileItems,
    { type: 'separator' },
    {
      label: 'Mute All',
      type: 'checkbox',
      checked: isMuted,
      click: async () => {
        await settings.setMuteAll(!isMuted);
        await updateTrayMenu();
        // Notify app coordinator to update mute state
        if (global.appCoordinator) {
          global.appCoordinator.toggleMute(!isMuted);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show Logs',
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Preferences',
      enabled: false, // Will be implemented later
      click: () => {
        // Open preferences window
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// Add to global for access from main
declare global {
  var appCoordinator: any;
}