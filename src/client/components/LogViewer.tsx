import React, { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";
import { ToggleSwitch } from './ToggleSwitch';
import { 
  Play, 
  Pause,
  RefreshCw,
  Heart,
  Loader2
} from "lucide-react";

interface LogEntry {
  id: number;
  timestamp: number;
  profile: string;
  originalText: string;
  filteredText: string;
  status: "queued" | "played" | "error";
  filePath: string;
  avatarUrl?: string;
  voiceName?: string;
  isFavorite?: boolean;
  cwd?: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  onRefresh?: () => void;
  onPlayEntry?: (id: number) => void;
  onPause?: () => void;
  onStop?: () => void;
  onToggleFavorite?: (id: number) => void;
  onLoadMore?: () => Promise<void>;
  playingId?: number | null;
  autoScroll?: boolean;
  showControls?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function LogViewer({
  logs,
  onRefresh,
  onPlayEntry,
  onPause,
  onStop,
  onToggleFavorite,
  onLoadMore,
  playingId,
  autoScroll: autoScrollProp = true,
  showControls = true,
  hasMore = false,
  isLoadingMore = false,
}: LogViewerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [autoScrollLocal, setAutoScrollLocal] = useState(autoScrollProp);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<boolean>(false);
  
  // Use prop autoScroll if showControls is false, otherwise use local state
  const autoScroll = showControls ? autoScrollLocal : autoScrollProp;

  // Detect when user scrolls near the top to load more
  const handleScroll = useCallback(() => {
    if (!listRef.current || !onLoadMore || !hasMore || loadingRef.current) return;
    
    const { scrollTop, scrollHeight } = listRef.current;
    const threshold = 100; // Load more when within 100px of top
    
    if (scrollTop < threshold) {
      loadingRef.current = true;
      
      // Save current scroll position and height
      const prevScrollHeight = scrollHeight;
      const prevScrollTop = scrollTop;
      
      // Create a MutationObserver to detect when new items are added
      const observer = new MutationObserver(() => {
        if (listRef.current) {
          const newScrollHeight = listRef.current.scrollHeight;
          const newItemsHeight = newScrollHeight - prevScrollHeight;
          
          // Only adjust if height actually changed (new items were added)
          if (newItemsHeight > 0) {
            // Adjust scroll position by the height of new items added at the top
            listRef.current.scrollTop = prevScrollTop + newItemsHeight;
            observer.disconnect();
            loadingRef.current = false;
          }
        }
      });
      
      // Start observing before loading
      if (listRef.current) {
        observer.observe(listRef.current, { childList: true, subtree: true });
      }
      
      // Load more items
      onLoadMore().catch((err) => {
        console.error('Error loading more:', err);
        observer.disconnect();
        loadingRef.current = false;
      });
    }
  }, [onLoadMore, hasMore]);
  
  useEffect(() => {
    const container = listRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);
  
  useEffect(() => {
    // Only auto-scroll when adding new messages at the bottom
    // Skip if we're currently loading more (pagination)
    if (autoScroll && listRef.current) {
      // Check if we're near the top (pagination scenario)
      const isNearTop = listRef.current.scrollTop < 200;
      if (isNearTop) {
        return;
      }
      
      if (!loadingRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
  }, [logs.length, autoScroll]);

  // Scroll when a new item starts playing
  useEffect(() => {
    if (autoScroll && playingId && listRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [playingId, autoScroll]);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const handlePlay = (id: number) => {
    if (onPlayEntry) {
      onPlayEntry(id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {showControls && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <ToggleSwitch
            checked={autoScrollLocal}
            onChange={setAutoScrollLocal}
            label="Auto-scroll"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 relative" ref={listRef}>
        {isLoadingMore && (
          <div className="absolute top-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-2 flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading older messages...</span>
          </div>
        )}
        
        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No log entries yet
          </div>
        ) : (
          [...logs].reverse().map((log) => (
            <div
              key={log.id}
              className={clsx(
                "mb-3 bg-white dark:bg-gray-800 border rounded-lg overflow-hidden transition-all border-gray-200 dark:border-gray-700",
                {
                  "border-red-500 dark:border-red-400": log.status === "error",
                  "border-blue-500 dark:border-blue-400":
                    log.status === "queued",
                  "border-green-500 dark:border-green-400 shadow-lg shadow-green-500/20 animate-pulse bg-gradient-to-r from-green-50 to-transparent dark:from-green-900/20":
                    playingId === log.id,
                }
              )}
            >
              <div className="p-3 flex items-center gap-3">
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  {formatTimestamp(log.timestamp)}
                </span>
                <div 
                  className={clsx("flex-1 text-sm truncate cursor-pointer select-none", {
                    "text-gray-400 dark:text-gray-500": log.status === "queued",
                    "text-gray-900 dark:text-gray-100": log.status !== "queued"
                  })}
                  onClick={() => toggleExpand(log.id)}
                  title={expandedIds.has(log.id) ? "Click to collapse" : "Click to expand"}
                >
                  {expandedIds.has(log.id)
                    ? "Click to collapse..."
                    : log.originalText}
                </div>
                <div className="flex gap-2">
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(log.id);
                      }}
                      className="p-1.5 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded transition-colors"
                      title={log.isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart 
                        className={clsx("w-4 h-4", {
                          "fill-red-500 text-red-500": log.isFavorite,
                          "text-gray-500 dark:text-gray-400": !log.isFavorite
                        })}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playingId === log.id && onPause) {
                        console.log(`[LogViewer] Pausing playback for log ID: ${log.id}`);
                        onPause();
                      } else {
                        console.log(`[LogViewer] Starting playback for log ID: ${log.id}`);
                        handlePlay(log.id);
                      }
                    }}
                    className="p-1.5 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded transition-colors"
                    title={playingId === log.id ? "Pause" : "Play"}
                  >
                    {playingId === log.id ? 
                      <Pause className="w-4 h-4" /> : 
                      <Play className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {expandedIds.has(log.id) && (
                <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="mt-3">
                    <strong className="block mb-1 text-gray-500 dark:text-gray-400 text-xs uppercase">
                      Original Text:
                    </strong>
                    <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto">
                      {log.originalText}
                    </pre>
                  </div>
                  <div className="mt-3">
                    <strong className="block mb-1 text-gray-500 dark:text-gray-400 text-xs uppercase">
                      Filtered Text (Sent to TTS):
                    </strong>
                    <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto">
                      {log.filteredText}
                    </pre>
                  </div>
                  <div className="mt-3">
                    <strong className="block mb-1 text-gray-500 dark:text-gray-400 text-xs uppercase">
                      File:
                    </strong>
                    <span className="text-sm">{log.filePath}</span>
                  </div>
                  {log.cwd && (
                    <div className="mt-3">
                      <strong className="block mb-1 text-gray-500 dark:text-gray-400 text-xs uppercase">
                        Project Directory:
                      </strong>
                      <span className="text-sm font-mono">{log.cwd}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}