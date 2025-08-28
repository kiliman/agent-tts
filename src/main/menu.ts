import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'path';
import { store, mainWindow } from './main';
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

export function updateTrayMenu() {
  if (!tray) return;
  
  const settings = new SettingsRepository();
  const profiles = store.get('profiles', []) as string[];
  const isMuted = settings.getMuteAll();
  
  // Build profile menu items
  const profileItems = profiles.map(profileName => ({
    label: profileName,
    type: 'checkbox' as const,
    checked: settings.getProfileEnabled(profileName) && !isMuted,
    enabled: !isMuted,
    click: () => {
      settings.setProfileEnabled(profileName, !settings.getProfileEnabled(profileName));
      updateTrayMenu();
      // Notify main process to update file monitoring
      if (global.fileMonitor) {
        global.fileMonitor.toggleProfile(profileName, settings.getProfileEnabled(profileName));
      }
    }
  }));
  
  const contextMenu = Menu.buildFromTemplate([
    ...profileItems,
    { type: 'separator' },
    {
      label: 'Mute All',
      type: 'checkbox',
      checked: isMuted,
      click: () => {
        settings.setMuteAll(!isMuted);
        updateTrayMenu();
        // Notify main process to update mute state
        if (global.fileMonitor) {
          global.fileMonitor.toggleMute(!isMuted);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show Logs',
      click: () => {
        if (!mainWindow) {
          require('./main').createWindow();
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
  var fileMonitor: any;
}