import { Server, Socket } from 'socket.io';
import { GameManager } from './gameManager';
import { spotifyService } from './spotify';
import type { SocketEvents } from '@shared/types';

const gameManager = new GameManager();

/**
 * Setup Socket.io event handlers for TrackMaster
 *
 * Handles all real-time communication:
 * - Game creation and joining
 * - Artist selection and song loading
 * - Answer submission and evaluation
 * - Player reconnection and disconnection
 */
export function setupSocketHandlers(io: Server<SocketEvents>) {
  io.on('connection', (socket: Socket<SocketEvents>) => {
    console.log(`Socket connected: ${socket.id}`);

    /**
     * CREATE GAME
     * Master creates a new game
     */
    socket.on('createGame', () => {
      try {
        const game = gameManager.createGame(socket.id);
        socket.join(game.getId());

        socket.emit('gameCreated', { gameCode: game.getId() });
        console.log(`Game created: ${game.getId()} by ${socket.id}`);
      } catch (error) {
        console.error('Create game error:', error);
        socket.emit('error', 'Failed to create game');
      }
    });

    /**
     * JOIN GAME
     * Player joins an existing game
     */
    socket.on('joinGame', ({ gameCode, playerName, persistentId }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          return socket.emit('error', 'Game not found');
        }

        const player = game.addPlayer(socket.id, playerName, persistentId);
        socket.join(gameCode);

        // Register socket with gameManager
        gameManager.registerSocketToGame(socket.id, gameCode);

        console.log(`Player ${playerName} joined game ${gameCode}`);

        // Send game state to all players
        io.to(gameCode).emit('gameStateUpdate', game.getState());
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit('error', 'Failed to join game');
      }
    });

    /**
     * RECONNECT PLAYER
     * Player reconnects to game with saved persistentId
     */
    socket.on('reconnectPlayer', ({ gameCode, persistentId }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          return socket.emit('error', 'Game not found');
        }

        const player = game.reconnectPlayer(socket.id, persistentId);
        if (!player) {
          return socket.emit('error', 'Player not found in game');
        }

        socket.join(gameCode);

        console.log(`Player ${player.name} reconnected to game ${gameCode}`);

        // Confirm reconnection to player
        socket.emit('playerReconnected', {
          success: true,
          playerName: player.name
        });

        // Update all clients
        io.to(gameCode).emit('gameStateUpdate', game.getState());
      } catch (error) {
        console.error('Reconnect error:', error);
        socket.emit('error', 'Failed to reconnect');
      }
    });

    /**
     * SELECT ARTIST
     * Master selects an artist and loads songs
     */
    socket.on('selectArtist', async ({ gameCode, artistId, artistName, artistImage }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          return socket.emit('error', 'Game not found');
        }

        // Only master can select artist
        if (!game.isMaster(socket.id)) {
          return socket.emit('error', 'Only master can select artist');
        }

        console.log(`Fetching songs for artist: ${artistName}`);

        // Get master's Spotify access token from their socket data
        // We'll need to pass this from the client or store it server-side
        // For now, let's get it from the socket handshake
        const accessToken = socket.handshake.auth.spotifyAccessToken;
        if (!accessToken) {
          return socket.emit('error', 'Spotify token not found');
        }

        // Fetch random songs from artist
        const songs = await spotifyService.getRandomSongsFromArtist(artistId, accessToken, 10);

        if (songs.length < 10) {
          return socket.emit('error', 'Could not fetch enough songs from artist');
        }

        // Update game with artist and songs
        game.setArtist(artistName, artistImage, songs);

        console.log(`Artist selected: ${artistName}, ${songs.length} songs loaded`);

        // Notify all clients
        io.to(gameCode).emit('artistSelected', {
          artistName,
          songCount: songs.length
        });
        io.to(gameCode).emit('gameStateUpdate', game.getState());
      } catch (error) {
        console.error('Select artist error:', error);
        socket.emit('error', 'Failed to load songs from artist');
      }
    });

    /**
     * START GAME
     * Master starts the game (loads first song)
     */
    socket.on('startGame', ({ gameCode }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          return socket.emit('error', 'Game not found');
        }

        if (!game.isMaster(socket.id)) {
          return socket.emit('error', 'Only master can start game');
        }

        game.startGame();

        console.log(`Game started: ${gameCode}`);

        // Send updated state with first song loaded
        io.to(gameCode).emit('gameStateUpdate', game.getState());

        // Set 60-second timer for auto-reveal
        setTimeout(() => {
          const currentState = game.getState();
          // Only auto-reveal if still in playing phase (not already manually revealed)
          if (currentState.phase === 'playing') {
            handleRoundEnd(game, gameCode);
          }
        }, 60000);
      } catch (error) {
        console.error('Start game error:', error);
        socket.emit('error', 'Failed to start game');
      }
    });

    /**
     * SUBMIT ANSWER
     * Player submits their answer for current song
     */
    socket.on('submitAnswer', ({ gameCode, songGuess, albumGuess }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          return socket.emit('error', 'Game not found');
        }

        const player = game.getPlayer(socket.id);
        if (!player) {
          return socket.emit('error', 'Player not found');
        }

        // Record the answer
        game.recordAnswer(socket.id, songGuess, albumGuess);

        console.log(`${player.name} submitted answer: "${songGuess}" / "${albumGuess}"`);

        // Notify all players that someone answered
        io.to(gameCode).emit('playerAnswered', { playerName: player.name });
        io.to(gameCode).emit('gameStateUpdate', game.getState());

        // Check if all players have answered
        if (game.allPlayersAnswered()) {
          console.log('All players answered - revealing results');
          handleRoundEnd(game, gameCode);
        }
      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', 'Failed to submit answer');
      }
    });

    /**
     * SKIP SONG (Master only)
     * Master manually ends current round
     */
    socket.on('skipSong', ({ gameCode }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          return socket.emit('error', 'Game not found');
        }

        if (!game.isMaster(socket.id)) {
          return socket.emit('error', 'Only master can skip');
        }

        console.log(`Master skipped song in game ${gameCode}`);

        handleRoundEnd(game, gameCode);
      } catch (error) {
        console.error('Skip song error:', error);
        socket.emit('error', 'Failed to skip song');
      }
    });

    /**
     * NEXT SONG
     * Master advances to next song after seeing results
     */
    socket.on('nextSong', ({ gameCode }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          return socket.emit('error', 'Game not found');
        }

        if (!game.isMaster(socket.id)) {
          return socket.emit('error', 'Only master can advance');
        }

        // Check if game is finished
        if (game.isFinished()) {
          const results = game.getFinalResults();
          io.to(gameCode).emit('gameFinished', results);
          console.log(`Game ${gameCode} finished. Winner: ${results.winner?.name}`);
        } else {
          // Load next song
          game.nextSong();
          io.to(gameCode).emit('gameStateUpdate', game.getState());

          console.log(`Next song loaded in game ${gameCode}`);

          // Set 60-second timer for next round
          setTimeout(() => {
            const currentState = game.getState();
            if (currentState.phase === 'playing') {
              handleRoundEnd(game, gameCode);
            }
          }, 60000);
        }
      } catch (error) {
        console.error('Next song error:', error);
        socket.emit('error', 'Failed to load next song');
      }
    });

    /**
     * DISCONNECT
     * Player or master disconnects
     */
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);

      const game = gameManager.findGameBySocket(socket.id);
      if (!game) return;

      // If master disconnects, end the game
      if (game.isMaster(socket.id)) {
        console.log(`Master disconnected from game ${game.getId()} - ending game`);
        io.to(game.getId()).emit('error', 'Master disconnected - game ended');
        gameManager.endGame(game.getId());
      } else {
        // Mark player as disconnected but keep in game
        const player = game.getPlayer(socket.id);
        if (player) {
          game.markPlayerDisconnected(socket.id);
          console.log(`Player ${player.name} disconnected from game ${game.getId()}`);

          io.to(game.getId()).emit('playerDisconnected', { playerName: player.name });
          io.to(game.getId()).emit('gameStateUpdate', game.getState());
        }
      }
    });
  });

  /**
   * Helper: Handle round end (evaluate answers, show results)
   */
  function handleRoundEnd(game: any, gameCode: string) {
    game.evaluateRound();

    const results = game.getRoundResults();

    // Broadcast results
    io.to(gameCode).emit('roundEnded', results);
    io.to(gameCode).emit('gameStateUpdate', game.getState());

    // If game finished, send final results
    if (game.isFinished()) {
      const finalResults = game.getFinalResults();
      io.to(gameCode).emit('gameFinished', finalResults);
      console.log(`Game ${gameCode} finished. Winner: ${finalResults.winner?.name}`);
    }
  }
}
