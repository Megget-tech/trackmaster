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
              <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent">
                TrackMaster
              </h1>
              <p className="mt-4 text-xl text-gray-300">
                Music Artist Trivia Game
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Guess song names and albums - compete with friends!
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-4">
              <button
                onClick={handleCreateGame}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg"
              >
                Create Game (Master)
              </button>

              <button
                onClick={handleJoinGame}
                className="w-full py-4 px-6 bg-white/10 border-2 border-white/20 rounded-xl font-semibold text-lg hover:bg-white/20 transition-all"
              >
                Join Game (Player)
              </button>
            </div>

            {/* Info */}
            <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
              <h3 className="font-semibold text-sm text-purple-300 mb-2">How to Play:</h3>
              <ul className="text-xs text-gray-400 space-y-1 text-left">
                <li>• Master selects an artist via Spotify</li>
                <li>• Players join via QR code or game code</li>
                <li>• 10 songs play, players guess song + album names</li>
                <li>• Speed matters: 1st = 3pts, 2nd = 2pts, 3rd+ = 1pt</li>
                <li>• Correct album = +1 bonus point</li>
                <li>• First to finish 10 rounds with highest score wins!</li>
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
