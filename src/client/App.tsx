import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Link,
} from "react-router-dom";
import { Dashboard } from "./components/Dashboard";
import { ProfileLogViewer } from "./components/ProfileLogViewer";
import { wsClient } from "./services/api";
import clsx from "clsx";
import { ArrowLeft, Wifi, WifiOff, AlertCircle } from "lucide-react";

function AppHeader({ connected }: { connected: boolean }) {
  const location = useLocation();
  const isProfilePage = location.pathname !== "/";

  return (
    <header className="px-3 sm:px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 sm:gap-4">
          {isProfilePage && (
            <Link
              to="/"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1 pr-2 sm:pr-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 40 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.8" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="h-8 w-10 text-gray-700 dark:text-gray-300"
              aria-label="Agent TTS Logo"
            >
              {/* Chat bubble with tail */}
              <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l-3.5 3.5v-3.5H5a2 2 0 0 1-2-2V5z" />
              
              {/* Code symbol inside bubble - more spaced out */}
              <path d="M8 7.5L5.5 10l2.5 2.5" />
              <path d="M13 7.5l2.5 2.5L13 12.5" />
              <path d="M10.5 6.5l-1 7" />
              
              {/* Sound waves - curved on the right side */}
              <path d="M24 8c1.5 0 2.5 1 2.5 2s-1 2-2.5 2" fill="none" />
              <path d="M28 6c2.5 0 4 2 4 4s-1.5 4-4 4" fill="none" />
            </svg>
            <h1 className="text-lg sm:text-xl font-semibold">Agent TTS</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={clsx("flex items-center gap-1.5 text-sm", {
              "text-green-600 dark:text-green-400": connected,
              "text-red-600 dark:text-red-400": !connected,
            })}
            title={connected ? "Connected" : "Disconnected"}
          >
            {connected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="hidden sm:inline">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="hidden sm:inline">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Detect system theme
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(mediaQuery.matches ? "dark" : "light");

    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    // Setup WebSocket connection
    wsClient.connect();

    // WebSocket event handlers
    wsClient.on("connected", () => {
      setConnected(true);
      console.log("Connected to server");
    });

    wsClient.on("disconnected", () => {
      setConnected(false);
      console.log("Disconnected from server");
    });

    wsClient.on("config-error", (data: any) => {
      setError(data.error || "Configuration error");
      setTimeout(() => setError(null), 5000);
    });

    // Cleanup
    return () => {
      wsClient.disconnect();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <Router>
      <div
        className={clsx(
          "flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100",
          {
            dark: theme === "dark",
          }
        )}
      >
        <AppHeader connected={connected} />

        {error && (
          <div className="bg-red-500 text-white px-6 py-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/:profile"
              element={
                <ProfileLogViewer
                  refreshTrigger={refreshTrigger}
                  autoScroll={autoScroll}
                  onRefresh={handleRefresh}
                  onAutoScrollChange={setAutoScroll}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
