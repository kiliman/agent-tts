import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LogViewer } from './LogViewer';
import { ToggleSwitch } from './ToggleSwitch';
import { apiClient, wsClient } from '../services/api';
import { RefreshCw, Bot, AlertCircle } from 'lucide-react';

interface ProfileLogViewerProps {
  refreshTrigger?: number;
  autoScroll?: boolean;
  onRefresh?: () => void;
  onAutoScrollChange?: (value: boolean) => void;
}

export function ProfileLogViewer({ 
  refreshTrigger = 0, 
  autoScroll = true,
  onRefresh,
  onAutoScrollChange
}: ProfileLogViewerProps) {
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
  }, [profile, refreshTrigger]);

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
        // Update the log entry status to 'playing' (in case it was queued)
        setLogs(prevLogs => 
          prevLogs.map(log => 
            log.id === data.playingId 
              ? { ...log, status: 'playing' }
              : log
          )
        );
      } else if (!data.playing && data.playedId) {
        setPlayingId(null);
        // Update the log entry status to 'played'
        setLogs(prevLogs => 
          prevLogs.map(log => 
            log.id === data.playedId 
              ? { ...log, status: 'played' }
              : log
          )
        );
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
      {profileInfo && (
        <div className="px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {profileInfo.profileUrl || profileInfo.avatarUrl ? (
                <img 
                  src={profileInfo.profileUrl || profileInfo.avatarUrl} 
                  alt={profileInfo.name}
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <Bot className="w-10 h-10 text-gray-600 dark:text-gray-400" />
                </div>
              )}
              
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {profileInfo.name || profile}
                </h2>
                {profileInfo.voiceName && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Voice: {profileInfo.voiceName}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 items-end">
              <button
                type="button"
                onClick={() => {
                  loadLogs();
                  if (onRefresh) onRefresh();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <ToggleSwitch
                checked={autoScroll}
                onChange={(checked) => {
                  if (onAutoScrollChange) onAutoScrollChange(checked);
                }}
                label="Auto-scroll"
              />
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-500 text-white px-6 py-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden">
        <LogViewer 
          logs={logs} 
          onPlayEntry={handlePlayEntry}
          onPause={handlePausePlayback}
          onStop={handleStopPlayback}
          playingId={playingId}
          autoScroll={autoScroll}
          showControls={false}
        />
      </div>
    </div>
  );
}