import React, { useState, useEffect } from 'react';
import { LogViewer } from './components/LogViewer';
import { apiClient, wsClient } from './services/api';
import clsx from 'clsx';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

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
    // Load initial logs
    loadLogs();
    
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
    
    wsClient.on('log-added', (data: any) => {
      console.log('New log entry:', data);
      loadLogs();
    });
    
    wsClient.on('status-changed', (data: any) => {
      console.log('Status changed:', data);
      if (data.playing && data.playingId) {
        setPlayingId(data.playingId);
      } else if (!data.playing && data.playedId) {
        setPlayingId(null);
      }
    });
    
    // Cleanup
    return () => {
      wsClient.disconnect();
    };
  }, []);

  const loadLogs = async () => {
    try {
      console.log('Loading logs...');
      const response = await apiClient.getLogs(50);
      if (response.success && response.logs) {
        console.log(`Fetched ${response.logs.length} logs`);
        setLogs(response.logs);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError('Failed to load logs');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handlePlayEntry = async (entryId: number) => {
    try {
      await apiClient.replayLog(entryId);
    } catch (err) {
      console.error('Failed to replay log:', err);
    }
  };

  const handlePausePlayback = async () => {
    try {
      await apiClient.pausePlayback();
    } catch (err) {
      console.error('Failed to pause playback:', err);
    }
  };

  const handleStopPlayback = async () => {
    try {
      await apiClient.stopPlayback();
    } catch (err) {
      console.error('Failed to stop playback:', err);
    }
  };

  return (
    <div className={clsx('flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100', {
      'dark': theme === 'dark'
    })}>
      <header className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agent TTS - Log Viewer</h1>
        <div className={clsx('flex items-center gap-2 text-sm', {
          'text-green-600 dark:text-green-400': connected,
          'text-red-600 dark:text-red-400': !connected
        })}>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>
      
      {error && (
        <div className="bg-red-500 text-white px-6 py-3 flex items-center gap-2">
          <span>⚠️ {error}</span>
        </div>
      )}
      
      <main className="flex-1 overflow-hidden">
        <LogViewer 
          logs={logs} 
          onRefresh={loadLogs}
          onPlayEntry={handlePlayEntry}
          onPause={handlePausePlayback}
          onStop={handleStopPlayback}
          playingId={playingId}
        />
      </main>
    </div>
  );
}