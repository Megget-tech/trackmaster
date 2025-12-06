import { useEffect, useState } from 'react';
import type { GameState, Answer } from '@shared/types';
import { socketService } from '@/lib/socket';

interface PlayerPageProps {
  gameCode: string;
}

/**
 * PlayerPage - Player device interface
 *
 * Flow:
 * 1. Enter name to join
 * 2. Wait in lobby
 * 3. Submit song + album guesses during rounds
 * 4. View personal results
 * 5. See final standings
 */
export default function PlayerPage({ gameCode }: PlayerPageProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [songGuess, setSongGuess] = useState('');
  const [albumGuess, setAlbumGuess] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null);

  // Check for saved session
  useEffect(() => {
    const savedSession = localStorage.getItem('trackmaster_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.gameCode === gameCode && Date.now() - session.timestamp < 2 * 60 * 60 * 1000) {
          // Attempt reconnection
          socketService.emit('reconnectPlayer', {
            gameCode,
            persistentId: session.persistentId
          });
        }
      } catch (error) {
        console.error('Failed to parse saved session:', error);
      }
    }
  }, [gameCode]);

  // Socket event listeners
  useEffect(() => {
    socketService.on('gameStateUpdate', (state) => {
      setGameState(state);

      // Find my answer in current round
      if (state.phase === 'playing' || state.phase === 'reveal') {
        const me = state.players.find((p) => p.name === playerName);
        if (me) {
          setHasSubmitted(me.hasAnswered);
          setMyAnswer(me.currentAnswer || null);
        }
      }

      // Reset form on new round
      if (state.phase === 'playing' && state.roundStartTime) {
        setSongGuess('');
        setAlbumGuess('');
        setHasSubmitted(false);
        setMyAnswer(null);
      }
    });

    socketService.on('playerReconnected', ({ success, playerName: name }) => {
      if (success) {
        setPlayerName(name);
        setJoined(true);
      }
    });

    socketService.on('error', (message) => {
      alert(message);
    });

    return () => {
      socketService.off('gameStateUpdate');
      socketService.off('playerReconnected');
      socketService.off('error');
    };
  }, [playerName]);

  // Join game
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    socketService.emit('joinGame', {
      gameCode,
      playerName: playerName.trim()
    });

    // Save session for reconnection
    const persistentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(
      'trackmaster_session',
      JSON.stringify({
        gameCode,
        playerName: playerName.trim(),
        persistentId,
        timestamp: Date.now()
      })
    );

    setJoined(true);
  };

  // Submit answer
  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!songGuess.trim() || !albumGuess.trim()) return;

    socketService.emit('submitAnswer', {
      gameCode,
      songGuess: songGuess.trim(),
      albumGuess: albumGuess.trim()
    });

    setHasSubmitted(true);
  };

  const myPlayer = gameState?.players.find((p) => p.name === playerName);

  // Join screen
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              TrackMaster
            </h1>
            <p className="text-xl text-gray-300">
              Join Game: <span className="font-mono text-purple-400">{gameCode}</span>
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center text-lg"
                maxLength={20}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!playerName.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Game
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Lobby (waiting for game to start)
  if (gameState?.phase === 'lobby' || gameState?.phase === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl mb-4 animate-bounce">🎵</div>
          <h2 className="text-3xl font-bold">Welcome, {playerName}!</h2>
          {gameState.artistName ? (
            <p className="text-xl text-gray-300">
              Get ready to guess songs by <span className="text-purple-400 font-semibold">{gameState.artistName}</span>
            </p>
          ) : (
            <p className="text-xl text-gray-300">Waiting for master to select artist...</p>
          )}

          <div className="bg-white/10 border border-white/20 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Players in lobby:</h3>
            <div className="space-y-2">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className={`px-4 py-2 rounded-lg ${
                    player.name === playerName
                      ? 'bg-purple-500/30 border border-purple-500/50'
                      : 'bg-white/5'
                  }`}
                >
                  {player.name} {player.name === playerName && '(You)'}
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-400">Waiting for master to start the game...</p>
        </div>
      </div>
    );
  }

  // Playing (submit answers)
  if (gameState?.phase === 'playing') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4">🎵</div>
            <h2 className="text-2xl font-bold mb-2">
              Round {gameState.roundNumber} / {gameState.songs.length}
            </h2>
            <div className="text-3xl font-mono text-purple-400">
              {Math.max(0, Math.floor(((gameState.roundStartTime || 0) + 60000 - Date.now()) / 1000))}s
            </div>
          </div>

          {!hasSubmitted ? (
            <form onSubmit={handleSubmitAnswer} className="space-y-4">
              <div className="bg-white/10 border border-white/20 rounded-xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-300">Song Name</label>
                  <input
                    type="text"
                    value={songGuess}
                    onChange={(e) => setSongGuess(e.target.value)}
                    placeholder="Enter song name..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-300">Album Name</label>
                  <input
                    type="text"
                    value={albumGuess}
                    onChange={(e) => setAlbumGuess(e.target.value)}
                    placeholder="Enter album name..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!songGuess.trim() || !albumGuess.trim()}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Answer
              </button>
            </form>
          ) : (
            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-8 text-center">
              <div className="text-6xl mb-4">✓</div>
              <h3 className="text-2xl font-bold mb-2">Answer Submitted!</h3>
              <p className="text-gray-300">Waiting for other players...</p>
            </div>
          )}

          {/* Personal Score */}
          <div className="bg-white/10 border border-white/20 rounded-xl p-4 flex items-center justify-between">
            <span className="font-semibold">Your Score:</span>
            <span className="text-3xl font-bold text-purple-400">{myPlayer?.score || 0}</span>
          </div>
        </div>
      </div>
    );
  }

  // Reveal (show results)
  if (gameState?.phase === 'reveal') {
    const myResult = gameState.roundAnswers.find((a) => a.playerName === playerName);

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Round Results</h2>
          </div>

          {/* Correct Answer */}
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4">
            <h3 className="font-semibold mb-2 text-sm text-gray-300">Correct Answer:</h3>
            <div className="space-y-1">
              <div className="text-lg">
                <strong>Song:</strong> {gameState.currentSong?.name}
              </div>
              <div className="text-lg">
                <strong>Album:</strong> {gameState.currentSong?.albumName}
              </div>
            </div>
          </div>

          {/* Your Answer */}
          {myResult && (
            <div className="bg-white/10 border border-white/20 rounded-xl p-4">
              <h3 className="font-semibold mb-3">Your Answer:</h3>
              <div className="space-y-2">
                <div className={myResult.songCorrect ? 'text-green-400' : 'text-red-400'}>
                  Song: {myResult.songGuess} {myResult.songCorrect ? '✓' : '✗'}
                </div>
                <div className={myResult.albumCorrect ? 'text-green-400' : 'text-red-400'}>
                  Album: {myResult.albumGuess} {myResult.albumCorrect ? '✓' : '✗'}
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className="text-4xl font-bold text-purple-400">
                  +{myResult.points || 0} pts
                </div>
              </div>
            </div>
          )}

          {/* Total Score */}
          <div className="bg-white/10 border border-white/20 rounded-xl p-6 text-center">
            <h3 className="text-sm text-gray-400 mb-2">Your Total Score</h3>
            <div className="text-5xl font-bold text-purple-400">{myPlayer?.score || 0}</div>
          </div>

          <p className="text-center text-sm text-gray-400">Waiting for next round...</p>
        </div>
      </div>
    );
  }

  // Finished (winner)
  if (gameState?.phase === 'finished') {
    const myPosition = [...gameState.players]
      .sort((a, b) => b.score - a.score)
      .findIndex((p) => p.name === playerName) + 1;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl mb-4">
            {myPosition === 1 ? '🏆' : myPosition === 2 ? '🥈' : myPosition === 3 ? '🥉' : '🎮'}
          </div>

          {myPosition === 1 ? (
            <>
              <h2 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                You Won!
              </h2>
              <div className="text-3xl font-bold text-purple-400">{myPlayer?.score} points</div>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-bold">Game Over!</h2>
              <div className="text-2xl text-gray-300">
                You finished in <span className="text-purple-400 font-bold">#{myPosition}</span>
              </div>
              <div className="text-3xl font-bold text-purple-400">{myPlayer?.score} points</div>
            </>
          )}

          {/* Final Standings */}
          <div className="bg-white/10 border border-white/20 rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4">Final Standings</h3>
            <div className="space-y-2">
              {[...gameState.players]
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                      player.name === playerName
                        ? 'bg-purple-500/30 border border-purple-500/50'
                        : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                      <span className="font-semibold">
                        {player.name} {player.name === playerName && '(You)'}
                      </span>
                    </div>
                    <span className="text-xl font-bold">{player.score}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-gray-400">Loading game...</p>
      </div>
    </div>
  );
}
