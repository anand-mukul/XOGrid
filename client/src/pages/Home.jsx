import { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import api from '../services/api';
import { Swords, Bot, Hash, ArrowRight, Zap, LogOut, Users, Shield, Wifi, ChevronDown, Mail, Lock, User, UserPlus, Trophy, TrendingUp, UserCheck, UserX, Clock, X } from 'lucide-react';
import TicTacToe3D from '../components/TicTacToe3D';

const FEATURES = [
    { icon: Wifi, title: "Real-time Sync", desc: "Instant move sync via WebSockets" },
    { icon: Bot, title: "AI Opponent", desc: "Minimax algorithm with 3 difficulty modes" },
    { icon: Users, title: "Play with Friends", desc: "Share a room code, play anywhere" },
    { icon: Shield, title: "Competitive", desc: "Stats, streaks, and leaderboards" },
];

const Home = () => {
    const { user, login, logout } = useAuth();
    const navigate = useNavigate();
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

    useEffect(() => {
        if (user && !user.isGuest) {
            loadSocialData();
        }
    }, [user]);

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

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoadingMsg('Signing in with Google...');
        setError('');
        try {
            const { data } = await api.post('/auth/google', { credential: credentialResponse.credential });
            login(data);
        } catch (err) {
            setError('Google sign-in failed');
        }
        setLoadingMsg('');
    };

    const joinRoom = (mode) => {
        const roomId = mode === 'pve' ? `ai-${Date.now()}` : `room-${Date.now()}`;
        navigate(`/game/${roomId}?mode=${mode}`);
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
        { key: 'guest', label: 'Guest' },
        { key: 'signin', label: 'Sign In' },
        { key: 'signup', label: 'Sign Up' },
    ];

    return (
        <div className="min-h-screen relative overflow-hidden">
            <div className="absolute inset-0 bg-surface-primary" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.06),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_60%,rgba(167,139,250,0.04),transparent)]" />
            <div className="absolute inset-0 opacity-[0.025]" style={{
                backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)',
                backgroundSize: '40px 40px'
            }} />

            <div className="relative min-h-screen flex flex-col">
                <nav className="relative z-30 flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="XOGrid" className="w-8 h-8 object-contain" />
                        <span className="text-lg font-display font-bold text-text-primary tracking-tight">XOGrid</span>
                    </div>
                    {user && (
                        <div className="flex items-center gap-3">
                            {!user.isGuest && (
                                <button onClick={() => setShowSocial(!showSocial)} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-surface-secondary transition-all">
                                    <Users className="w-4 h-4" />
                                    {friendRequests.length > 0 && <span className="w-4 h-4 rounded-full bg-accent-rose text-[10px] text-white flex items-center justify-center font-bold">{friendRequests.length}</span>}
                                </button>
                            )}
                            <img src={user.avatar} className="w-7 h-7 rounded-full ring-1 ring-white/10" alt="" />
                            <span className="text-sm text-text-secondary hidden sm:inline">{user.username}</span>
                            <button onClick={logout} className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-secondary transition-all">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </nav>

                <div className="relative z-20 flex-1 flex items-center">
                    <div className="w-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="space-y-8">
                            <div className="space-y-4">
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-cyan/5 border border-accent-cyan/15 rounded-full text-accent-cyan text-xs font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                                    Real-time Multiplayer
                                </motion.div>

                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-text-primary leading-[1.1] tracking-tight">
                                    Tic-Tac-Toe,<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-violet to-accent-rose">Reimagined.</span>
                                </h1>

                                <p className="text-text-secondary text-base sm:text-lg max-w-md leading-relaxed">
                                    Challenge friends or AI in real-time. Lightning-fast WebSocket gameplay, competitive scoring, and a sleek neon arena.
                                </p>
                            </div>

                            <AnimatePresence mode="wait">
                                {!user ? (
                                    <motion.div key="auth" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-sm space-y-4">
                                        <div className="flex bg-surface-secondary/50 rounded-xl p-1 gap-1">
                                            {authTabs.map(tab => (
                                                <button
                                                    key={tab.key}
                                                    onClick={() => { setAuthTab(tab.key); setError(''); }}
                                                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authTab === tab.key ? 'bg-surface-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {authTab === 'guest' && (
                                                <motion.form key="guest" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onSubmit={handleGuestLogin} className="flex gap-2">
                                                    <input type="text" placeholder="Your alias..." value={guestName} onChange={(e) => setGuestName(e.target.value)}
                                                        className="flex-1 bg-surface-secondary border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all placeholder:text-text-muted font-medium" maxLength={12} />
                                                    <button type="submit" disabled={!!loadingMsg}
                                                        className="px-6 py-3 bg-gradient-to-r from-accent-cyan to-cyan-500 text-surface-primary font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-cyan/20 active:scale-[0.97] text-sm whitespace-nowrap disabled:opacity-50 flex items-center gap-2">
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
                                                        className="w-full py-3 bg-gradient-to-r from-accent-cyan to-cyan-500 text-surface-primary font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-cyan/20 active:scale-[0.97] text-sm disabled:opacity-50 flex items-center justify-center gap-2">
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
                                                        className="w-full py-3 bg-gradient-to-r from-accent-violet to-purple-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-violet/20 active:scale-[0.97] text-sm disabled:opacity-50 flex items-center justify-center gap-2">
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

                                        <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed')} theme="filled_black" size="large" text="continue_with" shape="pill" />

                                        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-accent-rose text-sm">{error}</motion.p>}
                                    </motion.div>
                                ) : (
                                    <motion.div key="lobby" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-sm space-y-3">
                                        {user.stats && (
                                            <div className="flex items-center gap-4 p-3 bg-surface-secondary/30 rounded-xl mb-1">
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

                                        <button onClick={() => joinRoom('pvp')}
                                            className="group w-full flex items-center gap-4 p-4 bg-surface-secondary/50 hover:bg-surface-secondary border border-border-subtle hover:border-accent-rose/25 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-rose/5">
                                            <div className="w-10 h-10 rounded-lg bg-accent-rose/10 flex items-center justify-center group-hover:bg-accent-rose/20 transition">
                                                <Swords className="w-5 h-5 text-accent-rose" />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-semibold text-text-primary text-sm">Host Online Match</p>
                                                <p className="text-text-muted text-xs">Challenge a friend</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-rose group-hover:translate-x-0.5 transition-all" />
                                        </button>

                                        <button onClick={() => joinRoom('pve')}
                                            className="group w-full flex items-center gap-4 p-4 bg-surface-secondary/50 hover:bg-surface-secondary border border-border-subtle hover:border-accent-emerald/25 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-emerald/5">
                                            <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center group-hover:bg-accent-emerald/20 transition">
                                                <Bot className="w-5 h-5 text-accent-emerald" />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-semibold text-text-primary text-sm">Play vs AI</p>
                                                <p className="text-text-muted text-xs">Test your skills</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-emerald group-hover:translate-x-0.5 transition-all" />
                                        </button>

                                        <form onSubmit={joinWithCode} className="flex gap-2 pt-2">
                                            <input type="text" placeholder="Room code ..." value={roomCode} onChange={(e) => { setRoomCode(e.target.value); setError(''); }}
                                                className="flex-1 bg-surface-secondary border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/30 transition placeholder:text-text-muted font-mono" />
                                            <button type="submit" className="px-4 bg-surface-secondary hover:bg-surface-elevated text-sm text-text-primary rounded-lg font-medium border border-border-subtle hover:border-accent-cyan/25 transition-all">Join</button>
                                        </form>
                                        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-accent-rose text-sm">{error}</motion.p>}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }} className="relative h-[350px] sm:h-[450px] lg:h-[520px] hidden sm:block">
                            <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" /></div>}>
                                <TicTacToe3D />
                            </Suspense>
                            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08)_0%,transparent_60%)]" />
                        </motion.div>
                    </div>
                </div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="relative z-20 pb-8 flex justify-center">
                    <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="text-text-muted">
                        <ChevronDown className="w-5 h-5" />
                    </motion.div>
                </motion.div>
            </div>

            {/* Social Panel */}
            <AnimatePresence>
                {showSocial && user && !user.isGuest && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSocial(false)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0f131f] border border-[#1b1f2c] rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1b1f2c]">
                                <h3 className="text-text-primary font-display font-bold text-sm">Friends & Players</h3>
                                <button onClick={() => setShowSocial(false)} className="p-1.5 rounded-lg hover:bg-[#1b1f2c] text-text-muted hover:text-text-primary transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="overflow-y-auto max-h-[65vh]">
                                {friendRequests.length > 0 && (
                                    <div className="px-5 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-rose mb-3">Pending Requests</p>
                                        <div className="space-y-2">
                                            {friendRequests.map(req => (
                                                <div key={req._id} className="flex items-center gap-3 p-3 bg-[#171b28] rounded-xl">
                                                    <img src={req.avatar} className="w-8 h-8 rounded-lg bg-[#1b1f2c]" alt="" />
                                                    <span className="flex-1 text-sm text-text-primary font-medium truncate">{req.username}</span>
                                                    <button onClick={() => respondToRequest(req._id, 'accept')} className="p-1.5 rounded-lg bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20 transition-all">
                                                        <UserCheck className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => respondToRequest(req._id, 'reject')} className="p-1.5 rounded-lg bg-accent-rose/10 text-accent-rose hover:bg-accent-rose/20 transition-all">
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
                                                        <button onClick={() => sendFriendRequest(p._id)} className="p-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-all">
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
            <div className="relative z-10 py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
                        <p className="text-accent-violet text-xs font-semibold uppercase tracking-widest mb-3">Built for Competition</p>
                        <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-primary">Not your average tic-tac-toe.</h2>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {FEATURES.map((f, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                className="glass rounded-2xl p-6 hover:border-accent-cyan/20 transition-all group">
                                <div className="w-10 h-10 rounded-xl bg-accent-cyan/5 flex items-center justify-center mb-4 group-hover:bg-accent-cyan/10 transition">
                                    <f.icon className="w-5 h-5 text-accent-cyan" />
                                </div>
                                <h3 className="font-display font-semibold text-text-primary text-sm mb-1">{f.title}</h3>
                                <p className="text-text-muted text-xs leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="relative z-10 py-8 px-6 border-t border-border-subtle">
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
