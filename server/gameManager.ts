import { Game } from './game';

/**
 * GameManager - Singleton managing all active TrackMaster games
 *
 * Responsibilities:
 * - Create and track multiple games
 * - Map socket IDs to games for lookup
 * - Clean up finished games
 */
export class GameManager {
  private games: Map<string, Game> = new Map();
  private socketToGame: Map<string, string> = new Map();

  /**
   * Create a new game
   */
  createGame(masterSocketId: string): Game {
    const game = new Game(masterSocketId);
    this.games.set(game.getId(), game);
    this.socketToGame.set(masterSocketId, game.getId());
    return game;
  }

  /**
   * Get game by game code
   */
  getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  /**
   * Find game by any socket ID (master or player)
   */
  findGameBySocket(socketId: string): Game | undefined {
    const gameId = this.socketToGame.get(socketId);
    return gameId ? this.games.get(gameId) : undefined;
  }

  /**
   * Register a player's socket ID with a game
   */
  registerSocketToGame(socketId: string, gameId: string): void {
    this.socketToGame.set(socketId, gameId);
  }

  /**
   * End a game and clean up resources
   */
  endGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Remove all socket mappings
    const state = game.getState();

    // Remove master
    this.socketToGame.delete(state.masterSocketId);

    // Remove all players
    state.players.forEach(player => {
      this.socketToGame.delete(player.id);
    });

    // Delete game
    this.games.delete(gameId);

    console.log(`Game ${gameId} ended and cleaned up`);
  }

  /**
   * Get all active games (for debugging)
   */
  getAllGames(): Game[] {
    return Array.from(this.games.values());
  }

  /**
   * Get total active game count
   */
  getGameCount(): number {
    return this.games.size;
  }
}

// Export singleton instance
export const gameManager = new GameManager();
