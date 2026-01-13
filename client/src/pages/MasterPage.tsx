import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import type { GameState, ArtistSearchResult } from "@shared/types";
import { socketService } from "@/lib/socket";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

/**
 * MasterPage - Game orchestration interface
 *
 * Flow:
 * 1. Connect to Spotify
 * 2. Create game
 * 3. Search and select artist
 * 4. Show QR code for players to join
 * 5. Start game
 * 6. Control rounds, show leaderboard, reveal results
 * 7. Declare winner
 */
export default function MasterPage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameCode, setGameCode] = useState<string>("");
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(
    null,
  );
  const [artistSearch, setArtistSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ArtistSearchResult[]>([]);
  const [lastPlayedRound, setLastPlayedRound] = useState(0);
  const [sourceType, setSourceType] = useState<"artist" | "playlist" | "genre">(
    "artist",
  );
  const [genres, setGenres] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Initialize Spotify player
  const {
    isReady: playerReady,
    playTrack,
    pause,
  } = useSpotifyPlayer(spotifyAccessToken);

  // Check Spotify connection status
  const { data: spotifyStatus } = useQuery({
    queryKey: ["spotify-status"],
    queryFn: async () => {
      const res = await fetch("/api/spotify/status");
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (spotifyStatus?.connected) {
      setSpotifyConnected(true);
      fetch("/api/spotify/token")
        .then((res) => res.json())
        .then((data) => {
          if (data.accessToken) {
            setSpotifyAccessToken(data.accessToken);
          }
        })
        .catch((err) => console.error("Failed to get access token:", err));

      // Fetch available genres
      fetch("/api/spotify/genres")
        .then((res) => res.json())
        .then((data) => setGenres(data))
        .catch((err) => console.error("Failed to fetch genres:", err));
    }
  }, [spotifyStatus]);

  // Update timer every second during playing phase
  useEffect(() => {
    if (gameState?.phase === "playing") {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.phase]);

  // Auto-play track when round starts
  useEffect(() => {
    if (
      gameState?.phase === "playing" &&
      gameState.currentSong &&
      playerReady &&
      // NYTT VILLKOR: Kontrollera om den aktuella rundan har spelats
      gameState.roundNumber > lastPlayedRound
    ) {
      playTrack(gameState.currentSong.uri);
      // 2. Uppdatera state så att denna runda registreras som spelad
      setLastPlayedRound(gameState.roundNumber);
    } else if (gameState?.phase === "reveal") {
      pause();
    }
  }, [
    gameState?.phase,
    gameState?.currentSong,
    gameState?.roundNumber,
    playerReady,
    playTrack,
    pause,
    lastPlayedRound,
    setLastPlayedRound,
  ]);

  // Socket event listeners
  useEffect(() => {
    socketService.on("gameCreated", ({ gameCode }) => {
      console.log("Game created:", gameCode);
      setGameCode(gameCode);
    });

    socketService.on("gameStateUpdate", (state) => {
      console.log("Game state update:", state);
      setGameState(state);
    });

    socketService.on("playerAnswered", ({ playerName }) => {
      console.log(`${playerName} answered`);
    });

    socketService.on("roundEnded", (results) => {
      console.log("Round ended:", results);
    });

    socketService.on("gameFinished", (results) => {
      console.log("Game finished:", results);
    });

    return () => {
      socketService.off("gameCreated");
      socketService.off("gameStateUpdate");
      socketService.off("playerAnswered");
      socketService.off("roundEnded");
      socketService.off("gameFinished");
    };
  }, []);

  // Create game
  const handleCreateGame = () => {
    console.log("Creating game...");
    socketService.emit("createGame");
  };

  // Search artists
  const handleSearch = async (query: string) => {
    setArtistSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      let endpoint = "";
      if (sourceType === "artist") {
        endpoint = `/api/spotify/search/artists?q=${encodeURIComponent(query)}`;
      } else if (sourceType === "playlist") {
        endpoint = `/api/spotify/search/playlists?q=${encodeURIComponent(query)}`;
      }

      if (endpoint) {
        const res = await fetch(endpoint);
        const results = await res.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  // Select artist
  const handleSelect = async (item: any) => {
    try {
      // Get fresh access token
      const tokenRes = await fetch("/api/spotify/token");
      const tokenData = await tokenRes.json();

      socketService.emit("selectArtist", {
        gameCode,
        sourceType: sourceType,
        sourceId: item.id || item,
        sourceName: item.name || item,
        sourceImage: item.image || null,
        accessToken: tokenData.accessToken, // Pass token directly
      });
      setSearchResults([]);
      setArtistSearch("");
    } catch (error) {
      console.error("Failed to select source:", error);
    }
  };

  // Start game
  const handleStartGame = () => {
    socketService.emit("startGame", { gameCode });
  };

  // Next song
  const handleNextSong = () => {
    socketService.emit("nextSong", { gameCode });
  };

  // Skip song
  const handleSkipSong = () => {
    socketService.emit("skipSong", { gameCode });
  };

  const playerJoinUrl = `${window.location.origin}/player/${gameCode}`;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyber-cyan via-cyber-magenta to-cyber-purple bg-clip-text text-transparent glow-cyan-text tracking-wider font-mono">
            TRACKMASTER
          </h1>
          <div className="flex items-center gap-4">
            {spotifyConnected ? (
              <span className="text-sm text-cyber-green flex items-center gap-2 font-mono">
                <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse glow-green" />
                SPOTIFY_CONNECTED
              </span>
            ) : (
              <a
                href="/auth/spotify"
                className="px-4 py-2 bg-cyber-green rounded-lg hover:bg-cyber-green/80 transition-colors text-sm font-semibold neon-border-cyan hover:glow-green text-dark-void font-mono"
              >
                CONNECT_SPOTIFY
              </a>
            )}
          </div>
        </div>

        {/* Phase: No game created */}
        {!gameCode && (
          <div className="text-center py-20">
            <button
              type="button"
              onClick={handleCreateGame}
              disabled={!spotifyConnected}
              className="px-8 py-4 bg-gradient-to-r from-cyber-cyan to-cyber-magenta rounded-xl font-semibold text-lg font-mono hover:from-cyber-magenta hover:to-cyber-purple transition-all transform hover:scale-105 shadow-lg neon-border-cyan hover:glow-cyan disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              <span className="relative z-10">CREATE_NEW_GAME</span>
              <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 blur-xl group-hover:blur-2xl transition-all" />
            </button>
            {!spotifyConnected && (
              <p className="mt-4 text-sm text-cyber-cyan/50 font-mono">
                CONNECT_SPOTIFY_FIRST
              </p>
            )}
          </div>
        )}

        {/* Phase: Setup (selecting source) */}
        {gameCode && gameState?.phase === "setup" && (
          <div className="space-y-6">
            <div className="holo-card neon-border-cyan rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-4 text-cyber-cyan font-mono">
                &gt; SELECT_MUSIC_SOURCE
              </h2>

              {/* Source Type Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSourceType("artist")}
                  className={`px-4 py-2 rounded-lg font-semibold font-mono transition-colors ${
                    sourceType === "artist"
                      ? "bg-cyber-cyan text-dark-void neon-border-cyan glow-cyan"
                      : "bg-dark-space/50 text-cyber-cyan/50 border border-cyber-cyan/30 hover:bg-dark-space/80"
                  }`}
                >
                  ARTIST
                </button>
                <button
                  onClick={() => setSourceType("playlist")}
                  className={`px-4 py-2 rounded-lg font-semibold font-mono transition-colors ${
                    sourceType === "playlist"
                      ? "bg-cyber-cyan text-dark-void neon-border-cyan glow-cyan"
                      : "bg-dark-space/50 text-cyber-cyan/50 border border-cyber-cyan/30 hover:bg-dark-space/80"
                  }`}
                >
                  PLAYLIST
                </button>
                <button
                  onClick={() => setSourceType("genre")}
                  className={`px-4 py-2 rounded-lg font-semibold font-mono transition-colors ${
                    sourceType === "genre"
                      ? "bg-cyber-cyan text-dark-void neon-border-cyan glow-cyan"
                      : "bg-dark-space/50 text-cyber-cyan/50 border border-cyber-cyan/30 hover:bg-dark-space/80"
                  }`}
                >
                  GENRE
                </button>
              </div>

              {/* Search for Artist or Playlist */}
              {(sourceType === "artist" || sourceType === "playlist") && (
                <>
                  <input
                    type="text"
                    value={artistSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={`SEARCH_${sourceType.toUpperCase()}...`}
                    className="w-full px-4 py-3 bg-dark-space/50 border neon-border-cyan rounded-lg focus:outline-none focus:ring-2 focus:ring-cyber-cyan focus:glow-cyan text-cyber-cyan placeholder:text-cyber-cyan/30 font-mono"
                  />

                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                      {searchResults.map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-4 p-3 bg-dark-space/50 hover:bg-dark-space/80 rounded-lg neon-border-cyan hover:glow-cyan transition-all text-left"
                        >
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-16 h-16 rounded-lg object-cover border border-cyber-cyan/30"
                            />
                          )}
                          <div>
                            <div className="font-semibold text-cyber-cyan">{item.name}</div>
                            {sourceType === "artist" && (
                              <div className="text-xs text-cyber-cyan/50 font-mono">
                                {item.genres?.slice(0, 3).join(", ")}
                              </div>
                            )}
                            {sourceType === "playlist" && (
                              <div className="text-xs text-cyber-cyan/50 font-mono">
                                {item.trackCount} tracks • by {item.owner}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Genre Selection */}
              {sourceType === "genre" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {genres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => handleSelect(genre)}
                      className="px-4 py-3 bg-dark-space/50 hover:bg-dark-space/80 rounded-lg neon-border-cyan hover:glow-cyan transition-all text-left capitalize text-cyber-cyan font-mono"
                    >
                      {genre.replace(/-/g, " ")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase: Lobby (waiting for players) */}
        {gameCode && gameState?.phase === "lobby" && (
          <div className="space-y-6">
            <div className="holo-card neon-border-cyan rounded-xl p-6 text-center">
              <h2 className="text-3xl font-bold mb-2 text-cyber-cyan font-mono">
                {gameState.artistName}
              </h2>
              <p className="text-cyber-cyan/70 mb-6 font-mono">
                [ {gameState.songs.length} SONGS_LOADED ]
              </p>

              {/* QR Code */}
              <div className="bg-dark-void p-4 inline-block rounded-xl neon-border-magenta glow-magenta mb-4">
                <QRCodeSVG value={playerJoinUrl} size={200} />
              </div>

              <div className="text-lg font-mono mb-6">
                GAME_CODE:{" "}
                <span className="text-cyber-cyan text-2xl glow-cyan-text">{gameCode}</span>
              </div>

              {/* Player List */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4 text-cyber-magenta font-mono">
                  PLAYERS_CONNECTED: [{gameState.players.length}]
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {gameState.players.map((player) => (
                    <div
                      key={player.id}
                      className="px-4 py-2 bg-dark-space/50 rounded-lg neon-border-cyan text-cyber-cyan font-mono"
                    >
                      &gt; {player.name}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartGame}
                disabled={gameState.players.length === 0}
                className="px-8 py-4 bg-gradient-to-r from-cyber-green to-cyber-cyan rounded-xl font-semibold text-lg font-mono hover:from-cyber-cyan hover:to-cyber-green transition-all transform hover:scale-105 shadow-lg neon-border-cyan hover:glow-green disabled:opacity-50 disabled:cursor-not-allowed text-dark-void"
              >
                START_GAME
              </button>
            </div>
          </div>
        )}

        {/* Phase: Playing (active round) */}
        {gameCode && gameState?.phase === "playing" && (
          <div className="space-y-6">
            <div className="holo-card neon-border-cyan rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-cyber-cyan font-mono">
                  ROUND [{gameState.roundNumber} / {gameState.songs.length}]
                </h2>
                <div className="text-3xl font-mono text-cyber-orange glow-orange-text animate-pulse">
                  {Math.max(
                    0,
                    Math.floor(
                      ((gameState.roundStartTime || 0) + 60000 - currentTime) /
                        1000,
                    ),
                  )}
                  s
                </div>
              </div>

              <div className="text-center py-8">
                <div className="waveform mb-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="waveform-bar" />
                  ))}
                </div>
                <p className="text-cyber-cyan/70 font-mono">[ SONG_PLAYING... ]</p>
              </div>

              {/* Players who answered */}
              <div className="mt-6">
                <h3 className="font-semibold mb-3 text-cyber-magenta font-mono">ANSWERED:</h3>
                <div className="flex flex-wrap gap-2">
                  {gameState.players
                    .filter((p) => p.hasAnswered)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="px-3 py-1 bg-cyber-green/20 neon-border-cyan rounded-full text-sm text-cyber-green font-mono"
                      >
                        &gt; {p.name} ✓
                      </div>
                    ))}
                </div>
              </div>

              <button
                onClick={handleSkipSong}
                className="mt-6 px-6 py-3 bg-dark-space/50 neon-border-cyan rounded-lg hover:bg-dark-space/80 transition-colors text-cyber-cyan font-mono hover:glow-cyan"
              >
                SKIP_TO_RESULTS &gt;&gt;
              </button>
            </div>

            {/* Leaderboard */}
            <div className="holo-card neon-border-magenta rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-cyber-magenta font-mono">
                [ LEADERBOARD ]
              </h3>
              <div className="space-y-2">
                {[...gameState.players]
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-4 py-3 bg-dark-space/50 rounded-lg neon-border-cyan hover:glow-cyan transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {index === 0 ? (
                            <span className="text-cyber-green glow-green-text">▲</span>
                          ) : index === 1 ? (
                            <span className="text-cyber-cyan glow-cyan-text">▲</span>
                          ) : index === 2 ? (
                            <span className="text-cyber-magenta glow-magenta-text">▲</span>
                          ) : (
                            <span className="text-cyber-cyan/50">{index + 1}</span>
                          )}
                        </span>
                        <span className="font-semibold text-cyber-cyan font-mono">{player.name}</span>
                      </div>
                      <span className="text-2xl font-bold text-cyber-magenta glow-magenta-text">
                        {player.score}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Phase: Reveal (show results) */}
        {gameCode && gameState?.phase === "reveal" && (
          <div className="space-y-6">
            <div className="holo-card neon-border-cyan rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-6 text-cyber-cyan font-mono">
                &gt; ROUND_RESULTS
              </h2>

              {/* Correct Answer */}
              <div className="mb-6 p-4 bg-cyber-green/20 neon-border-cyan rounded-lg glow-green">
                <div className="text-lg text-cyber-green font-mono">
                  <strong>SONG:</strong> {gameState.currentSong?.name}
                </div>
                <div className="text-lg text-cyber-green font-mono">
                  <strong>ALBUM:</strong> {gameState.currentSong?.albumName}
                </div>
              </div>

              {/* Player Answers */}
              <div className="space-y-3">
                {gameState.roundAnswers.map((answer) => (
                  <div
                    key={answer.playerId}
                    className="p-4 bg-dark-space/50 rounded-lg neon-border-cyan"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-cyber-cyan font-mono">&gt; {answer.playerName}</span>
                      <span className="text-2xl font-bold text-cyber-magenta glow-magenta-text">
                        +{answer.points || 0} PTS
                      </span>
                    </div>
                    <div className="text-sm space-y-1 font-mono">
                      <div
                        className={
                          answer.songCorrect ? "text-cyber-green" : "text-cyber-red"
                        }
                      >
                        SONG: {answer.songGuess}{" "}
                        {answer.songCorrect ? "✓" : "✗"}
                      </div>
                      <div
                        className={
                          answer.albumCorrect
                            ? "text-cyber-green"
                            : "text-cyber-red"
                        }
                      >
                        ALBUM: {answer.albumGuess}{" "}
                        {answer.albumCorrect ? "✓" : "✗"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleNextSong}
                className="mt-6 w-full px-8 py-4 bg-gradient-to-r from-cyber-cyan to-cyber-magenta rounded-xl font-semibold text-lg font-mono hover:from-cyber-magenta hover:to-cyber-purple transition-all neon-border-cyan hover:glow-cyan"
              >
                {gameState.currentSongIndex >= gameState.songs.length - 1
                  ? "VIEW_FINAL_STANDINGS &gt;&gt;"
                  : "NEXT_SONG &gt;&gt;"}
              </button>
            </div>
          </div>
        )}

        {/* Phase: Finished (winner) */}
        {gameCode && gameState?.phase === "finished" && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6 animate-bounce">
              <span className="glow-green-text">◆ VICTORY ◆</span>
            </div>
            <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyber-green via-cyber-cyan to-cyber-magenta bg-clip-text text-transparent glow-green-text font-mono animate-neon-pulse">
              {gameState.winner?.name}_WINS!
            </h2>
            <div className="text-3xl font-bold text-cyber-magenta mb-8 glow-magenta-text font-mono">
              [ {gameState.winner?.score} POINTS ]
            </div>

            {/* Final Standings */}
            <div className="max-w-md mx-auto holo-card neon-border-cyan rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-cyber-cyan font-mono">
                [ FINAL_STANDINGS ]
              </h3>
              <div className="space-y-2">
                {[...gameState.players]
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-4 py-3 bg-dark-space/50 rounded-lg neon-border-cyan"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {index === 0 ? (
                            <span className="text-cyber-green glow-green-text">▲</span>
                          ) : index === 1 ? (
                            <span className="text-cyber-cyan glow-cyan-text">▲</span>
                          ) : index === 2 ? (
                            <span className="text-cyber-magenta glow-magenta-text">▲</span>
                          ) : (
                            <span className="text-cyber-cyan/50">{index + 1}</span>
                          )}
                        </span>
                        <span className="font-semibold text-cyber-cyan font-mono">{player.name}</span>
                      </div>
                      <span className="text-xl font-bold text-cyber-magenta">{player.score}</span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => {
                // Disconnect socket before reload to ensure clean reconnection
                socketService.disconnect();
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              }}
              className="mt-8 px-8 py-4 bg-dark-space/50 neon-border-cyan rounded-xl hover:bg-dark-space/80 transition-colors text-cyber-cyan font-mono hover:glow-cyan"
            >
              NEW_GAME &gt;&gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
