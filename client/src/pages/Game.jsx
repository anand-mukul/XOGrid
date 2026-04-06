import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, Copy, Check, Flame, Zap, Star, Heart, Bot, RotateCcw, MessageCircle, ChevronUp, Hash, Trophy, TrendingUp } from 'lucide-react';
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
    const timerExpiredRef = useRef(false);
    const [showTaunts, setShowTaunts] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [reactionCooldown, setReactionCooldown] = useState(false);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat]);

    useEffect(() => {
        if (gameState?.status === 'playing') {
            setTimerValue(100);
            timerExpiredRef.current = false;
            if (timerRef.current) clearInterval(timerRef.current);

            const step = 100 / (TIMER_DURATION * (1000 / 150));
            timerRef.current = setInterval(() => {
                setTimerValue(prev => {
                    const next = prev - step;
                    if (next <= 0 && !timerExpiredRef.current) {
                        timerExpiredRef.current = true;
                        const myPlayer = gameState.players.find(p => p.id === user._id);
                        if (myPlayer && myPlayer.symbol === gameState.turn) {
                            socket?.emit('timerExpired');
                        }
                        return 0;
                    }
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
        if (!socket) return;

        socket.emit('joinRoom', { roomId, mode, difficulty: 'hard' });

        socket.on('gameState', (state) => {
            setGameState(prev => {
                if (prev && prev.status === 'playing' && state.status === 'ended') {
                    const myPlayer = state.players.find(p => p.id === user._id);
                    if (state.winner === 'Tie') {
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
                return state;
            });
            setChat(state.chatMessage || []);
        });

        socket.on('chatMessage', (msg) => {
            setChat(prev => [...prev, msg]);
        });

        socket.on('reaction', (data) => {
            const reaction = { id: `${Date.now()}_${Math.random()}`, ...data };
            setReactions(prev => [...prev, reaction]);
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== reaction.id));
            }, 2500);
        });

        return () => {
            socket.off('gameState');
            socket.off('chatMessage');
            socket.off('reaction');
        };
    }, [socket, roomId, mode, user._id, fireConfetti]);

    const handleMove = (index) => {
        if (gameState?.status !== 'playing') return;
        const myPlayer = gameState.players.find(p => p.id === user._id);
        if (!myPlayer || myPlayer.symbol !== gameState.turn) return;
        if (gameState.board[index] !== null) return;
        socket.emit('playMove', { index });
    };

    const handleRematch = () => {
        setLastResult(null);
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

    const myPlayerInfo = gameState.players.find(p => p.id === user._id);
    const opponentInfo = gameState.players.find(p => p.id !== user._id);
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
            <div className="relative z-20 flex items-center justify-between px-5 py-3 bg-[#0f131f]/90 backdrop-blur-xl">
                <button onClick={() => navigate('/')} className="flex items-center gap-2 px-3 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-[#1b1f2c] transition-all text-sm">
                    <ArrowLeft className="w-4 h-4" />
                    <div className="hidden sm:flex items-center gap-1.5">
                        <img src="/logo.png" alt="XOGrid" className="w-4 h-4 object-contain" />
                        <span className="font-semibold text-text-primary text-xs">XOGrid</span>
                    </div>
                </button>

                <div className="flex items-center gap-5">
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

                <div className="flex items-center gap-2">
                    {!isPVE && (
                        <button onClick={() => setShowChat(!showChat)} className="sm:hidden p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-[#1b1f2c] transition-all relative">
                            <MessageCircle className="w-4 h-4" />
                        </button>
                    )}
                    {!isPVE && (
                        <button onClick={copyInvite} className="flex items-center gap-2 px-3 py-2 rounded-xl text-text-muted hover:text-text-primary bg-[#171b28] hover:bg-[#1b1f2c] transition-all text-xs font-mono">
                            {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline max-w-[100px] truncate">{roomId}</span>
                        </button>
                    )}
                    {isPVE && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-emerald/10 text-accent-emerald text-xs font-semibold">
                            <Bot className="w-3.5 h-3.5" />
                            vs AI
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
                <div className={clsx(
                    "w-full flex flex-col lg:flex-row items-center lg:items-stretch gap-5 lg:gap-6",
                    isPVE ? "max-w-2xl" : "max-w-5xl"
                )}>

                    {/* Left: Players */}
                    <div className={clsx("shrink-0 space-y-4", isPVE ? "w-full lg:w-48" : "w-full lg:w-56")}>
                        <div className="bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl overflow-hidden">
                            <div className={clsx("flex items-center gap-3 px-4 py-4 transition-all duration-300 relative", isMyTurn && "bg-accent-cyan/[0.04]")}>
                                {isMyTurn && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent-cyan shadow-[0_0_8px_rgba(34,211,238,0.4)]" />}
                                <img src={user.avatar} className="w-10 h-10 rounded-xl bg-[#1b1f2c]" alt="" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-text-primary text-sm truncate">{user.username}</p>
                                    <p className={clsx("text-xs font-mono font-bold", myPlayerInfo?.symbol === 'X' ? "text-accent-cyan" : "text-accent-rose")}>{myPlayerInfo?.symbol || '...'}</p>
                                </div>
                                {isMyTurn && <span className="text-[9px] font-bold uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded-md">Turn</span>}
                            </div>

                            <div className="px-4"><div className="h-px bg-[#1b1f2c]" /></div>

                            <div className={clsx("flex items-center gap-3 px-4 py-4 transition-all duration-300 relative", !isMyTurn && gameState.status === 'playing' && "bg-accent-rose/[0.04]")}>
                                {!isMyTurn && gameState.status === 'playing' && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent-rose shadow-[0_0_8px_rgba(251,113,133,0.4)]" />}
                                {opponentInfo ? (
                                    <>
                                        <div className="w-10 h-10 rounded-xl bg-[#1b1f2c] flex items-center justify-center shrink-0">
                                            {opponentInfo.id === 'AI' ? (
                                                <Bot className="w-5 h-5 text-accent-emerald" />
                                            ) : opponentInfo.emoji?.startsWith('http') ? (
                                                <img src={opponentInfo.emoji} className="w-10 h-10 rounded-xl" alt="" />
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
                                        <div className="w-10 h-10 rounded-xl bg-[#1b1f2c] animate-pulse" />
                                        <span className="text-text-muted text-sm">Waiting...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isPVE && (
                            <div className="bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl p-3 flex items-center justify-around">
                                {REACTION_BUTTONS.map(({ emoji, Icon, color }) => (
                                    <button
                                        key={emoji}
                                        onClick={() => sendReaction(emoji)}
                                        disabled={reactionCooldown}
                                        className={clsx(
                                            "p-2.5 rounded-xl transition-all active:scale-90",
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
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="mb-5 text-center w-full max-w-xs">
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
                            ) : gameState.status === 'ended' ? (
                                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
                                    <p className={clsx("text-2xl font-display font-bold",
                                        lastResult === 'win' ? "text-accent-emerald" :
                                        lastResult === 'loss' ? "text-accent-rose" : "text-text-secondary"
                                    )}>
                                        {lastResult === 'win' && '🎉 You Win!'}
                                        {lastResult === 'loss' && 'You Lost'}
                                        {lastResult === 'draw' && "It's a Draw"}
                                        {!lastResult && (gameState.winner === 'Tie' ? "Draw!" : `${gameState.winner} Wins!`)}
                                    </p>
                                    <button onClick={handleRematch} className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-accent-cyan/20 to-accent-cyan/10 hover:from-accent-cyan/30 hover:to-accent-cyan/20 text-accent-cyan rounded-xl transition-all text-sm font-semibold hover:scale-105 active:scale-95">
                                        <RotateCcw className="w-4 h-4" />
                                        Rematch
                                    </button>
                                </motion.div>
                            ) : (
                                <p className="text-sm text-text-muted font-medium animate-pulse">Waiting for opponent...</p>
                            )}
                        </div>

                        <div className="bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl p-4 sm:p-5">
                            <div className="grid grid-cols-3 gap-2">
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
                                        <AnimatePresence>
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
                    </div>

                    {/* Right: Chat (PVP only) */}
                    {!isPVE && (
                        <div className={clsx(
                            "lg:w-64 shrink-0 bg-[#0f131f]/60 backdrop-blur-xl rounded-2xl flex flex-col overflow-hidden transition-all",
                            "w-full lg:h-[480px]",
                            showChat ? "h-80 sm:h-96" : "h-0 sm:h-auto sm:flex",
                            !showChat && "hidden sm:flex"
                        )}>
                            <div className="px-4 py-3 flex items-center justify-between shrink-0">
                                <p className="text-accent-cyan text-xs font-bold uppercase tracking-[0.12em]">Live Chat</p>
                                <span className="text-text-muted text-[10px] font-mono">{chat.length} msgs</span>
                            </div>

                            <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2">
                                {chat.length === 0 && <p className="text-text-muted text-xs text-center py-8 opacity-60">No messages yet. Say hi!</p>}
                                {chat.map((msg, i) => (
                                    <div key={i} className={clsx("flex flex-col", msg.username === user.username ? "items-end" : "items-start")}>
                                        <span className={clsx("text-[10px] mb-0.5 font-bold uppercase tracking-wider", msg.username === user.username ? "text-accent-cyan/60" : "text-accent-rose/60")}>{msg.username}</span>
                                        <div className={clsx("px-3 py-2 rounded-xl max-w-[85%] text-sm leading-relaxed", msg.username === user.username ? "bg-accent-cyan/[0.06] text-text-primary rounded-br-sm" : "bg-[#1b1f2c] text-text-primary rounded-bl-sm")}>
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
                                                <button key={i} onClick={() => sendTaunt(t)} className="px-2.5 py-1 bg-[#1b1f2c] hover:bg-[#262a37] text-text-secondary hover:text-text-primary rounded-lg text-xs transition-all">{t}</button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={sendMessage} className="px-3 py-2.5 flex items-center gap-2 shrink-0">
                                <button type="button" onClick={() => setShowTaunts(!showTaunts)} className={clsx("p-2 rounded-xl transition-all text-text-muted hover:text-text-primary", showTaunts && "bg-[#1b1f2c] text-accent-violet")}>
                                    <ChevronUp className={clsx("w-4 h-4 transition-transform", showTaunts && "rotate-180")} />
                                </button>
                                <input type="text" value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-[#171b28] rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 transition placeholder:text-text-muted" />
                                <button type="submit" className="p-2 rounded-xl bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan transition-all">
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Game;
