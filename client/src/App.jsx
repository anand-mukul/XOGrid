import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Game from './pages/Game';

const Loader = () => (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary">
        <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
            <span className="text-text-secondary text-sm font-medium tracking-wide">Loading...</span>
        </div>
    </div>
);

function App() {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
              path="/game/:roomId" 
              element={user ? <Game /> : <Navigate to="/" />} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
