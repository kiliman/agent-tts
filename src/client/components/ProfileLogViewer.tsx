import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { LogViewer } from "./LogViewer";
import { ToggleSwitch } from "./ToggleSwitch";
import { apiClient, wsClient } from "../services/api";
import { RefreshCw, Bot, AlertCircle, Heart, X, FolderOpen } from "lucide-react";
import { getResourceUrl } from "../utils/url";

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
  onAutoScrollChange,
}: ProfileLogViewerProps) {
  const { profile } = useParams<{ profile: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const favoritesOnly = searchParams.has("favorites");
  const cwdFilter = searchParams.get("cwd") || undefined;

  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const [availableCwds, setAvailableCwds] = useState<string[]>([]);
  const [showCwdDropdown, setShowCwdDropdown] = useState<boolean>(false);
  const cwdDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      setOffset(0);
      setHasMore(true);
      loadLogs(true);
      loadProfileInfo();
      loadFavoritesCount();
      loadAvailableCwds();
    }
  }, [profile, refreshTrigger, favoritesOnly, cwdFilter]);

  useEffect(() => {
    // WebSocket event handlers for real-time updates
    const handleLogAdded = (data: any) => {
      if (data.profile === profile) {
        console.log("New log entry for profile:", data);
        
        // Check if this message has a new CWD that's not in our list
        // We'll use a callback to check against the current state
        if (data.cwd) {
          setAvailableCwds((currentCwds) => {
            if (!currentCwds.includes(data.cwd)) {
              console.log("New CWD detected, adding to list:", data.cwd);
              // Reload the full list to ensure we're in sync with the backend
              apiClient.getProfileCwds(profile!).then((response) => {
                if (response.success && response.cwds) {
                  setAvailableCwds(response.cwds);
                }
              }).catch((err) => {
                console.error("Failed to reload CWDs:", err);
              });
            }
            return currentCwds;
          });
        }
        
        // Instead of reloading all logs, just prepend the new one
        // Only if we're not in favorites mode, or if it's a favorite
        if (!favoritesOnly || data.isFavorite) {
          setLogs((prevLogs) => {
            // Check if this log already exists to avoid duplicates
            if (prevLogs.some((log) => log.id === data.id)) {
              return prevLogs;
            }
            return [data, ...prevLogs];
          });
        }
      }
    };

    const handleStatusChanged = (data: any) => {
      console.log("Status changed:", data);
      if (data.playing && data.playingId) {
        setPlayingId(data.playingId);
        // Update the log entry status to 'playing' (in case it was queued)
        setLogs((prevLogs) =>
          prevLogs.map((log) =>
            log.id === data.playingId ? { ...log, status: "playing" } : log
          )
        );
      } else if (!data.playing && data.playedId) {
        setPlayingId(null);
        // Update the log entry status to 'played'
        setLogs((prevLogs) =>
          prevLogs.map((log) =>
            log.id === data.playedId ? { ...log, status: "played" } : log
          )
        );
      }
    };

    wsClient.on("log-added", handleLogAdded);
    wsClient.on("status-changed", handleStatusChanged);

    return () => {
      wsClient.off("log-added", handleLogAdded);
      wsClient.off("status-changed", handleStatusChanged);
    };
  }, [profile, favoritesOnly]);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cwdDropdownRef.current && !cwdDropdownRef.current.contains(event.target as Node)) {
        setShowCwdDropdown(false);
      }
    };
    
    if (showCwdDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCwdDropdown]);

  const loadLogs = async (reset: boolean = false) => {
    if (!profile) return;

    try {
      const currentOffset = reset ? 0 : offset;
      console.log(
        `Loading ${
          favoritesOnly ? "favorite" : "all"
        } logs for profile: ${profile}, offset: ${currentOffset}`
      );
      const response = await apiClient.getLogs(
        50,
        profile,
        favoritesOnly,
        currentOffset,
        cwdFilter
      );

      if (response.success && response.logs) {
        console.log(
          `Fetched ${response.logs.length} ${
            favoritesOnly ? "favorite" : ""
          } logs for ${profile}`
        );

        if (reset) {
          setLogs(response.logs);
          setOffset(response.logs.length);
        } else {
          // Prepend older messages to the beginning, deduplicating by ID
          setLogs((prevLogs) => {
            const existingIds = new Set(prevLogs.map((log: any) => log.id));
            const newLogs = response.logs.filter(
              (log: any) => !existingIds.has(log.id)
            );
            return [...prevLogs, ...newLogs];
          });
          setOffset((prevOffset) => prevOffset + response.logs.length);
        }

        setHasMore(response.hasMore || false);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
      setError("Failed to load logs");
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
      console.error("Failed to load profile info:", err);
    }
  };

  const handlePlayEntry = async (entryId: number) => {
    try {
      await apiClient.replayLog(entryId);
    } catch (err) {
      console.error("Failed to replay log:", err);
    }
  };

  const handlePausePlayback = async () => {
    console.log("[ProfileLogViewer] handlePausePlayback called");
    try {
      const response = await apiClient.pausePlayback();
      console.log("[ProfileLogViewer] Pause response:", response);
    } catch (err) {
      console.error("[ProfileLogViewer] Failed to pause playback:", err);
    }
  };

  const handleStopPlayback = async () => {
    try {
      await apiClient.stopPlayback();
    } catch (err) {
      console.error("Failed to stop playback:", err);
    }
  };

  const loadFavoritesCount = async () => {
    try {
      const response = await apiClient.getFavoritesCount(profile);
      if (response.success) {
        setFavoritesCount(response.count);
      }
    } catch (err) {
      console.error("Failed to load favorites count:", err);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      const response = await apiClient.toggleFavorite(id);
      if (response.success) {
        // Update the log entry
        setLogs((prevLogs) =>
          prevLogs.map((log) =>
            log.id === id ? { ...log, isFavorite: response.isFavorite } : log
          )
        );
        // Reload favorites count
        loadFavoritesCount();
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };
  
  const loadAvailableCwds = useCallback(async () => {
    if (!profile) return;
    try {
      const response = await apiClient.getProfileCwds(profile);
      if (response.success && response.cwds) {
        setAvailableCwds(response.cwds);
      }
    } catch (err) {
      console.error("Failed to load available CWDs:", err);
    }
  }, [profile]);
  
  const handleCwdFilterChange = (cwd: string | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (cwd) {
      params.set("cwd", cwd);
    } else {
      params.delete("cwd");
    }
    if (favoritesOnly) {
      params.set("favorites", "");
    }
    navigate(`/${profile}${params.toString() ? `?${params.toString()}` : ""}`);
    setShowCwdDropdown(false);
  };

  return (
    <div className="flex flex-col h-full">
      {profileInfo && (
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              {profileInfo.avatarUrl || profileInfo.profileUrl ? (
                <img
                  src={getResourceUrl(
                    profileInfo.avatarUrl || profileInfo.profileUrl
                  )}
                  alt={profileInfo.name}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600 dark:text-gray-400" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {profileInfo.voiceName || profileInfo.name || profile}
                  </h2>
                  {favoritesCount > 0 && (
                    <button
                      onClick={() => {
                        if (favoritesOnly) {
                          navigate(`/${profile}`);
                        } else {
                          navigate(`/${profile}?favorites`);
                        }
                      }}
                      className="flex items-center gap-1 sm:gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0"
                    >
                      <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                        {favoritesCount} favorite{favoritesCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 sm:hidden">
                        {favoritesCount}
                      </span>
                    </button>
                  )}
                </div>
                {(profileInfo.parserName || profileInfo.model) && (
                  <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {profileInfo.parserIconUrl && (
                      <img
                        src={getResourceUrl(profileInfo.parserIconUrl)}
                        alt={profileInfo.parserName}
                        className="w-4 h-4"
                      />
                    )}
                    {profileInfo.parserName && <span>{profileInfo.parserName}</span>}
                    {profileInfo.parserName && profileInfo.model && <span className="text-gray-400">•</span>}
                    {profileInfo.modelIconUrl && (
                      <img
                        src={getResourceUrl(profileInfo.modelIconUrl)}
                        alt={profileInfo.model}
                        className="w-4 h-4"
                      />
                    )}
                    {profileInfo.model && <span>{profileInfo.model}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 sm:gap-2 items-end">
              <div className="flex gap-1 sm:gap-2">
                <div className="relative" ref={cwdDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCwdDropdown(!showCwdDropdown)}
                    className="p-2 sm:px-3 sm:py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                    title={cwdFilter ? "Filtered" : "All Projects"}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">{cwdFilter ? "Filtered" : "All Projects"}</span>
                  </button>
                  {showCwdDropdown && availableCwds.length > 0 && (
                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto z-50">
                      <button
                        onClick={() => handleCwdFilterChange(undefined)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          !cwdFilter ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        All Projects
                      </button>
                      {availableCwds.map((cwd) => (
                        <button
                          key={cwd}
                          onClick={() => handleCwdFilterChange(cwd)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 font-mono truncate ${
                            cwdFilter === cwd ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                          }`}
                          title={cwd}
                        >
                          {cwd}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOffset(0);
                    setHasMore(true);
                    loadLogs(true);
                    if (onRefresh) onRefresh();
                  }}
                  className="p-2 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
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
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              Showing favorites only
            </span>
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
      
      {cwdFilter && !favoritesOnly && (
        <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-2 flex items-center justify-between border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Filtered: <span className="font-mono">{cwdFilter}</span>
            </span>
          </div>
          <button
            onClick={() => handleCwdFilterChange(undefined)}
            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
            title="Clear filter"
          >
            <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
