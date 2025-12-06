import SpotifyWebApi from 'spotify-web-api-node';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

function getRedirectUri(): string {
  if (process.env.SPOTIFY_REDIRECT_URI) {
    return process.env.SPOTIFY_REDIRECT_URI;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/auth/spotify/callback`;
  }
  return 'http://localhost:5050/auth/spotify/callback';
}

const REDIRECT_URI = getRedirectUri();

/**
 * SpotifyService - Handles all Spotify API interactions for TrackMaster
 *
 * Key features:
 * - Artist search autocomplete
 * - Fetch random songs from an artist's discography
 * - Playback control (play, pause, get devices)
 */
export class SpotifyService {
  private spotifyApi: SpotifyWebApi;

  constructor() {
    this.spotifyApi = new SpotifyWebApi({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI
    });
  }

  /**
   * Search for artists by name
   * Used in master UI autocomplete for artist selection
   *
   * @param query - Artist name search query
   * @param accessToken - User's Spotify access token
   * @returns Array of artists with id, name, image, genres
   */
  async searchArtists(query: string, accessToken: string): Promise<Array<{
    id: string;
    name: string;
    image: string | null;
    genres: string[];
  }>> {
    this.spotifyApi.setAccessToken(accessToken);

    const response = await this.spotifyApi.searchArtists(query, { limit: 10 });

    return response.body.artists!.items.map(artist => ({
      id: artist.id,
      name: artist.name,
      image: artist.images[0]?.url || null,
      genres: artist.genres
    }));
  }

  /**
   * Get random songs from an artist for the game
   * Combines top tracks + deep cuts from albums for variety
   *
   * @param artistId - Spotify artist ID
   * @param accessToken - User's Spotify access token
   * @param count - Number of songs to select (default 10)
   * @returns Array of songs with metadata
   */
  async getRandomSongsFromArtist(
    artistId: string,
    accessToken: string,
    count: number = 10
  ): Promise<Array<{
    id: string;
    name: string;
    albumName: string;
    uri: string;
    duration: number;
  }>> {
    this.spotifyApi.setAccessToken(accessToken);

    // Step 1: Get artist's top tracks (most popular)
    const topTracksResponse = await this.spotifyApi.getArtistTopTracks(artistId, 'US');
    const topTracks = topTracksResponse.body.tracks;

    // Step 2: Get artist's albums
    const albumsResponse = await this.spotifyApi.getArtistAlbums(artistId, {
      limit: 50,
      include_groups: 'album,single'  // Include albums and singles, exclude compilations
    });

    // Step 3: Collect tracks from albums (for deep cuts)
    const allTracks: Array<{
      id: string;
      name: string;
      albumName: string;
      uri: string;
      duration: number;
    }> = [];

    // Add top tracks first
    topTracks.forEach(track => {
      allTracks.push({
        id: track.id,
        name: track.name,
        albumName: track.album.name,
        uri: track.uri,
        duration: track.duration_ms
      });
    });

    // Fetch tracks from up to 10 albums (to avoid rate limits)
    const albumsToFetch = albumsResponse.body.items.slice(0, 10);

    for (const album of albumsToFetch) {
      try {
        const albumTracksResponse = await this.spotifyApi.getAlbumTracks(album.id);

        albumTracksResponse.body.items.forEach(track => {
          // Avoid duplicates by checking if track already exists
          if (!allTracks.find(t => t.id === track.id)) {
            allTracks.push({
              id: track.id,
              name: track.name,
              albumName: album.name,
              uri: track.uri,
              duration: track.duration_ms
            });
          }
        });
      } catch (error) {
        console.error(`Failed to fetch tracks from album ${album.name}:`, error);
        // Continue with other albums even if one fails
      }
    }

    // Step 4: Shuffle and select 'count' unique songs
    const shuffled = this.shuffle(allTracks);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Play a track on the user's active device
   *
   * @param accessToken - User's Spotify access token
   * @param trackUri - Spotify track URI (spotify:track:xxx)
   * @param deviceId - Optional specific device to play on
   */
  async playTrack(accessToken: string, trackUri: string, deviceId?: string): Promise<void> {
    this.spotifyApi.setAccessToken(accessToken);

    await this.spotifyApi.play({
      uris: [trackUri],
      device_id: deviceId
    });
  }

  /**
   * Pause playback
   *
   * @param accessToken - User's Spotify access token
   * @param deviceId - Optional specific device to pause
   */
  async pausePlayback(accessToken: string, deviceId?: string): Promise<void> {
    this.spotifyApi.setAccessToken(accessToken);
    await this.spotifyApi.pause({ device_id: deviceId });
  }

  /**
   * Get user's available Spotify devices
   *
   * @param accessToken - User's Spotify access token
   * @returns Array of available devices
   */
  async getDevices(accessToken: string): Promise<any[]> {
    this.spotifyApi.setAccessToken(accessToken);
    const data = await this.spotifyApi.getMyDevices();
    return data.body.devices || [];
  }

  /**
   * Fisher-Yates shuffle algorithm for randomizing song order
   *
   * @param array - Array to shuffle
   * @returns Shuffled copy of array
   */
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const spotifyService = new SpotifyService();
