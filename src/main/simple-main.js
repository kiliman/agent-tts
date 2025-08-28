const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <html>
      <head>
        <title>Agent TTS</title>
        <meta charset="utf-8">
      </head>
      <body style="font-family: -apple-system, system-ui, sans-serif; padding: 20px;">
        <h1>Agent TTS</h1>
        <p>The app is running! This is a simple test version.</p>
        <p>System tray icon should be visible in your menu bar.</p>
        <h3>Features:</h3>
        <ul>
          <li>✅ Electron app running</li>
          <li>✅ System tray integration</li>
          <li>✅ Basic window</li>
          <li>🚧 TTS service (needs configuration)</li>
          <li>🚧 File monitoring (needs configuration)</li>
        </ul>
      </body>
    </html>
  `)}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Create tray icon - for macOS, we need a Template image
  // Create a simple 16x16 icon programmatically
  const size = { width: 16, height: 16 };
  const icon = nativeImage.createEmpty().resize(size);
  
  // For macOS, we need to create a visible icon
  if (process.platform === 'darwin') {
    // Create a simple text-based icon
    tray = new Tray(nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEZSURBVDiNpdMxSgNRFIXhbzJDJjExiBYWFoKFhYWFnY2djY2djY2djY2NjY2djY2FhYWFhYWFIAiCYCBkMpl5b975LYaEJBqT4sLjcu495/DgPpKU6na7X0mS+Hw+f5vP568Afvu93RiGIUEQXAA7wDZQBEpAs9VqvQBfg8EgT5LEcRxbKBRwXZeqqur1ev0YuANegUeSJJHneZbn+TYajW4ajUYNOAH2gQ3AAhzAB3rAI3AH3A+Hw0+AyWTyUiqVDoBjoAHUlv8KGAJ3wA1wO51OPwCGw+FHtVo9BE6BQ2B3hXEIPAOXwOVoNBoAhGH4Wq/XT4FzYG+VcQa8AOfA5Xg8HgP8Amc/8J5D0vLfvB9/AB9bejQhf5F5AAAAAElFTkSuQmCC'));
  } else {
    tray = new Tray(icon);
  }
  
  tray.setToolTip('Agent TTS');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else {
          mainWindow.show();
        }
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
  
  // Create initial window
  createWindow();
});

app.on('window-all-closed', () => {
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});