/**
 * TrackMaster - Shared TypeScript Types
 *
 * These interfaces define the game state, player data, and socket events
 * for the music trivia game where players guess song and album names.
 */

/**
 * Game phases that determine UI state and available actions
 */
export type GamePhase =
  | 'setup'      // Master selecting artist
  | 'lobby'      // Players joining via QR code
  | 'playing'    // Active round, players submitting answers
  | 'reveal'     // Results shown, correct answers displayed
  | 'finished';  // Game over, winner announced

/**
 * Complete game state - server is source of truth
 */
export interface GameState {
  id: string;                    // Unique game code (e.g., "A1B2C3")
  masterSocketId: string;        // Socket ID of game master
  players: Player[];             // All players (connected & disconnected)
  artistName: string;            // Selected artist name
  artistImage: string | null;    // Artist image URL
  songs: Song[];                 // 10 songs for the game
  currentSongIndex: number;      // 0-9, which song is playing
  currentSong: Song | null;      // Current song being played
  phase: GamePhase;              // Current game phase
  roundNumber: number;           // 1-10, current round
  roundStartTime: number | null; // Date.now() when round started
  roundTimeLimit: number;        // Time limit in seconds (default 60)
  roundAnswers: Answer[];        // All answers submitted this round
  winner: Player | null;         // Player who reached 10 points first, or null
}

/**
 * Player in the game
 */
export interface Player {
  id: string;                    // Socket ID
  name: string;                  // Display name
  score: number;                 // Total score across all rounds
  connected: boolean;            // Connection status
  persistentId?: string;         // For reconnection (localStorage)
  hasAnswered: boolean;          // Has submitted answer this round
  currentAnswer?: Answer;        // Their answer for current round
}

/**
 * Song metadata
 */
export interface Song {
  id: string;                    // Spotify track ID
  name: string;                  // Song title
  albumName: string;             // Album title
  uri: string;                   // Spotify URI (spotify:track:xxx)
  duration: number;              // Track duration in milliseconds
}

/**
 * Player's answer for a round
 */
export interface Answer {
  playerId: string;              // Player's socket ID
  playerName: string;            // Player name (for display)
  songGuess: string;             // Their song name guess
  albumGuess: string;            // Their album name guess
  timestamp: number;             // Date.now() when submitted (for speed scoring)
  songCorrect?: boolean;         // Was song guess correct? (set after evaluation)
  albumCorrect?: boolean;        // Was album guess correct? (set after evaluation)
  points?: number;               // Points earned (1-4: 3+1, 2+1, 1+1, or just album bonus)
}

/**
 * Socket.io event definitions
 * These define all client ↔ server communication
 */
export interface SocketEvents {
  // ============ CLIENT → SERVER ============

  /**
   * Master creates a new game
   * Response: gameCreated
   */
  createGame: () => void;

  /**
   * Player joins a game
   * @param data.gameCode - Game ID to join
   * @param data.playerName - Player's chosen name
   * @param data.persistentId - Optional reconnection ID from localStorage
   * Response: gameStateUpdate
   */
  joinGame: (data: { gameCode: string; playerName: string; persistentId?: string }) => void;

  /**
   * Player reconnects to existing game
   * @param data.gameCode - Game ID
   * @param data.persistentId - Saved reconnection ID
   * Response: playerReconnected, gameStateUpdate
   */
  reconnectPlayer: (data: { gameCode: string; persistentId: string }) => void;

  /**
   * Master selects an artist to start the game
   * @param data.gameCode - Game ID
   * @param data.artistId - Spotify artist ID
   * @param data.artistName - Artist display name
   * @param data.artistImage - Artist image URL
   * Response: artistSelected, gameStateUpdate
   */
  selectArtist: (data: {
    gameCode: string;
    artistId: string;
    artistName: string;
    artistImage: string | null;
  }) => void;

  /**
   * Master starts the game (loads first song)
   * @param data.gameCode - Game ID
   * Response: gameStateUpdate (phase='playing')
   */
  startGame: (data: { gameCode: string }) => void;

  /**
   * Player submits answer for current song
   * @param data.gameCode - Game ID
   * @param data.songGuess - Song name guess
   * @param data.albumGuess - Album name guess
   * Response: playerAnswered, gameStateUpdate
   * Auto-triggers: roundEnded (if all players answered)
   */
  submitAnswer: (data: {
    gameCode: string;
    songGuess: string;
    albumGuess: string;
  }) => void;

  /**
   * Master skips current song (only valid during 'playing' phase)
   * @param data.gameCode - Game ID
   * Response: roundEnded, gameStateUpdate
   */
  skipSong: (data: { gameCode: string }) => void;

  /**
   * Master advances to next song (after seeing results)
   * @param data.gameCode - Game ID
   * Response: gameStateUpdate (next song loaded) OR gameFinished (if last song)
   */
  nextSong: (data: { gameCode: string }) => void;

  // ============ SERVER → CLIENT ============

  /**
   * Sent to master after creating game
   * @param data.gameCode - Generated game code
   */
  gameCreated: (data: { gameCode: string }) => void;

  /**
   * Broadcast to all clients when game state changes
   * @param state - Complete game state
   */
  gameStateUpdate: (state: GameState) => void;

  /**
   * Broadcast when artist is selected and songs are loaded
   * @param data.artistName - Artist name
   * @param data.songCount - Number of songs loaded
   */
  artistSelected: (data: { artistName: string; songCount: number }) => void;

  /**
   * Broadcast when a player submits their answer
   * @param data.playerName - Name of player who answered
   */
  playerAnswered: (data: { playerName: string }) => void;

  /**
   * Broadcast when round ends (time up or all answered)
   * @param data.answers - All answers with correctness & points
   * @param data.correctSong - Correct song name
   * @param data.correctAlbum - Correct album name
   */
  roundEnded: (data: {
    answers: Answer[];
    correctSong: string;
    correctAlbum: string;
  }) => void;

  /**
   * Broadcast when game finishes (10 rounds complete)
   * @param data.winner - Player with highest score
   * @param data.finalScores - All players sorted by score
   */
  gameFinished: (data: {
    winner: Player;
    finalScores: Player[];
  }) => void;

  /**
   * Sent to reconnecting player
   * @param data.success - Whether reconnection succeeded
   * @param data.playerName - Player's saved name
   */
  playerReconnected: (data: { success: boolean; playerName: string }) => void;

  /**
   * Broadcast when a player disconnects
   * @param data.playerName - Name of disconnected player
   */
  playerDisconnected: (data: { playerName: string }) => void;

  /**
   * Error message sent to client
   * @param message - Error description
   */
  error: (message: string) => void;
}

/**
 * Artist search result from Spotify
 */
export interface ArtistSearchResult {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
}

/**
 * Express session data (stored in req.session)
 */
declare module 'express-session' {
  interface SessionData {
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
    spotifyTokenExpiry?: number;
    spotifyOAuthState?: string;
  }
}
