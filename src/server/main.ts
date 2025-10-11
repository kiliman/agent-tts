import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { initializeDatabase } from '../database/schema.js'
import { ConfigLoader } from '../config/loader.js'
import { AppCoordinator } from '../services/app-coordinator.js'
import { setupApiRoutes } from './api/index.js'
import { setupWebSocket } from './websocket.js'
import { replaceConsoleWithLogger } from '../services/logger.js'
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = parseInt(process.env.PORT || '3456')
const HOST = process.env.HOST || 'localhost'

let configLoader: ConfigLoader | null = null
let appCoordinator: AppCoordinator | null = null
let serverPort = PORT
let isShuttingDown = false

async function startServer() {
  try {
    // Set up logging to file
    replaceConsoleWithLogger()

    // Initialize database
    console.log('Initializing database...')
    initializeDatabase()

    // Initialize config loader
    console.log('Loading configuration...')
    configLoader = new ConfigLoader()
    const config = await configLoader.load()

    if (!config) {
      throw new Error('Failed to load configuration')
    }

    // Use port from config if specified
    serverPort = PORT

    // Initialize app coordinator
    console.log('Starting app coordinator...')
    appCoordinator = new AppCoordinator()
    await appCoordinator.initialize(config)

    // Create Express app
    const app = express()
    const server = http.createServer(app)

    // Middleware
    app.use(cors())
    app.use(express.json())

    // API routes
    setupApiRoutes(app, appCoordinator)

    // Serve audio files from cache directory
    const audioPath = path.join(AGENT_TTS_PATHS.cache, 'audio')
    console.log('Audio files path:', path.resolve(audioPath))
    app.use('/audio', express.static(audioPath))

    // Serve images with priority: user images first, then public images as fallback
    // Serve cached images (from chat logs) at /images/*
    const cachedImagesPath = path.join(AGENT_TTS_PATHS.cache, 'images')
    if (!fs.existsSync(cachedImagesPath)) {
      fs.mkdirSync(cachedImagesPath, { recursive: true })
      console.log('Created cached images directory:', cachedImagesPath)
    }
    console.log('Cached images path:', path.resolve(cachedImagesPath))
    app.use('/images', express.static(cachedImagesPath))

    // Serve config/avatar images at /config/images/*
    const configImagesPath = path.join(AGENT_TTS_PATHS.config, 'images')
    if (!fs.existsSync(configImagesPath)) {
      fs.mkdirSync(configImagesPath, { recursive: true })
      console.log('Created config images directory:', configImagesPath)
    }
    console.log('Config images path:', path.resolve(configImagesPath))
    app.use('/config/images', express.static(configImagesPath))

    // Serve public/built-in images (fallback for both routes)
    const publicImagesPath =
      process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../client/images')
        : path.join(__dirname, '../../public/images')
    console.log('Public images path:', path.resolve(publicImagesPath))
    app.use('/images', express.static(publicImagesPath))
    app.use('/config/images', express.static(publicImagesPath))

    if (process.env.NODE_ENV === 'production') {
      // Serve static files
      const clientPath =
        process.env.NODE_ENV === 'production'
          ? path.join(__dirname, '../../client')
          : path.join(__dirname, '../../dist/client')
      console.log('Client path:', path.resolve(clientPath))
      // Check if client build exists
      const clientBuildExists = fs.existsSync(clientPath)

      if (clientBuildExists) {
        console.log('Serving frontend from:', clientPath)
        app.use(express.static(clientPath))

        // Fallback to index.html for client-side routing
        app.get('*', (req, res) => {
          // Don't serve index.html for API routes or static assets
          if (!req.path.startsWith('/api') && !req.path.match(/\.\w+$/)) {
            res.sendFile(path.join(clientPath, 'index.html'))
          }
        })
      } else {
        console.warn('Frontend build not found! Run "npm run build:client" first.')
      }
    }

    // Setup WebSocket
    const wss = new WebSocketServer({ server })
    setupWebSocket(wss, appCoordinator)

    // Handle config changes
    configLoader.on('configChanged', async (newConfig) => {
      console.log('Configuration changed, reloading...')
      await appCoordinator?.updateConfig(newConfig)
      console.log('Configuration reloaded successfully')
    })

    configLoader.on('configError', (error) => {
      console.error('Configuration error:', error)
      // Broadcast error to connected clients via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          client.send(
            JSON.stringify({
              type: 'config-error',
              error: error.message,
            }),
          )
        }
      })
    })

    // Start watching for config changes
    configLoader.startWatching()
    console.log('Watching for configuration changes...')

    // Start server
    server.listen(serverPort, () => {
      const serverUrl = `http://${HOST}:${serverPort}`
      console.log(`Agent TTS server running at ${serverUrl}`)

      // Set the server base URL in the app coordinator for generating full audio URLs
      if (appCoordinator) {
        appCoordinator.setServerBaseUrl(serverUrl)
      }
    })

    // Graceful shutdown
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    async function shutdown() {
      if (isShuttingDown) {
        console.log('Already shutting down, forcing exit...')
        process.exit(1)
      }

      isShuttingDown = true
      console.log('Shutting down gracefully...')

      // Set a timeout to force exit if shutdown takes too long
      const forceExitTimer = setTimeout(() => {
        console.error('Shutdown timeout, forcing exit...')
        process.exit(1)
      }, 5000)

      try {
        if (appCoordinator) {
          await appCoordinator.shutdown()
        }

        if (configLoader) {
          configLoader.stopWatching()
        }

        server.close(() => {
          clearTimeout(forceExitTimer)
          console.log('Server closed')
          process.exit(0)
        })

        // If server.close callback doesn't fire, force exit after waiting
        setTimeout(() => {
          clearTimeout(forceExitTimer)
          console.log("Server close callback didn't fire, exiting anyway")
          process.exit(0)
        }, 2000)
      } catch (error) {
        clearTimeout(forceExitTimer)
        console.error('Error during shutdown:', error)
        process.exit(1)
      }
    }
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer()
