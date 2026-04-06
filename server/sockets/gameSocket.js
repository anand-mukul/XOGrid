const { checkWinner, getBestMove } = require('../utils/ai');
const Game = require('../models/Game');
const User = require('../models/User');

const rooms = {};

const triggerAIMove = (io, roomId, room, aiSymbol) => {
    setTimeout(async () => {
        if (room.status !== 'playing') return;
        const aiMove = getBestMove(room.board, aiSymbol, room.difficulty);
        if (aiMove === -1) return;

        room.board[aiMove] = aiSymbol;
        room.turn = aiSymbol === 'X' ? 'O' : 'X';

        const result = checkWinner(room.board);
        if (result) {
            room.status = 'ended';
            room.winner = result;
            io.to(roomId).emit('gameState', room);
            await saveGameToDB(room);
            return;
        }
        io.to(roomId).emit('gameState', room);
    }, 600);
};

const handleSocketConnection = (io) => {
    io.on('connection', (socket) => {
        const user = socket.user;
        let currentRoom = null;

        socket.on('joinRoom', ({ roomId, mode, difficulty }) => {
            if (mode === 'pvp' && roomId.startsWith('ai-')) {
                socket.emit('error', { message: 'Cannot join an AI room via code' });
                return;
            }

            currentRoom = roomId;
            socket.join(roomId);

            if (!rooms[roomId]) {
                rooms[roomId] = {
                    board: Array(9).fill(null),
                    players: [],
                    turn: 'X',
                    mode: mode || 'pvp',
                    difficulty: difficulty || 'easy',
                    status: 'waiting',
                    chatMessage: []
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
            } else if (room.players.length === 2 && room.status === 'waiting') {
                room.status = 'playing';
            }

            io.to(roomId).emit('gameState', room);
        });

        socket.on('playMove', async ({ index }) => {
            if (!currentRoom) return;
            const room = rooms[currentRoom];
            if (!room || room.status !== 'playing') return;

            const player = room.players.find(p => p.id === user.id);
            if (!player || player.symbol !== room.turn) return;
            if (room.board[index] !== null) return;

            room.board[index] = player.symbol;
            room.turn = player.symbol === 'X' ? 'O' : 'X';

            const result = checkWinner(room.board);
            if (result) {
                room.status = 'ended';
                room.winner = result;
                io.to(currentRoom).emit('gameState', room);
                await saveGameToDB(room);
                return;
            }

            io.to(currentRoom).emit('gameState', room);

            if (room.mode === 'pve') {
                const aiPlayer = room.players.find(p => p.id === 'AI');
                if (aiPlayer && room.turn === aiPlayer.symbol) {
                    triggerAIMove(io, currentRoom, room, aiPlayer.symbol);
                }
            }
        });

        socket.on('timerExpired', () => {
            if (!currentRoom) return;
            const room = rooms[currentRoom];
            if (!room || room.status !== 'playing') return;

            const player = room.players.find(p => p.id === user.id);
            if (!player || player.symbol !== room.turn) return;

            const available = room.board.map((v, i) => v === null ? i : null).filter(v => v !== null);
            if (available.length === 0) return;

            const randomIdx = available[Math.floor(Math.random() * available.length)];
            room.board[randomIdx] = player.symbol;
            room.turn = player.symbol === 'X' ? 'O' : 'X';

            const result = checkWinner(room.board);
            if (result) {
                room.status = 'ended';
                room.winner = result;
                io.to(currentRoom).emit('gameState', room);
                saveGameToDB(room);
                return;
            }

            io.to(currentRoom).emit('gameState', room);

            if (room.mode === 'pve') {
                const aiPlayer = room.players.find(p => p.id === 'AI');
                if (aiPlayer && room.turn === aiPlayer.symbol) {
                    triggerAIMove(io, currentRoom, room, aiPlayer.symbol);
                }
            }
        });

        socket.on('rematch', ({ roomId }) => {
            if (!rooms[roomId]) return;
            const room = rooms[roomId];

            room.board = Array(9).fill(null);
            room.turn = 'X';
            room.status = 'playing';
            room.winner = null;

            room.players.forEach(p => {
                p.symbol = p.symbol === 'X' ? 'O' : 'X';
            });

            io.to(roomId).emit('gameState', room);

            if (room.mode === 'pve') {
                const aiPlayer = room.players.find(p => p.id === 'AI');
                if (aiPlayer && aiPlayer.symbol === 'X') {
                    triggerAIMove(io, roomId, room, 'X');
                }
            }
        });

        socket.on('chatMessage', (msg) => {
            if (!currentRoom || !rooms[currentRoom]) return;
            if (rooms[currentRoom].mode === 'pve') return;
            const message = { username: user.username, text: msg, time: new Date() };
            rooms[currentRoom].chatMessage.push(message);
            io.to(currentRoom).emit('chatMessage', message);
        });

        socket.on('sendReaction', (emoji) => {
            if (!currentRoom) return;
            if (rooms[currentRoom]?.mode === 'pve') return;
            socket.broadcast.to(currentRoom).emit('reaction', { username: user.username, emoji });
        });

        socket.on('disconnect', () => {
            if (currentRoom && rooms[currentRoom]) {
                const room = rooms[currentRoom];
                room.players = room.players.filter(p => p.id !== user.id);
                if (room.players.length === 0) {
                    delete rooms[currentRoom];
                } else if (room.mode === 'pve') {
                    delete rooms[currentRoom];
                } else if (room.status === 'playing') {
                    room.status = 'abandoned';
                    io.to(currentRoom).emit('gameState', room);
                }
            }
        });
    });
};

const saveGameToDB = async (room) => {
    try {
        const humanPlayers = room.players.filter(p => p.id !== 'AI');
        if (humanPlayers.length === 0) return;

        const p1 = room.players.find(p => p.symbol === 'X');
        const p2 = room.players.find(p => p.symbol === 'O');
        if (!p1 || !p2) return;

        const isAI = room.mode === 'pve';
        const humanPlayer = humanPlayers[0];

        if (!isAI) {
            const game = new Game({
                players: [p1.id, p2.id],
                winner: room.winner === 'Tie' ? null : (room.winner === 'X' ? p1.id : p2.id),
                status: room.winner === 'Tie' ? 'draw' : 'completed'
            });
            await game.save();
        }

        for (const hp of humanPlayers) {
            const won = room.winner === hp.symbol;
            const draw = room.winner === 'Tie';

            if (won) {
                await User.findByIdAndUpdate(hp.id, {
                    $inc: { 'stats.wins': 1, currentStreak: 1 },
                });
                const updated = await User.findById(hp.id);
                if (updated && updated.currentStreak > updated.bestStreak) {
                    updated.bestStreak = updated.currentStreak;
                    await updated.save();
                }
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
