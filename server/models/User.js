const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        required: false
    },
    googleId: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
    },
    isGuest: {
        type: Boolean,
        default: false
    },
    avatar: {
        type: String,
        default: function() {
            const seed = this.username || Math.random().toString(36).substring(7);
            return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
        }
    },
    stats: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 }
    },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],
    lastActive: { type: Date, default: Date.now }
}, {
    timestamps: true
});

userSchema.index({ lastActive: 1 }, {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { isGuest: true }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
