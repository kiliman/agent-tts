import React, { useState, useEffect } from 'react';
import { LogViewer } from './components/LogViewer';
import './App.css';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    
    // Listen for config errors
    if (window.electronAPI) {
      window.electronAPI.onConfigError((error: string) => {
        setError(error);
        setTimeout(() => setError(null), 5000);
      });
      
      // Listen for TTS updates
      window.electronAPI.onTTSUpdate((data: any) => {
        loadLogs();
      });
    }
  }, []);

  const loadLogs = async () => {
    if (window.electronAPI) {
      const fetchedLogs = await window.electronAPI.getLogs(50);
      setLogs(fetchedLogs);
    }
  };

  return (
    <div className={`app ${theme}`}>
      <header className="app-header">
        <h1>Agent TTS - Log Viewer</h1>
      </header>
      
      {error && (
        <div className="error-banner">
          <span>⚠️ Configuration Error: {error}</span>
        </div>
      )}
      
      <main className="app-main">
        <LogViewer logs={logs} onRefresh={loadLogs} />
      </main>
    </div>
  );
}

// Type declarations for Electron API
declare global {
  interface Window {
    electronAPI: {
      getLogs: (limit?: number) => Promise<any[]>;
      onConfigError: (callback: (error: string) => void) => void;
      onTTSUpdate: (callback: (data: any) => void) => void;
      playEntry: (entryId: number) => void;
      pausePlayback: () => void;
      stopPlayback: () => void;
    };
  }
}