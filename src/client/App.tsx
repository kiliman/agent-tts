import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ProfileLogViewer } from './components/ProfileLogViewer';
import { wsClient } from './services/api';
import clsx from 'clsx';

function AppHeader({ connected }: { connected: boolean }) {
  const location = useLocation();
  const isProfilePage = location.pathname !== '/';
  
  return (
    <header className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isProfilePage && (
            <Link 
              to="/" 
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Back to Dashboard
            </Link>
          )}
          <h1 className="text-xl font-semibold">Agent TTS</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={clsx('flex items-center gap-2 text-sm', {
            'text-green-600 dark:text-green-400': connected,
            'text-red-600 dark:text-red-400': !connected
          })}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      </div>
    </header>
  );
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Detect system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'dark' : 'light');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Setup WebSocket connection
    wsClient.connect();
    
    // WebSocket event handlers
    wsClient.on('connected', () => {
      setConnected(true);
      console.log('Connected to server');
    });
    
    wsClient.on('disconnected', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });
    
    wsClient.on('config-error', (data: any) => {
      setError(data.error || 'Configuration error');
      setTimeout(() => setError(null), 5000);
    });
    
    // Cleanup
    return () => {
      wsClient.disconnect();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <Router>
      <div className={clsx('flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100', {
        'dark': theme === 'dark'
      })}>
        <AppHeader connected={connected} />
        
        {error && (
          <div className="bg-red-500 text-white px-6 py-3 flex items-center gap-2">
            <span>⚠️ {error}</span>
          </div>
        )}
        
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/:profile" element={
              <ProfileLogViewer 
                refreshTrigger={refreshTrigger} 
                autoScroll={autoScroll}
                onRefresh={handleRefresh}
                onAutoScrollChange={setAutoScroll}
              />
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}