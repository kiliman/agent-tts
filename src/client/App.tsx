import React, { useState, useEffect, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { ProfileLogViewer } from './components/ProfileLogViewer'
import { wsClient } from './services/api'
import clsx from 'clsx'
import { ArrowLeft, Wifi, WifiOff, AlertCircle } from 'lucide-react'

function AppHeader({ connected }: { connected: boolean }) {
  const location = useLocation()
  const isProfilePage = location.pathname !== '/'

  return (
    <header className="px-3 sm:px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 sm:gap-4">
          {isProfilePage && (
            <Link
              to="/"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1 pr-2 sm:pr-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 36.09 25.98"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-10 text-gray-700 dark:text-gray-300"
              aria-label="Agent TTS Logo"
            >
              <path d="M8.98,8.27l-4.59,3,4.59,3" />
              <path d="M32.08,3.38c3.81,4.38,3.81,11.39,0,15.77" />
              <path d="M29.52,7.33c1.91,2.19,1.91,5.7,0,7.88" />
              <line x1="14.27" y1="6.96" x2="11.86" y2="15.74" />
              <path d="M23.09,1H3.46c-1.28-.02-2.44,1.1-2.46,2.46v15.18c0,1.36,1.1,2.46,2.46,2.46h1.36v3.88l5.18-3.88h13.09c1.36,0,2.46-1.1,2.46-2.46V3.46c0-1.36-1.1-2.46-2.46-2.46Z" />
              <path d="M17.14,14.27l4.59-3-4.59-3" />
            </svg>
            <h1 className="text-lg sm:text-xl font-semibold">Agent TTS</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={clsx('flex items-center gap-1.5 text-sm', {
              'text-green-600 dark:text-green-400': connected,
              'text-red-600 dark:text-red-400': !connected,
            })}
            title={connected ? 'Connected' : 'Disconnected'}
          >
            {connected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="hidden sm:inline">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="hidden sm:inline">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    // Detect system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(mediaQuery.matches ? 'dark' : 'light')

    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    // Setup WebSocket connection
    wsClient.connect()

    // WebSocket event handlers
    wsClient.on('connected', () => {
      setConnected(true)
      console.log('Connected to server')
    })

    wsClient.on('disconnected', () => {
      setConnected(false)
      console.log('Disconnected from server')
    })

    wsClient.on('config-error', (data: any) => {
      setError(data.error || 'Configuration error')
      setTimeout(() => setError(null), 5000)
    })

    // Cleanup
    return () => {
      wsClient.disconnect()
    }
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  return (
    <Router>
      <div
        className={clsx('flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100', {
          dark: theme === 'dark',
        })}
      >
        <AppHeader connected={connected} />

        {error && (
          <div className="bg-red-500 text-white px-6 py-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/:profile"
              element={
                <ProfileLogViewer
                  refreshTrigger={refreshTrigger}
                  autoScroll={autoScroll}
                  onRefresh={handleRefresh}
                  onAutoScrollChange={setAutoScroll}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
