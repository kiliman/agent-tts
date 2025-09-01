import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
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
    if (config) {
      await appCoordinator.initialize(config);
    } else {
      throw new Error('Failed to load configuration');
    }

    // Create Express app
    const app = express();
    const server = http.createServer(app);

    // Middleware
    app.use(cors());
    app.use(express.json());

    // API routes
    setupApiRoutes(app, appCoordinator);

    // Serve images with priority: user images first, then public images as fallback
    const userImagesPath = path.join(os.homedir(), '.agent-tts', 'images');
    if (!fs.existsSync(userImagesPath)) {
      // Create the directory if it doesn't exist
      fs.mkdirSync(userImagesPath, { recursive: true });
      console.log('Created user images directory:', userImagesPath);
    }
    
    // Custom middleware to serve images from multiple directories with priority
    app.use('/images', (req, res, next) => {
      const imageName = req.path.substring(1); // Remove leading slash
      const userImagePath = path.join(userImagesPath, imageName);
      
      // First try user images directory
      if (fs.existsSync(userImagePath)) {
        console.log(`Serving user image: ${imageName}`);
        return res.sendFile(userImagePath);
      }
      
      // Then try public images directory in development
      if (process.env.NODE_ENV !== 'production') {
        const publicImagesPath = path.join(__dirname, '../../public/images');
        const publicImagePath = path.join(publicImagesPath, imageName);
        if (fs.existsSync(publicImagePath)) {
          console.log(`Serving public image: ${imageName}`);
          return res.sendFile(publicImagePath);
        }
      }
      
      // Image not found in either location
      next();
    });
    
    console.log('Image directories configured:');
    console.log('  User images:', userImagesPath);
    if (process.env.NODE_ENV !== 'production') {
      console.log('  Public images (fallback):', path.join(__dirname, '../../public/images'));
    }

    // Serve static files
    const clientPath = path.join(__dirname, '../../dist/client');
    
    // Check if client build exists
    const clientBuildExists = fs.existsSync(clientPath);
    
    if (clientBuildExists) {
      console.log('Serving frontend from:', clientPath);
      app.use(express.static(clientPath));
      
      // Fallback to index.html for client-side routing
      app.get('*', (req, res) => {
        // Don't serve index.html for API routes or static assets
        if (!req.path.startsWith('/api') && !req.path.match(/\.\w+$/)) {
          res.sendFile(path.join(clientPath, 'index.html'));
        }
      });
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('Frontend build not found! Run "npm run build:client" first.');
    }

    // Setup WebSocket
    const wss = new WebSocketServer({ server });
    setupWebSocket(wss, appCoordinator);

    // Handle config changes
    configLoader.on('configChanged', async (newConfig) => {
      console.log('Configuration changed, reloading...');
      await appCoordinator?.updateConfig(newConfig);
      console.log('Configuration reloaded successfully');
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

    // Start watching for config changes
    configLoader.startWatching();
    console.log('Watching for configuration changes...');

    // Start server
    server.listen(PORT, () => {
      console.log(`Agent TTS server running at http://${HOST}:${PORT}`);
      if (clientBuildExists) {
        console.log(`Web UI available at http://${HOST}:${PORT}`);
      } else {
        console.log(`Web UI not built yet. Run 'npm run build:client' to build the frontend.`);
        console.log(`For hot reload development, use 'npm run dev:separate' instead.`);
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