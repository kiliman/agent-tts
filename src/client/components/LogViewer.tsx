import React, { useState, useRef, useEffect } from 'react';
import './LogViewer.css';

interface LogEntry {
  id: number;
  timestamp: number;
  profile: string;
  originalText: string;
  filteredText: string;
  status: 'queued' | 'played' | 'error';
  filePath: string;
  avatarUrl?: string;
  voiceName?: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  onRefresh: () => void;
}

export function LogViewer({ logs, onRefresh }: LogViewerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return '⏳';
      case 'played':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '•';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const handlePlay = (id: number) => {
    if (window.electronAPI) {
      window.electronAPI.playEntry(id);
    }
  };

  return (
    <div className="log-viewer">
      <div className="log-viewer-header">
        <button onClick={onRefresh} className="refresh-button">
          🔄 Refresh
        </button>
        <label className="auto-scroll-toggle">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>

      <div className="log-list" ref={listRef}>
        {logs.length === 0 ? (
          <div className="empty-state">No log entries yet</div>
        ) : (
          [...logs].reverse().map((log) => (
            <div key={log.id} className={`log-entry ${log.status}`}>
              <div className="log-entry-header">
                {log.avatarUrl && (
                  <img 
                    src={log.avatarUrl} 
                    alt={log.voiceName || log.profile} 
                    className="log-avatar"
                    title={log.voiceName || log.profile}
                  />
                )}
                <span className="status-icon">{getStatusIcon(log.status)}</span>
                <span className="profile-badge">{log.voiceName || log.profile}</span>
                <span className="timestamp">{formatTimestamp(log.timestamp)}</span>
                
                <div className="log-actions">
                  <button
                    onClick={() => handlePlay(log.id)}
                    className="play-button"
                    title="Replay"
                  >
                    ▶️
                  </button>
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="expand-button"
                  >
                    {expandedIds.has(log.id) ? '⌃' : '⌄'}
                  </button>
                </div>
              </div>

              <div className="log-entry-content">
                <div className="log-text">
                  {expandedIds.has(log.id) ? log.originalText : (
                    log.originalText.length > 100 
                      ? log.originalText.substring(0, 100) + '...'
                      : log.originalText
                  )}
                </div>

                {expandedIds.has(log.id) && (
                  <div className="log-details">
                    <div className="detail-section">
                      <strong>Original Text:</strong>
                      <pre>{log.originalText}</pre>
                    </div>
                    <div className="detail-section">
                      <strong>Filtered Text (Sent to TTS):</strong>
                      <pre>{log.filteredText}</pre>
                    </div>
                    <div className="detail-section">
                      <strong>File:</strong> {log.filePath}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}