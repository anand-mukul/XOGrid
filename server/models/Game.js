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
        default: null
    },
    status: {
        type: String,
        enum: ['completed', 'draw', 'abandoned'],
        default: 'completed'
    },
    moves: [
        {
            player: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            position: { type: Number, min: 0, max: 8 },
            symbol: { type: String, enum: ['X', 'O'] },
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true
});

// Index for efficient player game lookups (PERF-006)
gameSchema.index({ players: 1, createdAt: -1 });

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
