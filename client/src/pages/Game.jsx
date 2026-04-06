import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, Copy, Check, Flame, Zap, Star, Heart, Bot, RotateCcw, MessageCircle, ChevronUp, Hash, Trophy, TrendingUp, Share2 } from 'lucide-react';
import clsx from 'clsx';
import confetti from 'canvas-confetti';

const TAUNTS = ["GG EZ 😎", "Nice move!", "Oops...", "You're toast 🍞", "Big brain 🧠", "Rematch me!"];

const XMark = ({ className }) => (
    <svg viewBox="0 0 64 64" className={className} fill="none" strokeLinecap="round" strokeWidth="5">
        <motion.line x1="16" y1="16" x2="48" y2="48" stroke="currentColor" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: "easeOut" }} />
        <motion.line x1="48" y1="16" x2="16" y2="48" stroke="currentColor" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }} />
    </svg>
);

const OMark = ({ className }) => (
    <svg viewBox="0 0 64 64" className={className} fill="none" strokeLinecap="round" strokeWidth="5">
        <motion.circle cx="32" cy="32" r="18" stroke="currentColor" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} />
    </svg>
);

const REACTION_BUTTONS = [
    { emoji: '🔥', Icon: Flame, color: 'text-orange-400 hover:text-orange-300' },
    { emoji: '⚡', Icon: Zap, color: 'text-amber-400 hover:text-amber-300' },
    { emoji: '⭐', Icon: Star, color: 'text-yellow-300 hover:text-yellow-200' },
    { emoji: '❤️', Icon: Heart, color: 'text-rose-400 hover:text-rose-300' },
];

const TIMER_DURATION = 30;

const Game = () => {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode') || 'pvp';
    const difficulty = searchParams.get('difficulty') || 'hard';
    const isPVE = mode === 'pve';

    const socket = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();
    const chatEndRef = useRef(null);

    const [gameState, setGameState] = useState(null);
    const [chat, setChat] = useState([]);
    const [msgInput, setMsgInput] = useState('');
    const [reactions, setReactions] = useState([]);
    const [copied, setCopied] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [sessionScore, setSessionScore] = useState({ wins: 0, losses: 0, draws: 0 });
    const [timerValue, setTimerValue] = useState(100);
    const timerRef = useRef(null);
    const [showTaunts, setShowTaunts] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [reactionCooldown, setReactionCooldown] = useState(false);
    const [rematchPending, setRematchPending] = useState(false);

    // BUG-004: Null guard
    const userId = user?._id;
    const username = user?.username;
    const userAvatar = user?.avatar;

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat]);

    // LOGIC-006 fix: Timer now relies on server authority. Client timer is purely visual.
    useEffect(() => {
        if (gameState?.status === 'playing') {
            setTimerValue(100);
            if (timerRef.current) clearInterval(timerRef.current);

            const step = 100 / (TIMER_DURATION * (1000 / 150));
            timerRef.current = setInterval(() => {
                setTimerValue(prev => {
                    const next = prev - step;
                    // LOGIC-006 fix: Never emit timerExpired — server handles it now
                    return Math.max(0, next);
                });
            }, 150);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [gameState?.turn, gameState?.status]);

    const fireConfetti = useCallback(() => {
        const duration = 2000;
        const end = Date.now() + duration;
        const colors = ['#22d3ee', '#a78bfa', '#fb7185', '#34d399'];

        (function frame() {
            confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
            confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    }, []);

    useEffect(() => {
        if (!socket || !userId) return;

        socket.emit('joinRoom', { roomId, mode, difficulty });

        const handleGameState = (state) => {
            setGameState(prev => {
                if (prev && prev.status === 'playing' && (state.status === 'ended' || state.status === 'abandoned')) {
                    const myPlayer = state.players.find(p => p.id === userId);
                    if (state.status === 'abandoned') {
                        setLastResult('win');
                        setSessionScore(s => ({ ...s, wins: s.wins + 1 }));
                        setTimeout(fireConfetti, 300);
                    } else if (state.winner === 'Tie') {
                        setLastResult('draw');
                        setSessionScore(s => ({ ...s, draws: s.draws + 1 }));
                    } else if (myPlayer && state.winner === myPlayer.symbol) {
                        setLastResult('win');
                        setSessionScore(s => ({ ...s, wins: s.wins + 1 }));
                        setTimeout(fireConfetti, 300);
                    } else {
                        setLastResult('loss');
                        setSessionScore(s => ({ ...s, losses: s.losses + 1 }));
                    }
                }
                // If new game starts (rematch), clear last result
                if (prev && (prev.status === 'ended' || prev.status === 'abandoned') && state.status === 'playing') {
                    setLastResult(null);
                    setRematchPending(false);
                }
                return state;
            });
            setChat(state.chatMessages || []);
        };

        const handleChatMessage = (msg) => {
            setChat(prev => [...prev, msg]);
        };

        const handleReaction = (data) => {
            const reaction = { id: `${Date.now()}_${Math.random()}`, ...data };
            setReactions(prev => [...prev, reaction]);
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== reaction.id));
            }, 2500);
        };

        const handleRematchRequested = ({ username: requester }) => {
            setRematchPending(true);
        };

        socket.on('gameState', handleGameState);
        socket.on('chatMessage', handleChatMessage);
        socket.on('reaction', handleReaction);
        socket.on('rematchRequested', handleRematchRequested);

        return () => {
            socket.off('gameState', handleGameState);
            socket.off('chatMessage', handleChatMessage);
            socket.off('reaction', handleReaction);
            socket.off('rematchRequested', handleRematchRequested);
        };
    }, [socket, roomId, mode, difficulty, userId, fireConfetti]);

    const handleMove = (index) => {
        if (!gameState || gameState.status !== 'playing') return;
        const myPlayer = gameState.players.find(p => p.id === userId);
        if (!myPlayer || myPlayer.symbol !== gameState.turn) return;
        if (gameState.board[index] !== null) return;
        socket.emit('playMove', { index });
    };

    const handleRematch = () => {
        setLastResult(null);
        setRematchPending(true);
        socket.emit('rematch', { roomId });
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (msgInput.trim()) {
            socket.emit('chatMessage', msgInput.trim());
            setMsgInput('');
        }
    };

    const sendTaunt = (msg) => {
        socket.emit('chatMessage', msg);
        setShowTaunts(false);
    };

    const sendReaction = (emoji) => {
        if (reactionCooldown) return;
        setReactionCooldown(true);
        socket.emit('sendReaction', emoji);
        setTimeout(() => setReactionCooldown(false), 800);
    };

    const copyInvite = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareInvite = async () => {
        const url = `${window.location.origin}/game/${roomId}?mode=${mode}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my XOGrid Game!',
                    text: `Join my room and play Tic-Tac-Toe with me! Room code: ${roomId}`,
                    url: url
                });
            } catch (err) {
                console.log('Share failed or was cancelled');
            }
        } else {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // BUG-004: Guard against null user
    if (!user) {
        navigate('/');
        return null;
    }

    if (!gameState) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                    <span className="text-text-secondary text-sm font-medium">Finding your game...</span>
                </div>
            </div>
        );
    }

    const myPlayerInfo = gameState.players.find(p => p.id === userId);
    const opponentInfo = gameState.players.find(p => p.id !== userId);
    const isMyTurn = myPlayerInfo && gameState.turn === myPlayerInfo.symbol;
    const timerSeconds = Math.ceil((timerValue / 100) * TIMER_DURATION);

    return (
        <div className="min-h-screen bg-[#0a0e1a] flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.012]" style={{
                backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                backgroundSize: '32px 32px'
            }} />

            <AnimatePresence>
                {reactions.map((r) => (
                    <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 40, scale: 0.6 }}
                        animate={{ opacity: 1, y: -100, scale: 1.1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="fixed z-50 pointer-events-none flex flex-col items-center"
                        style={{ left: `${20 + Math.random() * 60}%`, bottom: '20%' }}
                    >
                        <span className="text-[10px] text-text-muted bg-[#171b28]/90 backdrop-blur px-2 py-0.5 rounded-full mb-1">{r.username}</span>
                        {r.emoji === '🔥' && <Flame className="w-7 h-7 text-orange-400" />}
                        {r.emoji === '⚡' && <Zap className="w-7 h-7 text-amber-400" />}
                        {r.emoji === '⭐' && <Star className="w-7 h-7 text-yellow-300" />}
                        {r.emoji === '❤️' && <Heart className="w-7 h-7 text-rose-400 fill-rose-400" />}
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Top Bar */}
            <div className="relative z-20 flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-[#0f131f]/90 backdrop-blur-xl">
                <button onClick={() => { socket?.emit('leaveRoom'); navigate('/'); }} className="cursor-pointer flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-[#1b1f2c] transition-all text-sm active:scale-95">
                    <ArrowLeft className="w-4 h-4" />
                    <div className="hidden sm:flex items-center gap-1.5">
                        <img src="/logo.png" alt="XOGrid" className="w-4 h-4 object-contain" />
                        <span className="font-semibold text-text-primary text-xs">XOGrid</span>
                    </div>
                </button>

                <div className="flex items-center gap-3 sm:gap-5">
                    <div className="flex items-center gap-1 text-sm font-mono">
                        <span className="text-accent-emerald font-bold">{sessionScore.wins}</span>
                        <span className="text-text-muted text-[10px]">W</span>
                    </div>
                    <div className="w-px h-4 bg-[#313442]" />
                    <div className="flex items-center gap-1 text-sm font-mono">
                        <span className="text-accent-rose font-bold">{sessionScore.losses}</span>
                        <span className="text-text-muted text-[10px]">L</span>
                    </div>
                    <div className="w-px h-4 bg-[#313442]" />
                    <div className="flex items-center gap-1 text-sm font-mono">
                        <span className="text-text-secondary font-bold">{sessionScore.draws}</span>
                        <span className="text-text-muted text-[10px]">D</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                    {!isPVE && (
                        <button onClick={() => setShowChat(!showChat)} className="cursor-pointer sm:hidden p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-[#1b1f2c] transition-all relative active:scale-90">
                            <MessageCircle className="w-4 h-4" />
                        </button>
                    )}
                    {!isPVE && (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <button onClick={shareInvite} className="sm:hidden cursor-pointer flex items-center justify-center w-8 h-8 rounded-xl text-text-muted hover:text-text-primary bg-[#171b28] hover:bg-[#1b1f2c] transition-all active:scale-90">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <div className="hidden sm:flex items-center gap-2">
                                <button onClick={copyInvite} className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl text-text-muted hover:text-text-primary bg-[#171b28] hover:bg-[#1b1f2c] transition-all text-xs font-mono">
                                    {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span className="max-w-[100px] truncate">{roomId}</span>
                                </button>
                                <button onClick={shareInvite} className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan hover:text-accent-cyan transition-all text-xs font-semibold">
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>Share</span>
                                </button>
                            </div>
                        </div>
                    )}
                    {isPVE && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-emerald/10 text-accent-emerald text-xs font-semibold">
                            <Bot className="w-3.5 h-3.5" />
                            AI · {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-2 sm:p-4 lg:p-8 relative z-10 w-full">
                <div className={clsx(
                    "w-full flex flex-col lg:flex-row items-center lg:items-center lg:justify-center gap-4 sm:gap-6 lg:gap-12 xl:gap-20",
                    isPVE ? "max-w-3xl" : "max-w-7xl"
                )}>

                    {/* Left: Players */}
                    <div className={clsx("shrink-0 w-full lg:w-64 xl:w-72 flex flex-col gap-3 sm:gap-4", isPVE ? "lg:w-56 xl:w-64" : "")}>
                        <div className="bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl shadow-black/20 border border-white/[0.02]">
                            <div className={clsx("flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 transition-all duration-300 relative", isMyTurn && "bg-accent-cyan/[0.04]")}>
                                {isMyTurn && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent-cyan shadow-[0_0_8px_rgba(34,211,238,0.4)]" />}
                                <img src={userAvatar} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b1f2c]" alt="" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-text-primary text-sm truncate">{username}</p>
                                    <p className={clsx("text-xs font-mono font-bold", myPlayerInfo?.symbol === 'X' ? "text-accent-cyan" : "text-accent-rose")}>{myPlayerInfo?.symbol || '...'}</p>
                                </div>
                                {isMyTurn && <span className="text-[9px] font-bold uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded-md">Turn</span>}
                            </div>

                            <div className="px-4"><div className="h-px bg-[#1b1f2c]" /></div>

                            <div className={clsx("flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 transition-all duration-300 relative", !isMyTurn && gameState.status === 'playing' && "bg-accent-rose/[0.04]")}>
                                {!isMyTurn && gameState.status === 'playing' && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent-rose shadow-[0_0_8px_rgba(251,113,133,0.4)]" />}
                                {opponentInfo ? (
                                    <>
                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b1f2c] flex items-center justify-center shrink-0">
                                            {opponentInfo.id === 'AI' ? (
                                                <Bot className="w-5 h-5 text-accent-emerald" />
                                            ) : opponentInfo.emoji?.startsWith('http') ? (
                                                <img src={opponentInfo.emoji} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl" alt="" />
                                            ) : (
                                                <Bot className="w-5 h-5 text-accent-emerald" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-text-primary text-sm truncate">{opponentInfo.username}</p>
                                            <p className={clsx("text-xs font-mono font-bold", opponentInfo.symbol === 'X' ? "text-accent-cyan" : "text-accent-rose")}>{opponentInfo.symbol}</p>
                                        </div>
                                        {!isMyTurn && gameState.status === 'playing' && <span className="text-[9px] font-bold uppercase tracking-wider text-accent-rose bg-accent-rose/10 px-2 py-1 rounded-md">Turn</span>}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b1f2c] animate-pulse" />
                                        <span className="text-text-muted text-sm">Waiting...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isPVE && (
                            <div className="bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl p-2.5 sm:p-3 flex items-center justify-around shadow-lg border border-white/[0.02]">
                                {REACTION_BUTTONS.map(({ emoji, Icon, color }) => (
                                    <button
                                        key={emoji}
                                        onClick={() => sendReaction(emoji)}
                                        disabled={reactionCooldown}
                                        className={clsx(
                                            "cursor-pointer p-2 sm:p-2.5 rounded-xl transition-all active:scale-75",
                                            reactionCooldown ? "opacity-40 cursor-not-allowed" : "hover:bg-[#1b1f2c] hover:scale-110",
                                            color
                                        )}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {isPVE && user.currentStreak > 0 && (
                            <div className="bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl p-3 flex items-center gap-3">
                                <TrendingUp className="w-4 h-4 text-accent-emerald" />
                                <span className="text-xs text-text-secondary"><span className="text-accent-emerald font-bold">{user.currentStreak}</span> win streak</span>
                            </div>
                        )}
                    </div>

                    {/* Center: Board */}
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[440px]">
                        <div className="mb-4 sm:mb-5 text-center w-full max-w-xs h-20 flex flex-col justify-end">
                            {gameState.status === 'playing' ? (
                                <div>
                                    <motion.p key={gameState.turn} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-2">
                                        Current Phase
                                    </motion.p>
                                    <div className="flex items-center justify-center gap-3 mb-3">
                                        <motion.p key={`name-${gameState.turn}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={clsx("text-lg font-display font-bold", isMyTurn ? "text-accent-cyan" : "text-accent-rose")}>
                                            {isMyTurn ? "Your Turn" : `${opponentInfo?.username || 'Opponent'}'s Turn`}
                                        </motion.p>
                                        {isMyTurn && (
                                            <span className={clsx("text-sm font-mono font-bold tabular-nums", timerSeconds <= 5 ? "text-accent-rose animate-pulse" : "text-text-muted")}>
                                                {timerSeconds}s
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-[#1b1f2c] overflow-hidden">
                                        <motion.div
                                            className={clsx("h-full rounded-full transition-colors",
                                                timerValue > 30 ? (isMyTurn ? "bg-accent-cyan" : "bg-accent-rose") :
                                                timerValue > 10 ? "bg-amber-400" : "bg-red-500"
                                            )}
                                            style={{ width: `${timerValue}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (gameState.status === 'ended' || gameState.status === 'abandoned') ? (
                                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pb-2">
                                    <p className={clsx("text-2xl font-display font-bold",
                                        lastResult === 'win' ? "text-accent-emerald" :
                                        lastResult === 'loss' ? "text-accent-rose" : "text-text-secondary"
                                    )}>
                                        {lastResult === 'win' && (gameState.status === 'abandoned' ? '🎉 Opponent Left! You Win!' : '🎉 You Win!')}
                                        {lastResult === 'loss' && 'You Lost'}
                                        {lastResult === 'draw' && "It's a Draw"}
                                        {!lastResult && (gameState.status === 'abandoned' ? "Opponent Left!" : (gameState.winner === 'Tie' ? "Draw!" : `${gameState.winner} Wins!`))}
                                    </p>
                                </motion.div>
                            ) : null}
                        </div>

                        <div className="relative">
                            <div className="bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl p-3 sm:p-6 shadow-2xl shadow-black/40 border border-white/[0.02]">
                                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                                    {gameState.board.map((cell, idx) => (
                                        <motion.button
                                            key={idx}
                                            whileHover={!cell && gameState.status === 'playing' && isMyTurn ? { scale: 1.04 } : {}}
                                            whileTap={!cell && gameState.status === 'playing' && isMyTurn ? { scale: 0.96 } : {}}
                                            onClick={() => handleMove(idx)}
                                            disabled={gameState.status !== 'playing' || cell !== null || !isMyTurn}
                                            className={clsx(
                                                "w-[5.5rem] h-[5.5rem] sm:w-28 sm:h-28 rounded-xl flex items-center justify-center transition-all duration-200",
                                                !cell && isMyTurn && gameState.status === 'playing'
                                                    ? "bg-[#171b28]/60 hover:bg-[#1b1f2c] cursor-pointer"
                                                    : "bg-[#171b28]/40",
                                                !cell && !isMyTurn && "cursor-default",
                                                cell && "cursor-default"
                                            )}
                                        >
                                            <AnimatePresence mode="wait">
                                                {cell === 'X' && (
                                                    <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} className="w-11 h-11 sm:w-14 sm:h-14 text-accent-cyan drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]">
                                                        <XMark className="w-full h-full" />
                                                    </motion.div>
                                                )}
                                                {cell === 'O' && (
                                                    <motion.div initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} className="w-11 h-11 sm:w-14 sm:h-14 text-accent-rose drop-shadow-[0_0_12px_rgba(251,113,133,0.3)]">
                                                        <OMark className="w-full h-full" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            <AnimatePresence>
                                {gameState.status === 'waiting' && (
                                    <motion.div 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-[-10px] sm:inset-[-20px] rounded-[2rem] bg-[#0f131f]/70 backdrop-blur-md z-20 flex flex-col items-center justify-center pointer-events-none"
                                    >
                                        <div className="bg-[#0f131f]/90 border border-accent-cyan/20 p-5 rounded-2xl space-y-4 text-center shadow-xl shadow-cyan-900/20 pointer-events-auto w-[90%] max-w-[280px]">
                                            <div className="mx-auto w-12 h-12 bg-accent-cyan/10 rounded-full flex items-center justify-center mb-2">
                                                <div className="w-6 h-6 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                                            </div>
                                            <div>
                                                <p className="text-base font-display font-semibold text-text-primary">Waiting for opponent</p>
                                                <p className="text-xs text-text-muted mt-1 leading-relaxed">Share this room code to invite a friend</p>
                                            </div>
                                            <button onClick={shareInvite} className="cursor-pointer w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-accent-cyan to-cyan-500 text-surface-primary font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-accent-cyan/20 active:scale-[0.98]">
                                                <Share2 className="w-4 h-4" />
                                                {copied ? 'Copied!' : 'Invite Friend'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {(gameState.status === 'ended' || gameState.status === 'abandoned') && (
                                    <motion.div 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-[5px] sm:inset-[20px] rounded-[1.5rem] bg-[#0f131f]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center pointer-events-none"
                                    >
                                        <div className="bg-[#0f131f] border border-[#1b1f2c] p-4 sm:p-5 rounded-2xl w-[90%] sm:w-auto min-w-[200px] text-center shadow-2xl pointer-events-auto">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <button onClick={handleRematch} disabled={rematchPending && !isPVE}
                                                    className="w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex justify-center items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-cyan/20 to-accent-cyan/10 hover:from-accent-cyan/30 hover:to-accent-cyan/20 text-accent-cyan rounded-xl transition-all text-sm font-semibold active:scale-95">
                                                    <RotateCcw className="w-4 h-4" />
                                                    {rematchPending && !isPVE ? 'Waiting...' : 'Rematch'}
                                                </button>
                                            </div>
                                            {rematchPending && !isPVE && (
                                                <p className="text-[10px] text-text-muted mt-3 animate-pulse">Waiting for opponent to accept...</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Right: Chat (PVP only) */}
                    {!isPVE && (
                        <>
                            <AnimatePresence>
                                {showChat && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowChat(false)}
                                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
                                    />
                                )}
                            </AnimatePresence>

                            <div className={clsx(
                                "shrink-0 flex flex-col overflow-hidden transition-transform duration-300",
                                "bg-[#0f131f] sm:bg-[#0f131f]/60 sm:backdrop-blur-xl",
                                "rounded-t-3xl sm:rounded-2xl border-t sm:border border-[#1b1f2c] sm:border-transparent lg:border-white/[0.02]",
                                "fixed bottom-0 left-0 w-full z-50 shadow-2xl sm:shadow-none lg:shadow-2xl lg:shadow-black/20",
                                "sm:relative lg:w-64 xl:w-72 sm:h-auto lg:h-[480px]",
                                showChat ? "translate-y-0 h-[65vh] sm:h-auto" : "translate-y-full sm:translate-y-0 h-[65vh] sm:h-auto",
                                !showChat && "hidden sm:flex"
                            )}>
                                <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-[#1b1f2c] sm:border-b-0">
                                    {/* Mobile drag handle */}
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[#313442] sm:hidden" />
                                    <div className="flex items-center gap-2">
                                        <p className="text-accent-cyan text-xs font-bold uppercase tracking-[0.12em]">Live Chat</p>
                                        <span className="text-text-muted text-[10px] font-mono">{chat.length} msgs</span>
                                    </div>
                                    <button onClick={() => setShowChat(false)} className="sm:hidden cursor-pointer p-1 bg-[#1b1f2c] rounded-lg text-text-muted hover:text-text-primary active:scale-90">
                                        <ArrowLeft className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                                    {chat.length === 0 && <p className="text-text-muted text-xs text-center py-8 opacity-60">No messages yet. Say hi!</p>}
                                    {chat.map((msg, i) => (
                                        <div key={i} className={clsx("flex flex-col", msg.username === username ? "items-end" : "items-start")}>
                                            <span className={clsx("text-[10px] mb-0.5 font-bold uppercase tracking-wider", msg.username === username ? "text-accent-cyan/60" : "text-accent-rose/60")}>{msg.username}</span>
                                            <div className={clsx("px-3 py-2 rounded-xl max-w-[85%] text-sm leading-relaxed break-words", msg.username === username ? "bg-accent-cyan/[0.06] text-text-primary rounded-br-sm" : "bg-[#1b1f2c] text-text-primary rounded-bl-sm")}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                <AnimatePresence>
                                    {showTaunts && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="px-2 pb-2 flex flex-wrap gap-1.5">
                                                {TAUNTS.map((t, i) => (
                                                    <button key={i} onClick={() => sendTaunt(t)} className="cursor-pointer px-2.5 py-1 bg-[#1b1f2c] hover:bg-[#262a37] text-text-secondary hover:text-text-primary rounded-lg text-xs transition-all active:scale-90">{t}</button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <form onSubmit={sendMessage} className="px-3 py-2.5 flex items-center gap-2 shrink-0">
                                    <button type="button" onClick={() => setShowTaunts(!showTaunts)} className={clsx("cursor-pointer p-2 rounded-xl transition-all text-text-muted hover:text-text-primary active:scale-90", showTaunts && "bg-[#1b1f2c] text-accent-violet")}>
                                        <ChevronUp className={clsx("w-4 h-4 transition-transform", showTaunts && "rotate-180")} />
                                    </button>
                                    <input type="text" value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="Type a message..." maxLength={500}
                                        className="flex-1 bg-[#171b28] rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 transition placeholder:text-text-muted" />
                                    <button type="submit" className="cursor-pointer p-2 rounded-xl bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan transition-all active:scale-90">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Game;
