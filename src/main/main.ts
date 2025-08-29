import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog } from 'electron';
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

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running
  console.log('Another instance of Agent TTS is already running. Exiting...');
  app.quit();
} else {
  // Handle when another instance tries to run
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Another instance tried to start. Focusing existing instance.');
    // If we have a window, show and focus it
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });
}

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
    // In development, we'll load the built file for now
    // To use hot reload, run: npm run dev:renderer separately
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register keyboard shortcut to open DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.meta && input.shift && input.key.toLowerCase() === 'i' || 
        input.control && input.shift && input.key.toLowerCase() === 'i') {
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
      }
    }
  });

  // Open DevTools in development mode
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }
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
    
    // Forward TTS events to renderer
    appCoordinator.on('ttsPlaying', (message) => {
      console.log('[Main] Forwarding ttsPlaying to renderer, mainWindow exists:', !!mainWindow);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tts-update', { type: 'playing', message });
      }
    });
    
    appCoordinator.on('ttsPlayed', (message) => {
      console.log('[Main] Forwarding ttsPlayed to renderer, mainWindow exists:', !!mainWindow);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tts-update', { type: 'played', message });
      }
    });
    
    appCoordinator.on('ttsError', ({ message, error }) => {
      console.log('[Main] Forwarding ttsError to renderer, mainWindow exists:', !!mainWindow);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tts-update', { type: 'error', message, error });
      }
    });

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

// Only proceed with app initialization if we got the lock
if (gotTheLock) {
  app.whenReady().then(async () => {
  // Initialize the application first (includes database)
  await initializeApp();
  
  // Create system tray after database is ready
  tray = createSystemTrayMenu();
  
  // Register global hotkeys
  await registerGlobalHotkeys();
  
  // Create initial window for visibility
  if (!mainWindow) {
    createWindow();
  }
  });
}

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
  if (!appCoordinator) {
    return [];
  }
  
  // Access the database through the app coordinator
  const database = (appCoordinator as any).database;
  if (!database) {
    return [];
  }
  
  await database.waitForInit();
  const logs = await database.getRecentEntries(limit);
  return logs.map((entry: any) => ({
    id: entry.id,
    timestamp: entry.timestamp.getTime(),
    filePath: entry.filename,
    profile: entry.profile,
    originalText: entry.originalText,
    filteredText: entry.filteredText,
    status: entry.state,
    ttsStatus: entry.apiResponseStatus,
    ttsMessage: entry.apiResponseMessage,
    elapsed: entry.processingTime
  }));
});

ipcMain.handle('show-log-window', () => {
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// Playback control handlers
ipcMain.on('play-entry', async (event, entryId: number) => {
  if (!appCoordinator) {
    console.error('[Main] Cannot play entry - app coordinator not initialized');
    return;
  }
  
  try {
    // Get the entry from database
    const database = (appCoordinator as any).database;
    if (!database) {
      console.error('[Main] Cannot play entry - database not available');
      return;
    }
    
    const entry = await database.getEntryById(entryId);
    if (!entry) {
      console.error(`[Main] Entry ${entryId} not found`);
      return;
    }
    
    console.log(`[Main] Playing entry ${entryId}: ${entry.filteredText.substring(0, 50)}...`);
    
    // Get the profile configuration
    const config = (appCoordinator as any).config;
    const profileConfig = config?.profiles?.find((p: any) => p.id === entry.profile);
    
    if (!profileConfig) {
      console.error(`[Main] Profile configuration not found for ${entry.profile}`);
      return;
    }
    
    // Queue the message for playback
    const ttsQueue = (appCoordinator as any).ttsQueue;
    if (ttsQueue) {
      ttsQueue.addToQueue({
        id: entry.id,
        timestamp: entry.timestamp,
        filename: entry.filename,
        profile: entry.profile,
        originalText: entry.originalText,
        filteredText: entry.filteredText,
        state: 'queued',
        profileConfig: profileConfig
      });
    }
  } catch (error) {
    console.error(`[Main] Error playing entry ${entryId}:`, error);
  }
});

ipcMain.on('pause-playback', () => {
  console.log('[Main] Pause playback requested');
  // TODO: Implement pause functionality in TTS service
});

ipcMain.on('stop-playback', () => {
  console.log('[Main] Stop playback requested');
  if (appCoordinator) {
    const ttsQueue = (appCoordinator as any).ttsQueue;
    if (ttsQueue) {
      // Clear the queue to stop playback
      ttsQueue.clearQueue();
    }
  }
});

export { store };