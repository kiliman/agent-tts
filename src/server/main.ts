import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from '../database/schema.js';
import { ConfigLoader } from '../config/loader.js';
import { AppCoordinator } from '../services/app-coordinator.js';
import { setupApiRoutes } from './api/index.js';
import { setupWebSocket } from './websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || 'localhost';

let configLoader: ConfigLoader | null = null;
let appCoordinator: AppCoordinator | null = null;

async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    initializeDatabase();

    // Initialize config loader
    console.log('Loading configuration...');
    configLoader = new ConfigLoader();
    const config = await configLoader.load();

    // Initialize app coordinator
    console.log('Starting app coordinator...');
    appCoordinator = new AppCoordinator();
    await appCoordinator.initialize(config);

    // Create Express app
    const app = express();
    const server = http.createServer(app);

    // Middleware
    app.use(cors());
    app.use(express.json());

    // API routes
    setupApiRoutes(app, appCoordinator);

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      const clientPath = path.join(__dirname, '../../dist/client');
      app.use(express.static(clientPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(clientPath, 'index.html'));
      });
    }

    // Setup WebSocket
    const wss = new WebSocketServer({ server });
    setupWebSocket(wss, appCoordinator);

    // Handle config changes
    configLoader.on('configChanged', async (newConfig) => {
      console.log('Configuration changed, reloading...');
      await appCoordinator?.updateConfig(newConfig);
    });

    configLoader.on('configError', (error) => {
      console.error('Configuration error:', error);
      // Broadcast error to connected clients via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({ 
            type: 'config-error', 
            error: error.message 
          }));
        }
      });
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`Agent TTS server running at http://${HOST}:${PORT}`);
      console.log(`Web UI available at http://${HOST}:${PORT}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Development mode: Run 'npm run dev:client' for hot reload`);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    async function shutdown() {
      console.log('Shutting down gracefully...');
      
      if (appCoordinator) {
        await appCoordinator.shutdown();
      }
      
      if (configLoader) {
        configLoader.stopWatching();
      }
      
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();