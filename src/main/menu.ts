import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'path';
import { store, mainWindow, createWindow } from './main';
import { SettingsRepository } from '../database/settings';

let tray: Tray | null = null;

export function createSystemTrayMenu(): Tray {
  // Create a simple tray icon programmatically
  let icon: Electron.NativeImage;
  
  if (process.platform === 'darwin') {
    // For macOS, use a simple base64 encoded icon
    icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEZSURBVDiNpdMxSgNRFIXhbzJDJjExiBYWFoKFhYWFnY2djY2djY2djY2NjY2djY2FhYWFhYWFIAiCYCBkMpl5b975LYaEJBqT4sLjcu495/DgPpKU6na7X0mS+Hw+f5vP568Afvu93RiGIUEQXAA7wDZQBEpAs9VqvQBfg8EgT5LEcRxbKBRwXZeqqur1ev0YuANegUeSJJHneZbn+TYajW4ajUYNOAH2gQ3AAhzAB3rAI3AH3A+Hw0+AyWTyUiqVDoBjoAHUlv8KGAJ3wA1wO51OPwCGw+FHtVo9BE6BQ2B3hXEIPAOXwOVoNBoAhGH4Wq/XT4FzYG+VcQa8AOfA5Xg8HgP8Amc/8J5D0vLfvB9/AB9bejQhf5F5AAAAAElFTkSuQmCC');
  } else {
    // For other platforms, create a simple 16x16 icon
    const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
    if (require('fs').existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    } else {
      // Fallback to empty icon
      icon = nativeImage.createEmpty().resize({ width: 16, height: 16 });
    }
  }
  
  tray = new Tray(icon);
  tray.setToolTip('Agent TTS');
  
  // Initialize menu immediately
  updateTrayMenu().catch(console.error);
  
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