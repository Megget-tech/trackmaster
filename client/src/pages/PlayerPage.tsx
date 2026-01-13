import { useEffect, useState, useRef } from "react";
import type { GameState, Answer } from "@shared/types";
import { socketService } from "@/lib/socket";

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
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [songGuess, setSongGuess] = useState("");
  const [albumGuess, setAlbumGuess] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const lastRoundNumber = useRef(0);

  // Check for saved session
  useEffect(() => {
    const savedSession = localStorage.getItem("trackmaster_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (
          session.gameCode === gameCode &&
          Date.now() - session.timestamp < 2 * 60 * 60 * 1000
        ) {
          // Attempt reconnection
          socketService.emit("reconnectPlayer", {
            gameCode,
            persistentId: session.persistentId,
          });
        }
      } catch (error) {
        console.error("Failed to parse saved session:", error);
      }
    }
  }, [gameCode]);

  // Socket event listeners
  useEffect(() => {
    socketService.on("gameStateUpdate", (state) => {
      console.log(
        "State update - Round:",
        state.roundNumber,
        "Last:",
        lastRoundNumber.current,
        "Phase:",
        state.phase,
      );

      setGameState(state);

      // Find my answer in current round
      if (state.phase === "playing" || state.phase === "reveal") {
        const me = state.players.find((p) => p.name === playerName);
        if (me) {
          // Only update hasSubmitted if it actually changed
          if (me.hasAnswered !== hasSubmitted) {
            setHasSubmitted(me.hasAnswered);
          }
        }
      }

      // Reset form only when a NEW round starts (round number changed)
      if (
        state.phase === "playing" &&
        state.roundNumber !== lastRoundNumber.current
      ) {
        console.log("NEW ROUND - Resetting form");
        lastRoundNumber.current = state.roundNumber;
        setSongGuess("");
        setAlbumGuess("");
        setHasSubmitted(false);
      }
    });

    socketService.on("playerReconnected", ({ success, playerName: name }) => {
      if (success) {
        setPlayerName(name);
        setJoined(true);
      }
    });

    socketService.on("error", (message) => {
      alert(message);
    });

    return () => {
      socketService.off("gameStateUpdate");
      socketService.off("playerReconnected");
      socketService.off("error");
    };
  }, [playerName]);

  // Join game
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    socketService.emit("joinGame", {
      gameCode,
      playerName: playerName.trim(),
    });

    // Save session for reconnection
    const persistentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(
      "trackmaster_session",
      JSON.stringify({
        gameCode,
        playerName: playerName.trim(),
        persistentId,
        timestamp: Date.now(),
      }),
    );

    setJoined(true);
  };

  // Submit answer
  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!songGuess.trim()) return; // Only require song

    socketService.emit("submitAnswer", {
      gameCode,
      songGuess: songGuess.trim(),
      albumGuess: albumGuess.trim() || "", // Send empty string if no album
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyber-cyan via-cyber-magenta to-cyber-purple bg-clip-text text-transparent glow-cyan-text mb-2 font-mono animate-neon-pulse">
              TRACKMASTER
            </h1>
            <p className="text-xl text-cyber-cyan/80 font-mono">
              JOIN_GAME:{" "}
              <span className="font-mono text-cyber-magenta glow-magenta-text">[{gameCode}]</span>
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="ENTER_YOUR_NAME..."
                className="w-full px-4 py-3 bg-dark-space/50 neon-border-cyan rounded-lg focus:outline-none focus:ring-2 focus:ring-cyber-cyan focus:glow-cyan text-center text-lg text-cyber-cyan placeholder:text-cyber-cyan/30 font-mono"
                maxLength={20}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!playerName.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-cyber-cyan to-cyber-magenta rounded-xl font-semibold text-lg font-mono hover:from-cyber-magenta hover:to-cyber-purple transition-all transform hover:scale-105 shadow-lg neon-border-cyan hover:glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            >
              JOIN_GAME &gt;&gt;
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Lobby (waiting for game to start)
  if (gameState?.phase === "lobby" || gameState?.phase === "setup") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="waveform mb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="waveform-bar" />
            ))}
          </div>
          <h2 className="text-3xl font-bold text-cyber-cyan font-mono">
            WELCOME, {playerName.toUpperCase()}!
          </h2>
          {gameState.artistName ? (
            <p className="text-xl text-cyber-cyan/80 font-mono">
              PREPARE_TO_GUESS_SONGS_BY{" "}
              <span className="text-cyber-magenta font-semibold glow-magenta-text">
                {gameState.artistName.toUpperCase()}
              </span>
            </p>
          ) : (
            <p className="text-xl text-cyber-cyan/80 font-mono">
              WAITING_FOR_MASTER_TO_SELECT_ARTIST...
            </p>
          )}

          <div className="holo-card neon-border-cyan rounded-xl p-6">
            <h3 className="font-semibold mb-4 text-cyber-magenta font-mono">
              PLAYERS_IN_LOBBY:
            </h3>
            <div className="space-y-2">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className={`px-4 py-2 rounded-lg font-mono ${
                    player.name === playerName
                      ? "bg-cyber-cyan/30 neon-border-cyan glow-cyan text-cyber-cyan"
                      : "bg-dark-space/50 text-cyber-cyan/70"
                  }`}
                >
                  &gt; {player.name.toUpperCase()} {player.name === playerName && "[YOU]"}
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-cyber-cyan/50 font-mono animate-pulse">
            WAITING_FOR_MASTER_TO_START...
          </p>
        </div>
      </div>
    );
  }

  // Playing (submit answers)
  if (gameState?.phase === "playing") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="waveform mb-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="waveform-bar" />
              ))}
            </div>
            <h2 className="text-2xl font-bold mb-2 text-cyber-cyan font-mono">
              ROUND [{gameState.roundNumber} / {gameState.songs.length}]
            </h2>
            <div className="text-3xl font-mono text-cyber-orange glow-orange-text animate-pulse">
              {Math.max(
                0,
                Math.floor(
                  ((gameState.roundStartTime || 0) + 60000 - Date.now()) / 1000,
                ),
              )}
              s
            </div>
          </div>

          {!hasSubmitted ? (
            <form onSubmit={handleSubmitAnswer} className="space-y-4">
              <div className="holo-card neon-border-cyan rounded-xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-cyber-cyan font-mono">
                    SONG_NAME:
                  </label>
                  <input
                    type="text"
                    value={songGuess}
                    onChange={(e) => setSongGuess(e.target.value)}
                    placeholder="ENTER_SONG_NAME..."
                    className="w-full px-4 py-3 bg-dark-space/50 neon-border-cyan rounded-lg focus:outline-none focus:ring-2 focus:ring-cyber-cyan focus:glow-cyan text-cyber-cyan placeholder:text-cyber-cyan/30 font-mono"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-cyber-cyan font-mono">
                    ALBUM_NAME:
                  </label>
                  <input
                    type="text"
                    value={albumGuess}
                    onChange={(e) => setAlbumGuess(e.target.value)}
                    placeholder="ENTER_ALBUM_NAME... [OPTIONAL]"
                    className="w-full px-4 py-3 bg-dark-space/50 neon-border-cyan rounded-lg focus:outline-none focus:ring-2 focus:ring-cyber-cyan focus:glow-cyan text-cyber-cyan placeholder:text-cyber-cyan/30 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!songGuess.trim()}
                className="w-full py-4 px-6 bg-gradient-to-r from-cyber-green to-cyber-cyan rounded-xl font-semibold text-lg font-mono hover:from-cyber-cyan hover:to-cyber-green transition-all transform hover:scale-105 shadow-lg neon-border-cyan hover:glow-green disabled:opacity-50 disabled:cursor-not-allowed text-dark-void"
              >
                SUBMIT_ANSWER &gt;&gt;
              </button>
            </form>
          ) : (
            <div className="holo-card neon-border-cyan rounded-xl p-8 text-center glow-green">
              <div className="text-6xl mb-4 text-cyber-green glow-green-text">✓</div>
              <h3 className="text-2xl font-bold mb-2 text-cyber-green font-mono">
                ANSWER_SUBMITTED!
              </h3>
              <p className="text-cyber-cyan/70 font-mono">WAITING_FOR_OTHER_PLAYERS...</p>
            </div>
          )}

          {/* Personal Score */}
          <div className="holo-card neon-border-magenta rounded-xl p-4 flex items-center justify-between">
            <span className="font-semibold text-cyber-magenta font-mono">YOUR_SCORE:</span>
            <span className="text-3xl font-bold text-cyber-magenta glow-magenta-text">
              {myPlayer?.score || 0}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Reveal (show results)
  if (gameState?.phase === "reveal") {
    const myResult = gameState.roundAnswers.find(
      (a) => a.playerName === playerName,
    );

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 text-cyber-cyan font-mono">
              &gt; ROUND_RESULTS
            </h2>
          </div>

          {/* Correct Answer */}
          <div className="holo-card neon-border-cyan rounded-xl p-4 glow-green">
            <h3 className="font-semibold mb-2 text-sm text-cyber-green/70 font-mono">
              CORRECT_ANSWER:
            </h3>
            <div className="space-y-1">
              <div className="text-lg text-cyber-green font-mono">
                <strong>SONG:</strong> {gameState.currentSong?.name}
              </div>
              <div className="text-lg text-cyber-green font-mono">
                <strong>ALBUM:</strong> {gameState.currentSong?.albumName}
              </div>
            </div>
          </div>

          {/* Your Answer */}
          {myResult && (
            <div className="holo-card neon-border-cyan rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-cyber-cyan font-mono">
                YOUR_ANSWER:
              </h3>
              <div className="space-y-2">
                <div
                  className={
                    myResult.songCorrect ? "text-cyber-green" : "text-cyber-red"
                  }
                >
                  <span className="font-mono">SONG: {myResult.songGuess} {myResult.songCorrect ? "✓" : "✗"}</span>
                </div>
                <div
                  className={
                    myResult.albumCorrect ? "text-cyber-green" : "text-cyber-red"
                  }
                >
                  <span className="font-mono">ALBUM: {myResult.albumGuess} {myResult.albumCorrect ? "✓" : "✗"}</span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className="text-4xl font-bold text-cyber-magenta glow-magenta-text font-mono">
                  +{myResult.points || 0} PTS
                </div>
              </div>
            </div>
          )}

          {/* Total Score */}
          <div className="holo-card neon-border-magenta rounded-xl p-6 text-center">
            <h3 className="text-sm text-cyber-magenta/70 mb-2 font-mono">YOUR_TOTAL_SCORE:</h3>
            <div className="text-5xl font-bold text-cyber-magenta glow-magenta-text font-mono">
              {myPlayer?.score || 0}
            </div>
          </div>

          <p className="text-center text-sm text-cyber-cyan/50 font-mono animate-pulse">
            WAITING_FOR_NEXT_ROUND...
          </p>
        </div>
      </div>
    );
  }

  // Finished (winner)
  if (gameState?.phase === "finished") {
    const myPosition =
      [...gameState.players]
        .sort((a, b) => b.score - a.score)
        .findIndex((p) => p.name === playerName) + 1;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl mb-4">
            {myPosition === 1 ? (
              <span className="glow-green-text">◆ VICTORY ◆</span>
            ) : myPosition === 2 ? (
              <span className="glow-cyan-text">◇ 2ND ◇</span>
            ) : myPosition === 3 ? (
              <span className="glow-magenta-text">◇ 3RD ◇</span>
            ) : (
              <span className="text-cyber-cyan/50">●</span>
            )}
          </div>

          {myPosition === 1 ? (
            <>
              <h2 className="text-5xl font-bold bg-gradient-to-r from-cyber-green via-cyber-cyan to-cyber-magenta bg-clip-text text-transparent glow-green-text font-mono animate-neon-pulse">
                YOU_WON!
              </h2>
              <div className="text-3xl font-bold text-cyber-magenta glow-magenta-text font-mono">
                [ {myPlayer?.score} POINTS ]
              </div>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-bold text-cyber-cyan font-mono">
                GAME_OVER
              </h2>
              <div className="text-2xl text-cyber-cyan/80 font-mono">
                YOU_FINISHED:{" "}
                <span className="text-cyber-magenta font-bold glow-magenta-text">
                  #{myPosition}
                </span>
              </div>
              <div className="text-3xl font-bold text-cyber-magenta glow-magenta-text font-mono">
                [ {myPlayer?.score} POINTS ]
              </div>
            </>
          )}

          {/* Final Standings */}
          <div className="holo-card neon-border-cyan rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4 text-cyber-cyan font-mono">
              [ FINAL_STANDINGS ]
            </h3>
            <div className="space-y-2">
              {[...gameState.players]
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg font-mono ${
                      player.name === playerName
                        ? "bg-cyber-cyan/30 neon-border-cyan glow-cyan"
                        : "bg-dark-space/50 neon-border-cyan"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
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
                      <span className="font-semibold text-cyber-cyan">
                        {player.name.toUpperCase()} {player.name === playerName && "[YOU]"}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-cyber-magenta">{player.score}</span>
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
        <div className="waveform mb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="waveform-bar" />
          ))}
        </div>
        <p className="text-cyber-cyan/70 font-mono">LOADING_GAME...</p>
      </div>
    </div>
  );
}
