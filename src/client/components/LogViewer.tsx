import React, { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { 
  Play, 
  Pause, 
  ChevronDown, 
  ChevronUp,
  RefreshCw 
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
}

interface LogViewerProps {
  logs: LogEntry[];
  onRefresh?: () => void;
  onPlayEntry?: (id: number) => void;
  onPause?: () => void;
  onStop?: () => void;
  playingId?: number | null;
  autoScroll?: boolean;
  showControls?: boolean;
}

export function LogViewer({
  logs,
  onRefresh,
  onPlayEntry,
  onPause,
  onStop,
  playingId,
  autoScroll: autoScrollProp = true,
  showControls = true,
}: LogViewerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [autoScrollLocal, setAutoScrollLocal] = useState(autoScrollProp);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Use prop autoScroll if showControls is false, otherwise use local state
  const autoScroll = showControls ? autoScrollLocal : autoScrollProp;

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

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
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoScrollLocal}
              onChange={(e) => setAutoScrollLocal(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            Auto-scroll
          </label>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4" ref={listRef}>
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
                <div className={clsx("flex-1 text-sm truncate", {
                  "text-gray-400 dark:text-gray-500": log.status === "queued",
                  "text-gray-900 dark:text-gray-100": log.status !== "queued"
                })}>
                  {expandedIds.has(log.id)
                    ? "Click to collapse..."
                    : log.filteredText}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlay(log.id)}
                    className="p-1.5 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Replay"
                    disabled={playingId === log.id}
                  >
                    {playingId === log.id ? 
                      <Pause className="w-4 h-4" /> : 
                      <Play className="w-4 h-4" />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(log.id)}
                    className="p-1.5 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded transition-colors"
                    title={expandedIds.has(log.id) ? "Collapse" : "Expand"}
                  >
                    {expandedIds.has(log.id) ? 
                      <ChevronUp className="w-4 h-4" /> : 
                      <ChevronDown className="w-4 h-4" />
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
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}