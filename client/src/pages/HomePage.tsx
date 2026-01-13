import { Route, useLocation } from 'wouter';
import MasterPage from './MasterPage';
import PlayerPage from './PlayerPage';

/**
 * HomePage - Main routing component
 *
 * Routes:
 * - / - Landing page with "Create Game" and "Join Game" buttons
 * - /master - Master device page (game orchestration)
 * - /player/:gameCode - Player device page (answer submission)
 */
export default function HomePage() {
  const [location, setLocation] = useLocation();

  const handleCreateGame = () => {
    setLocation('/master');
  };

  const handleJoinGame = () => {
    const gameCode = prompt('Enter game code:');
    if (gameCode) {
      setLocation(`/player/${gameCode.toUpperCase()}`);
    }
  };

  return (
    <>
      <Route path="/">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-8 text-center">
            {/* Logo */}
            <div>
              <h1 className="text-6xl font-bold bg-gradient-to-r from-cyber-cyan via-cyber-magenta to-cyber-purple bg-clip-text text-transparent glow-cyan-text animate-neon-pulse tracking-wider">
                TRACKMASTER
              </h1>
              <p className="mt-4 text-xl text-cyber-cyan/80 font-mono tracking-wider">
                &gt; MUSIC ARTIST TRIVIA GAME_
              </p>
              <p className="mt-2 text-sm text-cyber-cyan/50 font-mono">
                [ GUESS SONGS • COMPETE • DOMINATE ]
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-4">
              <button
                onClick={handleCreateGame}
                className="w-full py-4 px-6 bg-gradient-to-r from-cyber-cyan to-cyber-magenta rounded-xl font-semibold text-lg font-mono hover:from-cyber-magenta hover:to-cyber-purple transition-all transform hover:scale-105 shadow-lg neon-border-cyan hover:glow-cyan relative overflow-hidden group"
              >
                <span className="relative z-10">CREATE GAME [MASTER]</span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 blur-xl group-hover:blur-2xl transition-all" />
              </button>

              <button
                onClick={handleJoinGame}
                className="w-full py-4 px-6 bg-dark-space/50 border-2 neon-border-cyan rounded-xl font-semibold text-lg font-mono hover:bg-dark-space/80 transition-all hover:glow-cyan text-cyber-cyan"
              >
                JOIN GAME [PLAYER]
              </button>
            </div>

            {/* Info */}
            <div className="mt-8 p-4 holo-card rounded-lg neon-border-cyan">
              <h3 className="font-semibold text-sm text-cyber-cyan mb-2 flex items-center justify-center gap-2">
                <span className="animate-pulse">◆</span> HOW TO PLAY:
              </h3>
              <ul className="text-xs text-cyber-cyan/70 space-y-1 text-left font-mono">
                <li>&gt; Master selects artist via Spotify</li>
                <li>&gt; Players join via QR code or game code</li>
                <li>&gt; 10 songs play, guess song + album names</li>
                <li>&gt; Speed matters: 1st = 3pts, 2nd = 2pts, 3rd+ = 1pt</li>
                <li>&gt; Correct album = +1 bonus point</li>
                <li>&gt; Highest score wins!</li>
              </ul>
            </div>
          </div>
        </div>
      </Route>

      <Route path="/master">
        <MasterPage />
      </Route>

      <Route path="/player/:gameCode">
        {(params) => <PlayerPage gameCode={params.gameCode} />}
      </Route>
    </>
  );
}
