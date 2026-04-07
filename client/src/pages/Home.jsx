import { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Swords, Bot, Hash, ArrowRight, Zap, LogOut, Users, Shield, Wifi, ChevronDown, Mail, Lock, User, UserPlus, Trophy, TrendingUp, UserCheck, UserX, Clock, X, Search, Loader2, Gamepad2 } from 'lucide-react';
import TicTacToe3D from '../components/TicTacToe3D';
import DuelAnimation from '../components/DuelAnimation';
import SlideToGoogleAuth from '../components/SlideToGoogleAuth';
import PlayVsAIButton from '../components/PlayVsAIButton';

const FEATURES = [
    { icon: Wifi, title: "Real-time Sync", desc: "Instant move sync via WebSockets" },
    { icon: Bot, title: "AI Opponent", desc: "Minimax AI with 3 difficulty modes" },
    { icon: Users, title: "Play with Friends", desc: "Share a room code, play anywhere" },
    { icon: Shield, title: "Competitive", desc: "Stats, streaks, and rankings" },
];

const DIFFICULTY_OPTIONS = [
    { key: 'easy', label: 'Easy', desc: 'Random moves' },
    { key: 'medium', label: 'Medium', desc: 'Some strategy' },
    { key: 'hard', label: 'Hard', desc: 'Unbeatable AI' },
];

const Home = () => {
    const { user, login, logout } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket();
    const [authTab, setAuthTab] = useState('guest');
    const [guestName, setGuestName] = useState('');
    const [signupData, setSignupData] = useState({ username: '', email: '', password: '' });
    const [signinData, setSigninData] = useState({ email: '', password: '' });
    const [loadingMsg, setLoadingMsg] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');
    const [showSocial, setShowSocial] = useState(false);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [recentPlayers, setRecentPlayers] = useState([]);

    // Social Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchAbortRef = useRef(null);

    // Duel State
    const [isSearchingDuel, setIsSearchingDuel] = useState(false);
    const [showDuelAnimation, setShowDuelAnimation] = useState(false);
    const [onlineCount, setOnlineCount] = useState(0);

    const getStatusKeyword = () => {
        if (onlineCount >= 10) return "HOT";
        if (onlineCount >= 4) return "ACTIVE";
        if (onlineCount >= 2) return "READY";
        return "LIVE";
    };

    useEffect(() => {
        if (user && !user.isGuest) {
            loadSocialData();
        }
    }, [user?._id]);

    const loadSocialData = async () => {
        try {
            const [friendsRes, recentRes] = await Promise.all([
                api.get('/auth/friends'),
                api.get('/auth/recent-players'),
            ]);
            setFriends(friendsRes.data.friends || []);
            setFriendRequests(friendsRes.data.requests || []);
            setRecentPlayers(recentRes.data || []);
        } catch (e) { /* silent */ }
    };

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            // Cancel previous request
            if (searchAbortRef.current) searchAbortRef.current.abort();
            const controller = new AbortController();
            searchAbortRef.current = controller;

            setIsSearching(true);
            try {
                const res = await api.get(`/auth/search?q=${encodeURIComponent(searchQuery)}`, {
                    signal: controller.signal
                });
                setSearchResults(res.data);
            } catch (err) {
                if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
                    console.error(err);
                }
            }
            setIsSearching(false);
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    useEffect(() => {
        if (!socket) return;
        socket.on('matchFound', ({ roomId, mode }) => {
            setIsSearchingDuel(false);
            setShowDuelAnimation(true);
            setTimeout(() => {
                setShowDuelAnimation(false);
                navigate(`/game/${roomId}?mode=${mode}`);
            }, 2500);
        });

        socket.on('onlineCountUpdate', setOnlineCount);

        return () => {
            socket.off('matchFound');
            socket.off('onlineCountUpdate');
        };
    }, [socket, navigate]);

    const handleDuelQueue = () => {
        if (isSearchingDuel) {
            socket?.emit('cancelMatch');
            setIsSearchingDuel(false);
        } else {
            socket?.emit('findMatch');
            setIsSearchingDuel(true);
        }
    };

    const handleGuestLogin = async (e) => {
        e.preventDefault();
        setLoadingMsg('Connecting...');
        setError('');
        try {
            const { data } = await api.post('/auth/guest', { username: guestName || undefined });
            login(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Connection failed');
        }
        setLoadingMsg('');
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (!signupData.username || !signupData.email || !signupData.password) {
            setError('All fields are required');
            return;
        }
        setLoadingMsg('Creating account...');
        setError('');
        try {
            const { data } = await api.post('/auth/signup', signupData);
            login(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Signup failed');
        }
        setLoadingMsg('');
    };

    const handleSignin = async (e) => {
        e.preventDefault();
        if (!signinData.email || !signinData.password) {
            setError('Email and password required');
            return;
        }
        setLoadingMsg('Signing in...');
        setError('');
        try {
            const { data } = await api.post('/auth/login', signinData);
            login(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid credentials');
        }
        setLoadingMsg('');
    };

    const handleGoogleSuccess = async (tokenResponse) => {
        setLoadingMsg('Signing in with Google...');
        setError('');
        try {
            const { data } = await api.post('/auth/google', { accessToken: tokenResponse.access_token });
            login(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Google sign-in failed');
        }
        setLoadingMsg('');
    };

    const joinRoom = (mode, difficulty) => {
        if (mode === 'pve') {
            const roomId = `ai-${Date.now()}`;
            navigate(`/game/${roomId}?mode=pve&difficulty=${difficulty || 'hard'}`);
        } else {
            const roomId = `room-${Date.now()}`;
            navigate(`/game/${roomId}?mode=pvp`);
        }
    };

    const joinWithCode = (e) => {
        e.preventDefault();
        const code = roomCode.trim();
        if (!code) return;
        if (code.startsWith('ai-') || code.startsWith('ai_')) {
            setError('Cannot join AI rooms with a code');
            return;
        }
        setError('');
        navigate(`/game/${code}?mode=pvp`);
    };

    const sendFriendRequest = async (userId) => {
        try {
            await api.post('/auth/friends/request', { targetUserId: userId });
            loadSocialData();
        } catch (e) { /* silent */ }
    };

    const respondToRequest = async (requesterId, action) => {
        try {
            await api.post('/auth/friends/respond', { requesterId, action });
            loadSocialData();
        } catch (e) { /* silent */ }
    };

    const authTabs = [
        { key: 'guest', label: 'Quick Play' },
        { key: 'signin', label: 'Sign In' },
        { key: 'signup', label: 'Sign Up' },
    ];

    return (
        <div className="min-h-screen relative overflow-hidden">
            <DuelAnimation show={showDuelAnimation} />
            <div className="absolute inset-0 bg-surface-primary" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.06),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_60%,rgba(167,139,250,0.04),transparent)]" />
            <div className="absolute inset-0 opacity-[0.025]" style={{
                backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)',
                backgroundSize: '40px 40px'
            }} />

            <div className="relative min-h-screen flex flex-col">
                {/* Nav */}
                <nav className="relative z-30 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="XOGrid" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
                        <span className="text-base sm:text-lg font-display font-bold text-text-primary tracking-tight">XOGrid</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 sm:gap-4 flex-1">
                        {/* Desktop Room Code */}
                        <div className="relative group hidden sm:block">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-cyan/30 to-accent-violet/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                            <form onSubmit={joinWithCode} className="relative flex items-center">
                                <span className="absolute left-3 flex items-center justify-center text-accent-cyan z-10">
                                    <Hash className="w-3.5 h-3.5" />
                                </span>
                                <input type="text" placeholder="Enter Room Code" value={roomCode} onChange={(e) => { setRoomCode(e.target.value); setError(''); }}
                                    className="relative w-40 md:w-52 bg-surface-secondary/90 backdrop-blur-md border border-white/5 border-r-0 rounded-l-xl pl-9 pr-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/50 transition-all placeholder:text-text-muted font-mono h-9 shadow-sm" />
                                <button type="submit" className="relative cursor-pointer bg-gradient-to-r from-accent-cyan/10 to-accent-violet/10 border border-white/5 border-l-border-subtle hover:border-accent-cyan/30 rounded-r-xl px-4 py-1.5 text-sm font-semibold text-accent-cyan hover:text-white transition-all h-9 flex items-center shadow-sm">
                                    Join
                                </button>
                            </form>
                        </div>

                        {/* Mobile Room Code */}
                        <form onSubmit={joinWithCode} className="flex sm:hidden relative items-center">
                            <input type="text" placeholder="Room..." value={roomCode} onChange={(e) => { setRoomCode(e.target.value); setError(''); }}
                                className="w-20 bg-surface-secondary border border-border-subtle rounded-l-lg pl-2.5 pr-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan/30 transition placeholder:text-text-muted font-mono h-8" />
                            <button type="submit" className="cursor-pointer bg-surface-elevated border border-l-0 border-border-subtle hover:border-accent-cyan/30 rounded-r-lg px-2 py-1 text-xs font-semibold text-text-primary hover:text-accent-cyan transition-colors h-8 flex items-center">
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </form>

                        {user && (
                            <div className="flex items-center gap-2 sm:gap-3">
                                {!user.isGuest && (
                                    <button onClick={() => setShowSocial(!showSocial)} className="cursor-pointer flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-surface-secondary transition-all">
                                        <Users className="w-4 h-4" />
                                        {friendRequests.length > 0 && <span className="w-4 h-4 rounded-full bg-accent-rose text-[10px] text-white flex items-center justify-center font-bold">{friendRequests.length}</span>}
                                    </button>
                                )}
                                <img src={user.avatar} className="w-7 h-7 rounded-full ring-1 ring-white/10" alt="" />
                                <span className="text-sm text-text-secondary hidden sm:inline max-w-[100px] truncate">{user.username}</span>
                                <button onClick={logout} className="cursor-pointer text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-secondary transition-all">
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </nav>

                {/* Hero */}
                <div className="relative z-20 flex-1 flex items-center">
                    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="space-y-6 sm:space-y-8">
                            <div className="space-y-3 sm:space-y-4">
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-cyan/5 border border-accent-cyan/15 rounded-full text-accent-cyan text-xs font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                                    Real-time Multiplayer
                                </motion.div>

                                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-extrabold text-text-primary leading-[1.1] tracking-tight">
                                    Tic-Tac-Toe,<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-violet to-accent-rose">Reimagined.</span>
                                </h1>

                                <p className="text-text-secondary text-sm sm:text-lg max-w-md leading-relaxed">
                                    Challenge friends or AI in real-time. Lightning-fast gameplay, competitive scoring, and a sleek neon arena.
                                </p>
                            </div>

                            <AnimatePresence mode="wait">
                                {!user ? (
                                    <motion.div key="auth" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-sm space-y-4">
                                        <div className="flex bg-surface-secondary/50 rounded-xl p-1 gap-1 relative border border-white/5">
                                            {authTabs.map(tab => (
                                                <button
                                                    key={tab.key}
                                                    onClick={() => { setAuthTab(tab.key); setError(''); }}
                                                    className={`relative cursor-pointer flex-1 py-2 text-xs font-semibold rounded-lg transition-all z-10 ${authTab === tab.key ? 'text-text-primary text-shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                                                >
                                                    {authTab === tab.key && (
                                                        <motion.div
                                                            layoutId="activeAuthTab"
                                                            className="absolute inset-0 bg-surface-elevated rounded-lg shadow-sm border border-white/10"
                                                            initial={false}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                            style={{ zIndex: -1 }}
                                                        />
                                                    )}
                                                    <span className="relative z-10">{tab.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {authTab === 'guest' && (
                                                <motion.form key="guest" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onSubmit={handleGuestLogin} className="flex gap-2">
                                                    <input type="text" placeholder="Your alias..." value={guestName} onChange={(e) => setGuestName(e.target.value)}
                                                        className="flex-1 bg-surface-secondary border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all placeholder:text-text-muted font-medium" maxLength={12} />
                                                    <button type="submit" disabled={!!loadingMsg}
                                                        className="cursor-pointer disabled:cursor-not-allowed px-5 sm:px-6 py-3 bg-gradient-to-r from-accent-cyan to-cyan-500 text-surface-primary font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-cyan/20 active:scale-[0.97] text-sm whitespace-nowrap disabled:opacity-50 flex items-center gap-2">
                                                        <Zap className="w-4 h-4" />
                                                        {loadingMsg ? 'Wait...' : 'Play'}
                                                    </button>
                                                </motion.form>
                                            )}

                                            {authTab === 'signup' && (
                                                <motion.form key="signup" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onSubmit={handleSignup} className="space-y-3">
                                                    <div className="relative">
                                                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                        <input type="text" placeholder="Username" value={signupData.username} onChange={(e) => setSignupData(p => ({ ...p, username: e.target.value }))}
                                                            className="w-full bg-surface-secondary border border-border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all placeholder:text-text-muted" maxLength={20} />
                                                    </div>
                                                    <div className="relative">
                                                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                        <input type="email" placeholder="Email" value={signupData.email} onChange={(e) => setSignupData(p => ({ ...p, email: e.target.value }))}
                                                            className="w-full bg-surface-secondary border border-border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all placeholder:text-text-muted" />
                                                    </div>
                                                    <div className="relative">
                                                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                        <input type="password" placeholder="Password (min 6 chars)" value={signupData.password} onChange={(e) => setSignupData(p => ({ ...p, password: e.target.value }))}
                                                            className="w-full bg-surface-secondary border border-border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all placeholder:text-text-muted" />
                                                    </div>
                                                    <button type="submit" disabled={!!loadingMsg}
                                                        className="cursor-pointer disabled:cursor-not-allowed w-full py-3 bg-gradient-to-r from-accent-cyan to-cyan-500 text-surface-primary font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-cyan/20 active:scale-[0.97] text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                                        <UserPlus className="w-4 h-4" />
                                                        {loadingMsg || 'Create Account'}
                                                    </button>
                                                </motion.form>
                                            )}

                                            {authTab === 'signin' && (
                                                <motion.form key="signin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onSubmit={handleSignin} className="space-y-3">
                                                    <div className="relative">
                                                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                        <input type="email" placeholder="Email" value={signinData.email} onChange={(e) => setSigninData(p => ({ ...p, email: e.target.value }))}
                                                            className="w-full bg-surface-secondary border border-border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all placeholder:text-text-muted" />
                                                    </div>
                                                    <div className="relative">
                                                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                        <input type="password" placeholder="Password" value={signinData.password} onChange={(e) => setSigninData(p => ({ ...p, password: e.target.value }))}
                                                            className="w-full bg-surface-secondary border border-border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all placeholder:text-text-muted" />
                                                    </div>
                                                    <button type="submit" disabled={!!loadingMsg}
                                                        className="cursor-pointer disabled:cursor-not-allowed w-full py-3 bg-gradient-to-r from-accent-violet to-purple-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-violet/20 active:scale-[0.97] text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                                        <ArrowRight className="w-4 h-4" />
                                                        {loadingMsg || 'Sign In'}
                                                    </button>
                                                </motion.form>
                                            )}
                                        </AnimatePresence>

                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-px bg-border-subtle" />
                                            <span className="text-text-muted text-xs">or</span>
                                            <div className="flex-1 h-px bg-border-subtle" />
                                        </div>

                                        <div className="w-full flex justify-center mt-4">
                                            <SlideToGoogleAuth
                                                onLoginSuccess={handleGoogleSuccess}
                                                onLoginError={() => setError('Google sign-in failed/cancelled')}
                                                isLoading={!!loadingMsg}
                                            />
                                        </div>

                                        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-accent-rose text-sm">{error}</motion.p>}
                                    </motion.div>
                                ) : (
                                    <motion.div key="lobby" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-sm space-y-3">
                                        {/* Stats Bar */}
                                        {user.stats && (
                                            <div className="flex items-center gap-3 sm:gap-4 p-3 bg-surface-secondary/30 rounded-xl mb-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Trophy className="w-3.5 h-3.5 text-accent-emerald" />
                                                    <span className="text-xs text-text-secondary"><span className="text-accent-emerald font-bold">{user.stats.wins}</span>W</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-text-secondary"><span className="text-accent-rose font-bold">{user.stats.losses}</span>L</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-text-secondary"><span className="text-text-muted font-bold">{user.stats.draws}</span>D</span>
                                                </div>
                                                {user.currentStreak > 0 && (
                                                    <>
                                                        <div className="w-px h-4 bg-border-subtle" />
                                                        <div className="flex items-center gap-1.5">
                                                            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                                                            <span className="text-xs text-amber-400 font-bold">{user.currentStreak} streak</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Live Duel Button */}
                                        <button onClick={handleDuelQueue}
                                            className="relative overflow-hidden cursor-pointer group w-full flex items-center gap-3 sm:gap-4 p-4 bg-gradient-to-r from-accent-cyan/10 to-accent-violet/10 hover:from-accent-cyan/20 hover:to-accent-violet/20 border border-accent-cyan/30 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-cyan/10 active:scale-[0.98]">
                                            {isSearchingDuel && (
                                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.2),transparent)] -translate-x-[100%] animate-[shimmer_2s_infinite]" />
                                            )}
                                            <div className={`w-10 h-10 shrink-0 rounded-lg bg-accent-cyan/20 flex items-center justify-center transition-transform ${isSearchingDuel ? 'animate-pulse' : 'group-hover:scale-110'}`}>
                                                {isSearchingDuel ? <Loader2 className="w-5 h-5 text-accent-cyan animate-spin" /> : <Zap className="w-5 h-5 text-accent-cyan" />}
                                            </div>
                                            <div className="flex-1 text-left relative z-10 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-violet text-sm uppercase tracking-wide">
                                                        {isSearchingDuel ? 'Searching...' : 'Live Duel'}
                                                    </p>
                                                    {!isSearchingDuel && onlineCount > 0 && (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-accent-emerald/20 bg-accent-emerald/5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                                            <span className="text-[9px] font-bold text-accent-emerald tracking-wider">{getStatusKeyword()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-accent-cyan/70 text-xs">
                                                    {isSearchingDuel ? 'Tap to cancel' : 'Ranked Matchmaking'}
                                                </p>
                                            </div>
                                            {!isSearchingDuel && <ArrowRight className="w-4 h-4 shrink-0 text-accent-cyan group-hover:translate-x-0.5 transition-transform" />}
                                        </button>

                                        {/* Host Online */}
                                        <button onClick={() => joinRoom('pvp')}
                                            className="cursor-pointer group w-full flex items-center gap-3 sm:gap-4 p-4 bg-surface-secondary/50 hover:bg-surface-secondary border border-border-subtle hover:border-accent-rose/25 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-rose/5 active:scale-[0.98]">
                                            <div className="w-10 h-10 shrink-0 rounded-lg bg-accent-rose/10 flex items-center justify-center group-hover:bg-accent-rose/20 transition">
                                                <Swords className="w-5 h-5 text-accent-rose" />
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="font-semibold text-text-primary text-sm">Host Online Match</p>
                                                <p className="text-text-muted text-xs">Challenge a friend</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 shrink-0 text-text-muted group-hover:text-accent-rose group-hover:translate-x-0.5 transition-all" />
                                        </button>

                                        <PlayVsAIButton onSelectDifficulty={(difficulty) => joinRoom('pve', difficulty)} />

                                        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-accent-rose text-sm">{error}</motion.p>}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* 3D Hero Visual */}
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }} className="relative h-[350px] sm:h-[450px] lg:h-[520px] hidden sm:block">
                            <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" /></div>}>
                                <TicTacToe3D />
                            </Suspense>
                            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08)_0%,transparent_60%)]" />
                        </motion.div>
                    </div>
                </div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="relative z-20 pb-6 sm:pb-8 flex justify-center">
                    <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="text-text-muted">
                        <ChevronDown className="w-5 h-5" />
                    </motion.div>
                </motion.div>
            </div>

            {/* Social Panel */}
            <AnimatePresence>
                {showSocial && user && !user.isGuest && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSocial(false)}>
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-[#0f131f] border-t sm:border border-[#1b1f2c] rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] sm:max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1b1f2c]">
                                {/* Mobile drag handle */}
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[#1b1f2c] sm:hidden" />
                                <h3 className="text-text-primary font-display font-bold text-sm">Friends & Players</h3>
                                <button onClick={() => setShowSocial(false)} className="cursor-pointer p-1.5 rounded-lg hover:bg-[#1b1f2c] text-text-muted hover:text-text-primary transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="px-5 py-4 border-b border-[#1b1f2c]">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-[#171b28] border border-[#1b1f2c] rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 transition placeholder:text-text-muted"
                                    />
                                    {isSearching && <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />}
                                </div>
                            </div>

                            <div className="overflow-y-auto max-h-[65vh]">
                                {searchResults.length > 0 && searchQuery && (
                                    <div className="px-5 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-violet mb-3">Search Results</p>
                                        <div className="space-y-2">
                                            {searchResults.map(u => (
                                                <div key={u._id} className="flex items-center gap-3 p-3 bg-[#171b28] rounded-xl">
                                                    <img src={u.avatar} className="w-8 h-8 rounded-lg bg-[#1b1f2c]" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-text-primary font-medium truncate">{u.username}</p>
                                                        <p className="text-[10px] text-text-muted">Win/Loss: {u.stats?.wins || 0}/{u.stats?.losses || 0}</p>
                                                    </div>
                                                    {u.isFriend ? (
                                                        <span className="text-[10px] text-accent-emerald font-bold px-2 py-1 bg-accent-emerald/10 rounded-md">Friend</span>
                                                    ) : u.hasPendingRequest ? (
                                                        <span className="text-[10px] text-accent-rose font-bold px-2 py-1 bg-accent-rose/10 rounded-md">Pending</span>
                                                    ) : (
                                                        <button onClick={() => sendFriendRequest(u._id)} className="cursor-pointer p-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-all active:scale-90">
                                                            <UserPlus className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {friendRequests.length > 0 && (
                                    <div className="px-5 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-rose mb-3">Pending Requests</p>
                                        <div className="space-y-2">
                                            {friendRequests.map(req => (
                                                <div key={req._id} className="flex items-center gap-3 p-3 bg-[#171b28] rounded-xl">
                                                    <img src={req.avatar} className="w-8 h-8 rounded-lg bg-[#1b1f2c]" alt="" />
                                                    <span className="flex-1 text-sm text-text-primary font-medium truncate">{req.username}</span>
                                                    <button onClick={() => respondToRequest(req._id, 'accept')} className="cursor-pointer p-1.5 rounded-lg bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20 transition-all active:scale-90">
                                                        <UserCheck className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => respondToRequest(req._id, 'reject')} className="cursor-pointer p-1.5 rounded-lg bg-accent-rose/10 text-accent-rose hover:bg-accent-rose/20 transition-all active:scale-90">
                                                        <UserX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {friends.length > 0 && (
                                    <div className="px-5 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-cyan mb-3">Friends ({friends.length})</p>
                                        <div className="space-y-2">
                                            {friends.map(f => (
                                                <div key={f._id} className="flex items-center gap-3 p-3 bg-[#171b28] rounded-xl">
                                                    <img src={f.avatar} className="w-8 h-8 rounded-lg bg-[#1b1f2c]" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-text-primary font-medium truncate">{f.username}</p>
                                                        <p className="text-[10px] text-text-muted">{f.stats?.wins || 0}W · {f.stats?.losses || 0}L · Streak: {f.currentStreak || 0}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {recentPlayers.length > 0 && (
                                    <div className="px-5 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-3">Recent Players</p>
                                        <div className="space-y-2">
                                            {recentPlayers.map(p => (
                                                <div key={p._id} className="flex items-center gap-3 p-3 bg-[#171b28] rounded-xl">
                                                    <img src={p.avatar} className="w-8 h-8 rounded-lg bg-[#1b1f2c]" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-text-primary font-medium truncate">{p.username}</p>
                                                        <p className="text-[10px] text-text-muted">{p.stats?.wins || 0}W · {p.stats?.losses || 0}L</p>
                                                    </div>
                                                    {!p.isFriend && (
                                                        <button onClick={() => sendFriendRequest(p._id)} className="cursor-pointer p-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-all active:scale-90">
                                                            <UserPlus className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {p.isFriend && <span className="text-[10px] text-accent-emerald font-bold px-2 py-1 bg-accent-emerald/10 rounded-md">Friend</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {friends.length === 0 && recentPlayers.length === 0 && friendRequests.length === 0 && (
                                    <div className="px-5 py-12 text-center">
                                        <Users className="w-8 h-8 text-text-muted mx-auto mb-3" />
                                        <p className="text-text-muted text-sm">No friends or recent players yet</p>
                                        <p className="text-text-muted text-xs mt-1">Play some matches to see players here</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Features */}
            <div className="relative z-10 py-16 sm:py-20 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-14">
                        <p className="text-accent-violet text-xs font-semibold uppercase tracking-widest mb-3">Built for Competition</p>
                        <h2 className="text-2xl sm:text-4xl font-display font-bold text-text-primary">Not your average tic-tac-toe.</h2>
                    </motion.div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {FEATURES.map((f, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                className="glass rounded-2xl p-4 sm:p-6 hover:border-accent-cyan/20 transition-all group">
                                <div className="w-10 h-10 rounded-xl bg-accent-cyan/5 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-accent-cyan/10 transition">
                                    <f.icon className="w-5 h-5 text-accent-cyan" />
                                </div>
                                <h3 className="font-display font-semibold text-text-primary text-xs sm:text-sm mb-1">{f.title}</h3>
                                <p className="text-text-muted text-[10px] sm:text-xs leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 py-6 sm:py-8 px-4 sm:px-6 border-t border-border-subtle">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="XOGrid" className="w-4 h-4 object-contain opacity-50 grayscale" />
                        <span className="text-text-muted text-xs font-semibold">XOGrid</span>
                    </div>
                    <p className="text-text-muted text-xs">Built with ❤ for competitive gaming</p>
                </div>
            </div>
        </div>
    );
};

export default Home;
