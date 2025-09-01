import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient, wsClient } from "../services/api";
import { Heart } from "lucide-react";
import { getResourceUrl } from "../utils/url";

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
  favoritesCount?: number;
}

export function Dashboard() {
  const [profileCards, setProfileCards] = useState<ProfileCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoritesCounts, setFavoritesCounts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadProfileCards();

    // Setup WebSocket listener
    console.log("[Dashboard] Setting up WebSocket listener");

    // Listen for new log entries
    const handleNewLog = (data: any) => {
      console.log("[Dashboard] Received log-added event:", data);
      if (data) {
        // Update the profile card for this profile with the new message
        setProfileCards((prevCards) => {
          console.log("[Dashboard] Current cards:", prevCards);
          console.log("[Dashboard] Looking for profile:", data.profile);

          const existingCardIndex = prevCards.findIndex(
            (card) => card.profile === data.profile
          );

          console.log("[Dashboard] Found card at index:", existingCardIndex);

          if (existingCardIndex !== -1) {
            // Update existing card
            const newCards = [...prevCards];
            newCards[existingCardIndex] = {
              ...prevCards[existingCardIndex],
              id: data.id,
              originalText: data.originalText,
              filteredText: data.filteredText,
              timestamp: data.timestamp,
              status: data.status,
              profileUrl:
                data.profileUrl || prevCards[existingCardIndex].profileUrl,
              avatarUrl:
                data.avatarUrl || prevCards[existingCardIndex].avatarUrl,
              voiceName:
                data.voiceName || prevCards[existingCardIndex].voiceName,
            };
            console.log(
              "[Dashboard] Updated card:",
              newCards[existingCardIndex]
            );
            return newCards;
          } else {
            // Profile doesn't exist in dashboard yet, skip
            // (Dashboard only shows profiles that have had at least one message)
            console.log(
              "[Dashboard] Profile not found in existing cards, skipping"
            );
            return prevCards;
          }
        });
      }
    };

    wsClient.on("log-added", handleNewLog);
    console.log("[Dashboard] WebSocket listener attached");

    return () => {
      console.log("[Dashboard] Cleaning up WebSocket listener");
      wsClient.off("log-added", handleNewLog);
    };
  }, []);
  
  // Load favorites counts when profile cards change
  useEffect(() => {
    if (profileCards.length > 0) {
      loadFavoritesCounts();
    }
  }, [profileCards]);

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
  
  const loadFavoritesCounts = React.useCallback(async () => {
    try {
      // Get unique profiles
      const profiles = [...new Set(profileCards.map(card => card.profile))];
      const counts: { [key: string]: number } = {};
      
      // Fetch counts for each profile
      for (const profile of profiles) {
        const response = await apiClient.getFavoritesCount(profile);
        if (response.success) {
          counts[profile] = response.count;
        }
      }
      
      setFavoritesCounts(counts);
    } catch (err) {
      console.error('Failed to load favorites counts:', err);
    }
  }, [profileCards]);

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
              src={getResourceUrl(card.profileUrl)}
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
              {favoritesCounts[card.profile] > 0 && (
                <Link
                  to={`/${card.profile}?favorites`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                >
                  <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {favoritesCounts[card.profile]} favorite{favoritesCounts[card.profile] !== 1 ? 's' : ''}
                  </span>
                </Link>
              )}

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
