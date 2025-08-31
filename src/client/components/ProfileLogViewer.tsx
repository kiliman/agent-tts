import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LogViewer } from './LogViewer';
import { apiClient, wsClient } from '../services/api';
import clsx from 'clsx';

export function ProfileLogViewer() {
  const { profile } = useParams<{ profile: string }>();
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [profileInfo, setProfileInfo] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      loadLogs();
      loadProfileInfo();
    }
  }, [profile]);

  useEffect(() => {
    // WebSocket event handlers for real-time updates
    const handleLogAdded = (data: any) => {
      if (data.profile === profile) {
        console.log('New log entry for profile:', data);
        loadLogs();
      }
    };
    
    const handleStatusChanged = (data: any) => {
      console.log('Status changed:', data);
      if (data.playing && data.playingId) {
        setPlayingId(data.playingId);
      } else if (!data.playing && data.playedId) {
        setPlayingId(null);
      }
    };
    
    wsClient.on('log-added', handleLogAdded);
    wsClient.on('status-changed', handleStatusChanged);
    
    return () => {
      wsClient.off('log-added', handleLogAdded);
      wsClient.off('status-changed', handleStatusChanged);
    };
  }, [profile]);

  const loadLogs = async () => {
    if (!profile) return;
    
    try {
      console.log(`Loading logs for profile: ${profile}`);
      const response = await apiClient.getLogs(50, profile);
      if (response.success && response.logs) {
        console.log(`Fetched ${response.logs.length} logs for ${profile}`);
        setLogs(response.logs);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError('Failed to load logs');
      setTimeout(() => setError(null), 3000);
    }
  };

  const loadProfileInfo = async () => {
    try {
      const response = await apiClient.getProfiles();
      if (response.success && response.profiles) {
        const info = response.profiles.find((p: any) => p.id === profile);
        setProfileInfo(info);
      }
    } catch (err) {
      console.error('Failed to load profile info:', err);
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
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back to Dashboard
          </Link>
          
          {profileInfo && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
              
              {profileInfo.avatarUrl ? (
                <img 
                  src={profileInfo.avatarUrl} 
                  alt={profileInfo.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg">
                  {profileInfo.icon || '🤖'}
                </div>
              )}
              
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {profileInfo.name || profile}
              </h2>
              
              {profileInfo.voiceName && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({profileInfo.voiceName})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500 text-white px-6 py-3 flex items-center gap-2">
          <span>⚠️ {error}</span>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden">
        <LogViewer 
          logs={logs} 
          onRefresh={loadLogs}
          onPlayEntry={handlePlayEntry}
          onPause={handlePausePlayback}
          onStop={handleStopPlayback}
          playingId={playingId}
        />
      </div>
    </div>
  );
}