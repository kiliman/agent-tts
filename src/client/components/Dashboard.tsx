import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient, wsClient } from "../services/api";
import clsx from "clsx";

interface ProfileCard {
  profile: string;
  profileName: string;
  profileIcon?: string;
  avatarUrl?: string;
  profileUrl?: string;
  voiceName?: string;
  id: number;
  originalText: string;
  filteredText: string;
  timestamp: number;
  status: string;
}

export function Dashboard() {
  const [profileCards, setProfileCards] = useState<ProfileCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfileCards();

    // Connect WebSocket if not already connected
    if (!wsClient) {
      return;
    }

    // Listen for new log entries
    const handleNewLog = (data: any) => {
      if (data.log) {
        // Update the profile card for this profile with the new message
        setProfileCards(prevCards => {
          const existingCardIndex = prevCards.findIndex(
            card => card.profile === data.log.profile
          );
          
          if (existingCardIndex !== -1) {
            // Update existing card
            const newCards = [...prevCards];
            newCards[existingCardIndex] = {
              ...prevCards[existingCardIndex],
              id: data.log.id,
              originalText: data.log.originalText,
              filteredText: data.log.filteredText,
              timestamp: data.log.timestamp,
              status: data.log.status
            };
            return newCards;
          } else {
            // Add new card if profile doesn't exist yet
            return [...prevCards, data.log];
          }
        });
      }
    };

    wsClient.on('new-log', handleNewLog);

    return () => {
      wsClient.off('new-log', handleNewLog);
    };
  }, []);

  const loadProfileCards = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getLatestLogsPerProfile();
      if (response.success && response.logs) {
        setProfileCards(response.logs);
      }
    } catch (err) {
      console.error("Failed to load profile cards:", err);
      setError("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">
          Loading profiles...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (profileCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">No messages yet</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Agents
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profileCards.map((card) => (
          <Link
            key={card.profile}
            to={`/${card.profile}`}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 flex overflow-clip"
          >
            <img
              src={card.profileUrl}
              alt={card.profileName}
              className="w-48 h-full object-cover"
            />
            <div className="flex-1 p-6 flex flex-col gap-2">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                {card.profileName}
              </h3>
              {card.voiceName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Voice: {card.voiceName}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                {truncateText(card.originalText)}
              </p>

              <div className="flex items-center justify-end text-xs text-gray-500 dark:text-gray-400">
                <span>{formatTimestamp(card.timestamp)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
