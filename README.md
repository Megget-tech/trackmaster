# TrackMaster

A multiplayer music trivia game where players compete to identify songs and albums from a chosen artist.

## Quick Start

### Development
```bash
npm install
npm run dev
```

Access the app at: http://localhost:5555

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=your_postgresql_url
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5555/auth/spotify/callback
SESSION_SECRET=your_random_secret
PORT=5555
```

### Spotify Setup

1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Add redirect URI: `http://localhost:5555/auth/spotify/callback` (or your Replit URL)
4. Copy Client ID and Client Secret to `.env`

### Deployment on Replit

1. Set environment variables in Replit Secrets
2. Update `SPOTIFY_REDIRECT_URI` to your Replit URL + `/auth/spotify/callback`
3. Run the app

## Game Flow

1. **Master**: Connects Spotify → Creates game → Searches artist → Shows QR code
2. **Players**: Join via QR code or game code
3. **Gameplay**: 10 rounds, 60 seconds per song
   - Players type song name + album name
   - Fuzzy matching (80% similarity)
   - Speed-based scoring: 3/2/1 points for song, +1 for album
4. **Winner**: Player with most points after 10 songs

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Express, Socket.io, TypeScript
- **Database**: PostgreSQL (Neon)
- **APIs**: Spotify Web API, Spotify Web Playback SDK
- **Matching**: string-similarity (fuzzy matching)
