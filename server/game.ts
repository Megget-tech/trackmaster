import { GameState, Player, Song, Answer, GamePhase } from "@shared/types";
import { validateAnswer } from "./fuzzyMatch";

/**
 * Game Class - Core TrackMaster game logic
 *
 * Manages a single game instance:
 * - Player lifecycle (join, reconnect, disconnect)
 * - Song progression (load, next)
 * - Answer submission and evaluation
 * - Scoring (speed-based for song, flat bonus for album)
 * - Winner detection (first to finish 10 rounds with highest score)
 */
export class Game {
  private state: GameState;

  constructor(masterSocketId: string) {
    this.state = {
      id: this.generateGameCode(),
      masterSocketId,
      players: [],
      artistName: '',
      artistImage: null,
      songs: [],
      currentSongIndex: -1,
      currentSong: null,
      phase: 'setup',
      roundNumber: 0,
      roundStartTime: null,
      roundTimeLimit: 60,  // 60 seconds per round
      roundAnswers: [],
      winner: null
    };
  }

  /**
   * Generate a random 6-character game code
   * Example: "A1B2C3"
   */
  private generateGameCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get current game state (read-only copy)
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Get game ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Set artist and songs for the game
   */
  setArtist(name: string, image: string | null, songs: Song[]): void {
    this.state.artistName = name;
    this.state.artistImage = image;
    this.state.songs = songs;
    this.state.phase = 'lobby';
  }

  /**
   * Add a new player to the game
   */
  addPlayer(socketId: string, name: string, persistentId?: string): Player {
    // Check if player with this persistentId already exists (reconnection case)
    if (persistentId) {
      const existingPlayer = this.state.players.find(p => p.persistentId === persistentId);
      if (existingPlayer) {
        // Update socket ID and mark as connected
        existingPlayer.id = socketId;
        existingPlayer.connected = true;
        return existingPlayer;
      }
    }

    // Create new player
    const player: Player = {
      id: socketId,
      name,
      score: 0,
      connected: true,
      persistentId: persistentId || this.generatePersistentId(),
      hasAnswered: false
    };

    this.state.players.push(player);
    return player;
  }

  /**
   * Reconnect an existing player
   */
  reconnectPlayer(socketId: string, persistentId: string): Player | null {
    const player = this.state.players.find(p => p.persistentId === persistentId);
    if (!player) {
      return null;
    }

    player.id = socketId;
    player.connected = true;
    return player;
  }

  /**
   * Mark player as disconnected (but keep in game)
   */
  markPlayerDisconnected(socketId: string): void {
    const player = this.state.players.find(p => p.id === socketId);
    if (player) {
      player.connected = false;
    }
  }

  /**
   * Get a player by socket ID
   */
  getPlayer(socketId: string): Player | undefined {
    return this.state.players.find(p => p.id === socketId);
  }

  /**
   * Start the game (load first song)
   */
  startGame(): void {
    if (this.state.songs.length === 0) {
      throw new Error('No songs loaded');
    }

    this.state.phase = 'playing';
    this.nextSong();
  }

  /**
   * Load next song
   */
  nextSong(): void {
    this.state.currentSongIndex++;
    this.state.currentSong = this.state.songs[this.state.currentSongIndex];
    this.state.roundNumber++;
    this.state.roundStartTime = Date.now();
    this.state.roundAnswers = [];
    this.state.phase = 'playing';

    // Reset hasAnswered for all players
    this.state.players.forEach(p => {
      p.hasAnswered = false;
      p.currentAnswer = undefined;
    });
  }

  /**
   * Record a player's answer
   */
  recordAnswer(socketId: string, songGuess: string, albumGuess: string): void {
    const player = this.getPlayer(socketId);
    if (!player) {
      throw new Error('Player not found');
    }

    const answer: Answer = {
      playerId: socketId,
      playerName: player.name,
      songGuess,
      albumGuess,
      timestamp: Date.now()
    };

    this.state.roundAnswers.push(answer);
    player.hasAnswered = true;
    player.currentAnswer = answer;
  }

  /**
   * Check if all connected players have answered
   */
  allPlayersAnswered(): boolean {
    const connectedPlayers = this.state.players.filter(p => p.connected);
    if (connectedPlayers.length === 0) return false;

    return connectedPlayers.every(p => p.hasAnswered);
  }

  /**
   * Evaluate round results and assign points
   *
   * Scoring:
   * - Song name: 3 points (1st), 2 points (2nd), 1 point (3rd+)
   * - Album name: +1 point (no speed bonus)
   */
  evaluateRound(): void {
    if (!this.state.currentSong) return;

    const correctSong = this.state.currentSong.name;
    const correctAlbum = this.state.currentSong.albumName;

    // Step 1: Check each answer for correctness
    this.state.roundAnswers.forEach(answer => {
      answer.songCorrect = validateAnswer(answer.songGuess, correctSong);
      answer.albumCorrect = validateAnswer(answer.albumGuess, correctAlbum);
      answer.points = 0;
    });

    // Step 2: Sort correct song answers by timestamp (speed)
    const correctSongAnswers = this.state.roundAnswers
      .filter(a => a.songCorrect)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Step 3: Assign speed-based points for song name
    correctSongAnswers.forEach((answer, index) => {
      if (index === 0) answer.points = 3;       // 1st place
      else if (index === 1) answer.points = 2;  // 2nd place
      else answer.points = 1;                   // 3rd+ place
    });

    // Step 4: Add album bonus (+1 point, no speed consideration)
    this.state.roundAnswers.forEach(answer => {
      if (answer.albumCorrect) {
        answer.points = (answer.points || 0) + 1;
      }
    });

    // Step 5: Update player scores
    this.state.roundAnswers.forEach(answer => {
      const player = this.getPlayer(answer.playerId);
      if (player && answer.points) {
        player.score += answer.points;
      }
    });

    // Step 6: Check for game end (10 rounds complete)
    if (this.state.currentSongIndex >= this.state.songs.length - 1) {
      this.state.phase = 'finished';
      // Determine winner (highest score)
      const sortedPlayers = [...this.state.players].sort((a, b) => b.score - a.score);
      this.state.winner = sortedPlayers[0] || null;
    } else {
      this.state.phase = 'reveal';
    }
  }

  /**
   * Check if game is finished
   */
  isFinished(): boolean {
    return this.state.phase === 'finished';
  }

  /**
   * Check if socket ID is the master
   */
  isMaster(socketId: string): boolean {
    return this.state.masterSocketId === socketId;
  }

  /**
   * Generate a unique persistent ID for reconnection
   */
  private generatePersistentId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set game phase
   */
  setPhase(phase: GamePhase): void {
    this.state.phase = phase;
  }

  /**
   * Get current round results for reveal
   */
  getRoundResults(): {
    answers: Answer[];
    correctSong: string;
    correctAlbum: string;
  } {
    return {
      answers: this.state.roundAnswers,
      correctSong: this.state.currentSong?.name || '',
      correctAlbum: this.state.currentSong?.albumName || ''
    };
  }

  /**
   * Get final results for game finished screen
   */
  getFinalResults(): {
    winner: Player | null;
    finalScores: Player[];
  } {
    const sortedPlayers = [...this.state.players].sort((a, b) => b.score - a.score);
    return {
      winner: this.state.winner,
      finalScores: sortedPlayers
    };
  }
}
