import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { LogViewer } from './LogViewer';
import { ToggleSwitch } from './ToggleSwitch';
import { apiClient, wsClient } from '../services/api';
import { RefreshCw, Bot, AlertCircle, Heart, X } from 'lucide-react';
import { getResourceUrl } from '../utils/url';

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const favoritesOnly = searchParams.has('favorites');
  
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);

  useEffect(() => {
    if (profile) {
      setOffset(0);
      setHasMore(true);
      loadLogs(true);
      loadProfileInfo();
      loadFavoritesCount();
    }
  }, [profile, refreshTrigger, favoritesOnly]);

  useEffect(() => {
    // WebSocket event handlers for real-time updates
    const handleLogAdded = (data: any) => {
      if (data.profile === profile) {
        console.log('New log entry for profile:', data);
        // Instead of reloading all logs, just prepend the new one
        // Only if we're not in favorites mode, or if it's a favorite
        if (!favoritesOnly || data.isFavorite) {
          setLogs(prevLogs => {
            // Check if this log already exists to avoid duplicates
            if (prevLogs.some(log => log.id === data.id)) {
              return prevLogs;
            }
            return [data, ...prevLogs];
          });
        }
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
  }, [profile, favoritesOnly]);

  const loadLogs = async (reset: boolean = false) => {
    if (!profile) return;
    
    try {
      const currentOffset = reset ? 0 : offset;
      console.log(`Loading ${favoritesOnly ? 'favorite' : 'all'} logs for profile: ${profile}, offset: ${currentOffset}`);
      const response = await apiClient.getLogs(50, profile, favoritesOnly, currentOffset);
      
      if (response.success && response.logs) {
        console.log(`Fetched ${response.logs.length} ${favoritesOnly ? 'favorite' : ''} logs for ${profile}`);
        
        if (reset) {
          setLogs(response.logs);
          setOffset(response.logs.length);
        } else {
          // Prepend older messages to the beginning, deduplicating by ID
          setLogs(prevLogs => {
            const existingIds = new Set(prevLogs.map((log: any) => log.id));
            const newLogs = response.logs.filter((log: any) => !existingIds.has(log.id));
            return [...prevLogs, ...newLogs];
          });
          setOffset(prevOffset => prevOffset + response.logs.length);
        }
        
        setHasMore(response.hasMore || false);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError('Failed to load logs');
      setTimeout(() => setError(null), 3000);
    }
  };
  
  const loadMoreLogs = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    await loadLogs(false);
    setIsLoadingMore(false);
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
    console.log('[ProfileLogViewer] handlePausePlayback called');
    try {
      const response = await apiClient.pausePlayback();
      console.log('[ProfileLogViewer] Pause response:', response);
    } catch (err) {
      console.error('[ProfileLogViewer] Failed to pause playback:', err);
    }
  };

  const handleStopPlayback = async () => {
    try {
      await apiClient.stopPlayback();
    } catch (err) {
      console.error('Failed to stop playback:', err);
    }
  };
  
  const loadFavoritesCount = async () => {
    try {
      const response = await apiClient.getFavoritesCount(profile);
      if (response.success) {
        setFavoritesCount(response.count);
      }
    } catch (err) {
      console.error('Failed to load favorites count:', err);
    }
  };
  
  const handleToggleFavorite = async (id: number) => {
    try {
      const response = await apiClient.toggleFavorite(id);
      if (response.success) {
        // Update the log entry
        setLogs(prevLogs => 
          prevLogs.map(log => 
            log.id === id 
              ? { ...log, isFavorite: response.isFavorite }
              : log
          )
        );
        // Reload favorites count
        loadFavoritesCount();
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
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
                  src={getResourceUrl(profileInfo.profileUrl || profileInfo.avatarUrl)} 
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
                {favoritesCount > 0 && (
                  <button
                    onClick={() => {
                      if (favoritesOnly) {
                        navigate(`/${profile}`);
                      } else {
                        navigate(`/${profile}?favorites`);
                      }
                    }}
                    className="flex items-center gap-1.5 mt-2 hover:opacity-80 transition-opacity"
                  >
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {favoritesCount} favorite{favoritesCount !== 1 ? 's' : ''}
                    </span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 items-end">
              <button
                type="button"
                onClick={() => {
                  setOffset(0);
                  setHasMore(true);
                  loadLogs(true);
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
      
      {favoritesOnly && (
        <div className="bg-red-50 dark:bg-red-900/20 px-6 py-2 flex items-center justify-between border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 fill-red-500 text-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Showing favorites only</span>
          </div>
          <button
            onClick={() => navigate(`/${profile}`)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
            title="Show all logs"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden">
        <LogViewer 
          logs={logs} 
          onPlayEntry={handlePlayEntry}
          onPause={handlePausePlayback}
          onStop={handleStopPlayback}
          onToggleFavorite={handleToggleFavorite}
          onLoadMore={loadMoreLogs}
          playingId={playingId}
          autoScroll={autoScroll}
          showControls={false}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
        />
      </div>
    </div>
  );
}