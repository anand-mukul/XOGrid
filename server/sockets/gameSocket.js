const { checkWinner, getBestMove } = require('../utils/ai');
const Game = require('../models/Game');
const User = require('../models/User');

// ── State ────────────────────────────────────────────────────────────────────
const rooms = {};
let matchmakingQueue = [];
let matchmakingLock = false;
const connectedUsers = new Set();

// ── Constants ────────────────────────────────────────────────────────────────
const TURN_TIMEOUT_MS = 30000;
const ROOM_CLEANUP_INTERVAL_MS = 60000;
const STALE_ROOM_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CHAT_MESSAGES = 100;
const MAX_CHAT_LENGTH = 500;

// ── Helpers ──────────────────────────────────────────────────────────────────

const sanitizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .trim()
        .substring(0, MAX_CHAT_LENGTH)
        .replace(/[<>]/g, ''); // Strip basic HTML tags for XSS prevention
};

const validateMoveIndex = (index) => {
    return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index <= 8;
};

/**
 * Shared cleanup logic for when a player disconnects or leaves.
 */
const handlePlayerLeave = (io, socket, userId, currentRoom) => {
    if (!currentRoom || !rooms[currentRoom]) return;

    const room = rooms[currentRoom];

    // Clear server-side turn timer
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }

    room.players = room.players.filter(p => p.id !== userId);

    if (room.players.length === 0) {
        delete rooms[currentRoom];
    } else if (room.mode === 'pve') {
        delete rooms[currentRoom];
    } else if (room.status === 'playing') {
        room.status = 'abandoned';
        room.endedAt = Date.now();
        const remainingPlayer = room.players[0]; // Only one left after filter
        if (remainingPlayer) {
            room.winner = remainingPlayer.symbol;
        }
        io.to(currentRoom).emit('gameState', sanitizeRoomForClient(room));
        saveGameToDB(room);
    }

    socket.leave(currentRoom);
};

/**
 * Strip internal fields before sending room state to clients.
 */
const sanitizeRoomForClient = (room) => {
    const { turnTimer, endedAt, ...clientRoom } = room;
    return clientRoom;
};

/**
 * When it expires, a random move is played for the current player.
 */
const startTurnTimer = (io, roomId, room) => {
    if (room.turnTimer) clearTimeout(room.turnTimer);

    room.turnTimer = setTimeout(() => {
        if (!rooms[roomId] || room.status !== 'playing') return;

        const currentPlayer = room.players.find(p => p.symbol === room.turn);
        if (!currentPlayer) return;

        // Auto-play random move for the timed-out player
        const available = room.board
            .map((v, i) => v === null ? i : null)
            .filter(v => v !== null);

        if (available.length === 0) return;

        const randomIdx = available[Math.floor(Math.random() * available.length)];
        room.board[randomIdx] = currentPlayer.symbol;
        room.turn = currentPlayer.symbol === 'X' ? 'O' : 'X';

        const result = checkWinner(room.board);
        if (result) {
            room.status = 'ended';
            room.winner = result;
            room.endedAt = Date.now();
            io.to(roomId).emit('gameState', sanitizeRoomForClient(room));
            saveGameToDB(room);
            return;
        }

        io.to(roomId).emit('gameState', sanitizeRoomForClient(room));

        // If PvE, trigger AI move
        if (room.mode === 'pve') {
            const aiPlayer = room.players.find(p => p.id === 'AI');
            if (aiPlayer && room.turn === aiPlayer.symbol) {
                triggerAIMove(io, roomId, room, aiPlayer.symbol);
                return; // AI move will start its own timer
            }
        }

        // Start timer for next player's turn
        startTurnTimer(io, roomId, room);
    }, TURN_TIMEOUT_MS);
};

const triggerAIMove = (io, roomId, room, aiSymbol) => {
    setTimeout(() => {
        if (!rooms[roomId] || room.status !== 'playing') return;
        const aiMove = getBestMove(room.board, aiSymbol, room.difficulty);
        if (aiMove === -1) return;

        room.board[aiMove] = aiSymbol;
        room.turn = aiSymbol === 'X' ? 'O' : 'X';

        const result = checkWinner(room.board);
        if (result) {
            room.status = 'ended';
            room.winner = result;
            room.endedAt = Date.now();
            io.to(roomId).emit('gameState', sanitizeRoomForClient(room));
            saveGameToDB(room);
            return;
        }

        io.to(roomId).emit('gameState', sanitizeRoomForClient(room));
        startTurnTimer(io, roomId, room);
    }, 600);
};

setInterval(() => {
    const now = Date.now();
    for (const [id, room] of Object.entries(rooms)) {
        const isStale =
            (room.status === 'ended' || room.status === 'abandoned') &&
            room.endedAt &&
            (now - room.endedAt > STALE_ROOM_TTL_MS);

        const isEmptyAndOld =
            room.players.length === 0 &&
            room.createdAt &&
            (now - room.createdAt > STALE_ROOM_TTL_MS);

        if (isStale || isEmptyAndOld) {
            if (room.turnTimer) clearTimeout(room.turnTimer);
            delete rooms[id];
        }
    }
}, ROOM_CLEANUP_INTERVAL_MS);

// ── Main Handler ─────────────────────────────────────────────────────────────
const handleSocketConnection = (io) => {
    io.on('connection', (socket) => {
        const user = socket.user;
        let currentRoom = null;

        connectedUsers.add(socket.id);
        io.emit('onlineCountUpdate', connectedUsers.size);

        // ── Matchmaking ──────────────────────────────────────────────────
        socket.on('findMatch', () => {
            if (matchmakingLock) return;
            if (matchmakingQueue.some(p => p.userId === user.id)) return;

            matchmakingQueue.push({ socketId: socket.id, userId: user.id });

            if (matchmakingQueue.length >= 2) {
                matchmakingLock = true;
                try {
                    const player1 = matchmakingQueue.shift();
                    const player2 = matchmakingQueue.shift();

                    const roomId = `live-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

                    const sock1 = io.sockets.sockets.get(player1.socketId);
                    const sock2 = io.sockets.sockets.get(player2.socketId);

                    if (sock1) sock1.emit('matchFound', { roomId, mode: 'pvp' });
                    if (sock2) sock2.emit('matchFound', { roomId, mode: 'pvp' });

                    // If either socket is disconnected, put the other back
                    if (!sock1 && sock2) matchmakingQueue.unshift(player2);
                    if (!sock2 && sock1) matchmakingQueue.unshift(player1);
                } finally {
                    matchmakingLock = false;
                }
            }
        });

        socket.on('cancelMatch', () => {
            matchmakingQueue = matchmakingQueue.filter(p => p.userId !== user.id);
        });

        // ── Join Room ────────────────────────────────────────────────────
        socket.on('joinRoom', ({ roomId, mode, difficulty }) => {
            if (typeof roomId !== 'string' || roomId.length > 100) return;

            if (mode === 'pvp' && roomId.startsWith('ai-')) {
                socket.emit('error', { message: 'Cannot join an AI room via code' });
                return;
            }

            if (currentRoom && currentRoom !== roomId && rooms[currentRoom]) {
                handlePlayerLeave(io, socket, user.id, currentRoom);
            }

            currentRoom = roomId;
            socket.join(roomId);

            if (!rooms[roomId]) {
                rooms[roomId] = {
                    board: Array(9).fill(null),
                    players: [],
                    turn: 'X',
                    mode: mode || 'pvp',
                    difficulty: difficulty || 'hard',
                    status: 'waiting',
                    chatMessages: [],
                    turnTimer: null,
                    createdAt: Date.now(),
                    endedAt: null,
                    rematchVotes: new Set(),
                };
            }

            const room = rooms[roomId];

            if (room.players.length < 2 && !room.players.some(p => p.id === user.id)) {
                const symbol = room.players.length === 0 ? 'X' : 'O';
                room.players.push({ id: user.id, username: user.username, emoji: user.avatar, symbol });
            }

            if (room.mode === 'pve' && room.players.length === 1) {
                room.players.push({ id: 'AI', username: 'AI-Opponent', emoji: 'bot', symbol: 'O' });
                room.status = 'playing';
                startTurnTimer(io, roomId, room);
            } else if (room.players.length === 2 && room.status === 'waiting') {
                room.status = 'playing';
                startTurnTimer(io, roomId, room);
            }

            io.to(roomId).emit('gameState', sanitizeRoomForClient(room));
        });

        // ── Play Move ────────────────────────────────────────────────────
        socket.on('playMove', async ({ index }) => {
            if (!currentRoom || !rooms[currentRoom]) return;
            const room = rooms[currentRoom];
            if (room.status !== 'playing') return;

            if (!validateMoveIndex(index)) return;

            const player = room.players.find(p => p.id === user.id);
            if (!player || player.symbol !== room.turn) return;
            if (room.board[index] !== null) return;

            room.board[index] = player.symbol;
            room.turn = player.symbol === 'X' ? 'O' : 'X';

            if (!room.moves) room.moves = [];
            room.moves.push({ playerId: player.id, position: index, symbol: player.symbol, timestamp: Date.now() });

            const result = checkWinner(room.board);
            if (result) {
                room.status = 'ended';
                room.winner = result;
                room.endedAt = Date.now();
                if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
                io.to(currentRoom).emit('gameState', sanitizeRoomForClient(room));
                await saveGameToDB(room);
                return;
            }

            io.to(currentRoom).emit('gameState', sanitizeRoomForClient(room));

            if (room.mode === 'pve') {
                const aiPlayer = room.players.find(p => p.id === 'AI');
                if (aiPlayer && room.turn === aiPlayer.symbol) {
                    if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
                    triggerAIMove(io, currentRoom, room, aiPlayer.symbol);
                    return;
                }
            }

            // Reset timer for next turn
            startTurnTimer(io, currentRoom, room);
        });

        // ── Timer Expired (kept for backward compat, but server is authoritative now)
        socket.on('timerExpired', () => {
        });

        socket.on('rematch', ({ roomId }) => {
            if (!rooms[roomId]) return;
            const room = rooms[roomId];
            if (room.status !== 'ended' && room.status !== 'abandoned') return;

            const player = room.players.find(p => p.id === user.id);
            if (!player) return;

            // For PvE, instant rematch
            if (room.mode === 'pve') {
                resetRoomForRematch(io, roomId, room);
                return;
            }

            if (!room.rematchVotes) room.rematchVotes = new Set();
            room.rematchVotes.add(user.id);

            const humanPlayers = room.players.filter(p => p.id !== 'AI');

            if (room.rematchVotes.size >= humanPlayers.length) {
                resetRoomForRematch(io, roomId, room);
            } else {
                // Notify opponent that this player wants rematch
                socket.broadcast.to(roomId).emit('rematchRequested', { username: user.username });
            }
        });

        socket.on('chatMessage', (msg) => {
            if (!currentRoom || !rooms[currentRoom]) return;
            if (rooms[currentRoom].mode === 'pve') return;

            const sanitized = sanitizeText(msg);
            if (!sanitized) return;

            const message = { username: user.username, text: sanitized, time: new Date() };

            if (rooms[currentRoom].chatMessages.length >= MAX_CHAT_MESSAGES) {
                rooms[currentRoom].chatMessages.shift();
            }
            rooms[currentRoom].chatMessages.push(message);
            io.to(currentRoom).emit('chatMessage', message);
        });

        // ── Reactions ────────────────────────────────────────────────────
        socket.on('sendReaction', (emoji) => {
            if (!currentRoom) return;
            if (rooms[currentRoom]?.mode === 'pve') return;
            if (typeof emoji !== 'string' || emoji.length > 10) return;
            socket.broadcast.to(currentRoom).emit('reaction', { username: user.username, emoji });
        });

        // ── Leave Room ───────────────────────────────────────────────────
        socket.on('leaveRoom', () => {
            handlePlayerLeave(io, socket, user.id, currentRoom);
            currentRoom = null;
        });

        // ── Disconnect ───────────────────────────────────────────────────
        socket.on('disconnect', () => {
            matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);

            handlePlayerLeave(io, socket, user.id, currentRoom);

            connectedUsers.delete(socket.id);
            io.emit('onlineCountUpdate', connectedUsers.size);
        });
    });
};

// ── Rematch Helper ───────────────────────────────────────────────────────────
const resetRoomForRematch = (io, roomId, room) => {
    room.board = Array(9).fill(null);
    room.turn = 'X';
    room.status = 'playing';
    room.winner = null;
    room.endedAt = null;
    room.moves = [];
    room.rematchVotes = new Set();

    // Swap symbols
    room.players.forEach(p => {
        p.symbol = p.symbol === 'X' ? 'O' : 'X';
    });

    io.to(roomId).emit('gameState', sanitizeRoomForClient(room));

    // Start timer & handle AI first move if needed
    if (room.mode === 'pve') {
        const aiPlayer = room.players.find(p => p.id === 'AI');
        if (aiPlayer && aiPlayer.symbol === 'X') {
            triggerAIMove(io, roomId, room, 'X');
            return;
        }
    }
    startTurnTimer(io, roomId, room);
};

// ── Save Game to Database ────────────────────────────────────────────────────
const saveGameToDB = async (room) => {
    try {
        const humanPlayers = room.players.filter(p => p.id !== 'AI');
        if (humanPlayers.length === 0) return;

        const p1 = room.players.find(p => p.symbol === 'X');
        const p2 = room.players.find(p => p.symbol === 'O');
        if (!p1 || !p2) return;

        const isAI = room.mode === 'pve';

        if (!isAI) {
            const game = new Game({
                players: [p1.id, p2.id],
                winner: room.winner === 'Tie' ? null : (room.winner === 'X' ? p1.id : p2.id),
                status: room.winner === 'Tie' ? 'draw' : (room.status === 'abandoned' ? 'abandoned' : 'completed'),
                moves: (room.moves || [])
                    .filter(m => m.playerId !== 'AI')
                    .map(m => ({
                        player: m.playerId,
                        position: m.position,
                        symbol: m.symbol,
                        timestamp: m.timestamp
                    }))
            });
            await game.save();
        }

        for (const hp of humanPlayers) {
            const won = room.winner === hp.symbol;
            const draw = room.winner === 'Tie';

            if (won) {
                await User.findByIdAndUpdate(hp.id, [
                    {
                        $set: {
                            'stats.wins': { $add: ['$stats.wins', 1] },
                            currentStreak: { $add: ['$currentStreak', 1] },
                            bestStreak: { $max: ['$bestStreak', { $add: ['$currentStreak', 1] }] },
                        }
                    }
                ]);
            } else if (draw) {
                await User.findByIdAndUpdate(hp.id, {
                    $inc: { 'stats.draws': 1 },
                    $set: { currentStreak: 0 },
                });
            } else {
                await User.findByIdAndUpdate(hp.id, {
                    $inc: { 'stats.losses': 1 },
                    $set: { currentStreak: 0 },
                });
            }
        }
    } catch (e) {
        console.error('Error saving game:', e);
    }
};

module.exports = handleSocketConnection;
