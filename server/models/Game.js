const mongoose = require('mongoose');

const gameSchema = mongoose.Schema({
    players: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null if draw or incomplete
    },
    status: {
        type: String,
        enum: ['in_progress', 'completed', 'draw', 'abandoned'],
        default: 'in_progress'
    },
    moves: [
        {
            player: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            position: Number, // 0-8 for Tic-Tac-Toe grid
            symbol: String, // 'X' or 'O'
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true
});

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
