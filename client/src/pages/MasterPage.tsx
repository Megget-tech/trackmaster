import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode.react';
import type { GameState, ArtistSearchResult } from '@shared/types';
import { socketService } from '@/lib/socket';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';

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
  const [gameCode, setGameCode] = useState<string>('');
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ArtistSearchResult[]>([]);

  // Initialize Spotify player
  const { isReady: playerReady, playTrack, pause } = useSpotifyPlayer(spotifyAccessToken);

  // Check Spotify connection status
  const { data: spotifyStatus } = useQuery({
    queryKey: ['spotify-status'],
    queryFn: async () => {
      const res = await fetch('/api/spotify/status');
      return res.json();
    },
    refetchInterval: 5000
  });

  useEffect(() => {
    if (spotifyStatus?.connected) {
      setSpotifyConnected(true);
      // Fetch access token for player
      fetch('/api/spotify/token')
        .then(res => res.json())
        .then(data => {
          if (data.accessToken) {
            setSpotifyAccessToken(data.accessToken);
          }
        })
        .catch(err => console.error('Failed to get access token:', err));
    }
  }, [spotifyStatus]);

  // Auto-play track when round starts
  useEffect(() => {
    if (gameState?.phase === 'playing' && gameState.currentSong && playerReady) {
      playTrack(gameState.currentSong.uri);
    } else if (gameState?.phase === 'reveal') {
      pause();
    }
  }, [gameState?.phase, gameState?.currentSong, playerReady, playTrack, pause]);

  // Socket event listeners
  useEffect(() => {
    socketService.on('gameCreated', ({ gameCode }) => {
      setGameCode(gameCode);
      console.log('Game created:', gameCode);
    });

    socketService.on('gameStateUpdate', (state) => {
      setGameState(state);
    });

    socketService.on('playerAnswered', ({ playerName }) => {
      console.log(`${playerName} answered`);
    });

    socketService.on('roundEnded', (results) => {
      console.log('Round ended:', results);
    });

    socketService.on('gameFinished', (results) => {
      console.log('Game finished:', results);
    });

    return () => {
      socketService.off('gameCreated');
      socketService.off('gameStateUpdate');
      socketService.off('playerAnswered');
      socketService.off('roundEnded');
      socketService.off('gameFinished');
    };
  }, []);

  // Create game
  const handleCreateGame = () => {
    socketService.emit('createGame');
  };

  // Search artists
  const handleSearchArtist = async (query: string) => {
    setArtistSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/spotify/search/artists?q=${encodeURIComponent(query)}`);
      const artists = await res.json();
      setSearchResults(artists);
    } catch (error) {
      console.error('Artist search failed:', error);
    }
  };

  // Select artist
  const handleSelectArtist = (artist: ArtistSearchResult) => {
    socketService.emit('selectArtist', {
      gameCode,
      artistId: artist.id,
      artistName: artist.name,
      artistImage: artist.image
    });
    setSearchResults([]);
    setArtistSearch('');
  };

  // Start game
  const handleStartGame = () => {
    socketService.emit('startGame', { gameCode });
  };

  // Next song
  const handleNextSong = () => {
    socketService.emit('nextSong', { gameCode });
  };

  // Skip song
  const handleSkipSong = () => {
    socketService.emit('skipSong', { gameCode });
  };

  const playerJoinUrl = `${window.location.origin}/player/${gameCode}`;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            TrackMaster
          </h1>
          <div className="flex items-center gap-4">
            {spotifyConnected ? (
              <span className="text-sm text-green-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Spotify Connected
              </span>
            ) : (
              <a
                href="/auth/spotify"
                className="px-4 py-2 bg-green-500 rounded-lg hover:bg-green-600 transition-colors text-sm font-semibold"
              >
                Connect Spotify
              </a>
            )}
          </div>
        </div>

        {/* Phase: No game created */}
        {!gameCode && (
          <div className="text-center py-20">
            <button
              onClick={handleCreateGame}
              disabled={!spotifyConnected}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create New Game
            </button>
            {!spotifyConnected && (
              <p className="mt-4 text-sm text-gray-400">Connect Spotify first</p>
            )}
          </div>
        )}

        {/* Phase: Setup (selecting artist) */}
        {gameCode && gameState?.phase === 'setup' && (
          <div className="space-y-6">
            <div className="bg-white/10 border border-white/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-4">Select Artist</h2>

              <input
                type="text"
                value={artistSearch}
                onChange={(e) => handleSearchArtist(e.target.value)}
                placeholder="Search for an artist..."
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => handleSelectArtist(artist)}
                      className="w-full flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left"
                    >
                      {artist.image && (
                        <img src={artist.image} alt={artist.name} className="w-16 h-16 rounded-lg object-cover" />
                      )}
                      <div>
                        <div className="font-semibold">{artist.name}</div>
                        <div className="text-xs text-gray-400">{artist.genres.slice(0, 3).join(', ')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase: Lobby (waiting for players) */}
        {gameCode && gameState?.phase === 'lobby' && (
          <div className="space-y-6">
            <div className="bg-white/10 border border-white/20 rounded-xl p-6 text-center">
              <h2 className="text-3xl font-bold mb-2">{gameState.artistName}</h2>
              <p className="text-gray-400 mb-6">{gameState.songs.length} songs loaded</p>

              {/* QR Code */}
              <div className="bg-white p-4 inline-block rounded-xl mb-4">
                <QRCode value={playerJoinUrl} size={200} />
              </div>

              <div className="text-lg font-mono mb-6">
                Game Code: <span className="text-purple-400 text-2xl">{gameCode}</span>
              </div>

              {/* Player List */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">Players ({gameState.players.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {gameState.players.map((player) => (
                    <div
                      key={player.id}
                      className="px-4 py-2 bg-white/5 rounded-lg border border-white/20"
                    >
                      {player.name}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartGame}
                disabled={gameState.players.length === 0}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Game
              </button>
            </div>
          </div>
        )}

        {/* Phase: Playing (active round) */}
        {gameCode && gameState?.phase === 'playing' && (
          <div className="space-y-6">
            <div className="bg-white/10 border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  Round {gameState.roundNumber} / {gameState.songs.length}
                </h2>
                <div className="text-3xl font-mono">
                  {Math.floor(((gameState.roundStartTime || 0) + 60000 - Date.now()) / 1000)}s
                </div>
              </div>

              <div className="text-center py-8">
                <div className="text-4xl mb-4">🎵</div>
                <p className="text-gray-400">Song playing...</p>
              </div>

              {/* Players who answered */}
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Answered:</h3>
                <div className="flex flex-wrap gap-2">
                  {gameState.players
                    .filter((p) => p.hasAnswered)
                    .map((p) => (
                      <div key={p.id} className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full text-sm">
                        {p.name} ✓
                      </div>
                    ))}
                </div>
              </div>

              <button
                onClick={handleSkipSong}
                className="mt-6 px-6 py-3 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
              >
                Skip to Results
              </button>
            </div>

            {/* Leaderboard */}
            <div className="bg-white/10 border border-white/20 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Leaderboard</h3>
              <div className="space-y-2">
                {[...gameState.players]
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                        <span className="font-semibold">{player.name}</span>
                      </div>
                      <span className="text-2xl font-bold text-purple-400">{player.score}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Phase: Reveal (show results) */}
        {gameCode && gameState?.phase === 'reveal' && (
          <div className="space-y-6">
            <div className="bg-white/10 border border-white/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-6">Round Results</h2>

              {/* Correct Answer */}
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                <div className="text-lg">
                  <strong>Song:</strong> {gameState.currentSong?.name}
                </div>
                <div className="text-lg">
                  <strong>Album:</strong> {gameState.currentSong?.albumName}
                </div>
              </div>

              {/* Player Answers */}
              <div className="space-y-3">
                {gameState.roundAnswers.map((answer) => (
                  <div
                    key={answer.playerId}
                    className="p-4 bg-white/5 rounded-lg border border-white/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{answer.playerName}</span>
                      <span className="text-2xl font-bold text-purple-400">
                        +{answer.points || 0} pts
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className={answer.songCorrect ? 'text-green-400' : 'text-red-400'}>
                        Song: {answer.songGuess} {answer.songCorrect ? '✓' : '✗'}
                      </div>
                      <div className={answer.albumCorrect ? 'text-green-400' : 'text-red-400'}>
                        Album: {answer.albumGuess} {answer.albumCorrect ? '✓' : '✗'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleNextSong}
                className="mt-6 w-full px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                Next Song
              </button>
            </div>
          </div>
        )}

        {/* Phase: Finished (winner) */}
        {gameCode && gameState?.phase === 'finished' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🏆</div>
            <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              {gameState.winner?.name} Wins!
            </h2>
            <div className="text-3xl font-bold text-purple-400 mb-8">
              {gameState.winner?.score} points
            </div>

            {/* Final Standings */}
            <div className="max-w-md mx-auto bg-white/10 border border-white/20 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Final Standings</h3>
              <div className="space-y-2">
                {[...gameState.players]
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                        <span className="font-semibold">{player.name}</span>
                      </div>
                      <span className="text-xl font-bold">{player.score}</span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-8 px-8 py-4 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors"
            >
              New Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
