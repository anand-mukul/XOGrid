import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from './context/AuthContext';
import { Component, Suspense, lazy } from 'react';

// Lazy load pages for better initial bundle
const Home = lazy(() => import('./pages/Home'));
const Game = lazy(() => import('./pages/Game'));

const Loader = () => (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary">
        <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
            <span className="text-text-secondary text-sm font-medium tracking-wide">Loading...</span>
        </div>
    </div>
);

// FEAT-008: Error Boundary to prevent white screen crashes
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-surface-primary p-6">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-rose/10 flex items-center justify-center">
                            <span className="text-3xl">💥</span>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-display font-bold text-text-primary">Something went wrong</h2>
                            <p className="text-text-secondary text-sm">
                                An unexpected error occurred. Please refresh the page.
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="cursor-pointer px-6 py-3 bg-gradient-to-r from-accent-cyan to-cyan-500 text-surface-primary font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-cyan/20 active:scale-[0.97] text-sm"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

function App() {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <Router>
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route 
                  path="/game/:roomId" 
                  element={user ? <Game /> : <Navigate to="/" />} 
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Router>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
