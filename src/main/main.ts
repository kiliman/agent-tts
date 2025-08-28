import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { initializeDatabase } from '../database/schema';
import { ConfigLoader } from '../config/loader';
import type { AgentTTSConfig } from '../types/config';
import { AppCoordinator } from '../services/app-coordinator';
import { createSystemTrayMenu } from './menu';
import { registerGlobalHotkeys } from './hotkeys';
import Store from 'electron-store';

export let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let configLoader: ConfigLoader | null = null;
let appCoordinator: AppCoordinator | null = null;

// Make coordinator available globally for menu and hotkeys
global.appCoordinator = null;

const store = new Store();
const isDevelopment = process.env.NODE_ENV !== 'production';

export async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp() {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize app coordinator
    appCoordinator = new AppCoordinator();
    global.appCoordinator = appCoordinator;

    // Load configuration
    configLoader = new ConfigLoader();
    const config = await configLoader.load();
    
    if (!config) {
      // Show error window if config fails to load on startup
      const errorWindow = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      });
      
      errorWindow.loadURL(`data:text/html,
        <html>
          <head><title>Configuration Error</title></head>
          <body style="font-family: -apple-system, system-ui, sans-serif; padding: 20px;">
            <h2>Configuration Error</h2>
            <p>Failed to load configuration. Please check your configuration file at:</p>
            <code>~/.agent-tts/index.{js,ts}</code>
            <p style="color: red;">${configLoader.getLastError()}</p>
            <p>Fix the configuration and restart the application.</p>
          </body>
        </html>
      `);
      
      return;
    }

    // Initialize the app coordinator with config
    await appCoordinator.initialize(config);

    // Set up configuration hot-reload
    configLoader.on('configChanged', async (newConfig) => {
      if (appCoordinator) {
        await appCoordinator.updateConfig(newConfig);
      }
    });

    configLoader.on('configError', (error) => {
      // Show error notification but continue with current config
      if (mainWindow) {
        mainWindow.webContents.send('config-error', error);
      }
    });

    // Start watching for config changes
    configLoader.startWatching();

  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
}

app.whenReady().then(async () => {
  // Create system tray
  tray = createSystemTrayMenu();
  
  // Register global hotkeys
  registerGlobalHotkeys();
  
  // Initialize the application
  await initializeApp();
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed (keep in tray)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Clean up
  if (configLoader) {
    configLoader.stopWatching();
  }
  if (appCoordinator) {
    await appCoordinator.shutdown();
  }
  globalShortcut.unregisterAll();
});

// IPC handlers for renderer communication
ipcMain.handle('get-logs', async (event, limit = 50) => {
  // This will be implemented in the database module
  return [];
});

ipcMain.handle('show-log-window', () => {
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

export { store };