import { useEffect, useState, useCallback } from 'react';

/**
 * useSpotifyPlayer - Spotify Web Playback SDK Hook
 *
 * Manages Spotify player lifecycle and playback controls
 */
export function useSpotifyPlayer(accessToken: string | null) {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  // Initialize Spotify Player
  useEffect(() => {
    if (!accessToken) return;

    // Load Spotify Web Playback SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: 'TrackMaster Game',
        getOAuthToken: (cb) => {
          cb(accessToken);
        },
        volume: 0.7
      });

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player ready with Device ID:', device_id);
        setDeviceId(device_id);
        setIsReady(true);
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Spotify Player not ready:', device_id);
        setIsReady(false);
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;
        setIsPaused(state.paused);
        setCurrentTrack(state.track_window.current_track.uri);
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    };

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, [accessToken]);

  const playTrack = useCallback(
    async (trackUri: string) => {
      if (!deviceId || !accessToken) return;

      try {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uris: [trackUri] })
        });
      } catch (error) {
        console.error('Failed to play track:', error);
      }
    },
    [deviceId, accessToken]
  );

  const pause = useCallback(async () => {
    if (!player) return;
    try {
      await player.pause();
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  }, [player]);

  return {
    player,
    deviceId,
    isReady,
    isPaused,
    currentTrack,
    playTrack,
    pause
  };
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: typeof Spotify;
  }
}

declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, callback: (data: any) => void): void;
    pause(): Promise<void>;
    resume(): Promise<void>;
  }

  interface PlayerConstructor {
    new (options: {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }): Player;
  }

  const Player: PlayerConstructor;
}
