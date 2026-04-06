const User = require('../models/User');
const Game = require('../models/Game');
const generateToken = require('../utils/generateToken');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    try {
        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            user.lastActive = new Date();
            await user.save();
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                isGuest: user.isGuest,
                stats: user.stats,
                currentStreak: user.currentStreak,
                bestStreak: user.bestStreak,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const registerUser = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    try {
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) return res.status(400).json({ message: 'Username or email already taken' });

        const user = await User.create({ username, email, password, isGuest: false });
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            isGuest: false,
            stats: user.stats,
            currentStreak: 0,
            bestStreak: 0,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const guestLogin = async (req, res) => {
    const { username } = req.body;
    const base = username ? `Guest_${username.replace(/[^a-zA-Z0-9]/g, '')}` : `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    const suffix = Math.floor(100 + Math.random() * 900);
    const guestUsername = `${base}_${suffix}`;

    try {
        const user = await User.create({ username: guestUsername, isGuest: true, lastActive: new Date() });
        res.status(201).json({
            _id: user._id,
            username: user.username,
            avatar: user.avatar,
            isGuest: true,
            stats: user.stats,
            currentStreak: 0,
            bestStreak: 0,
            token: generateToken(user._id),
        });
    } catch (error) {
        const fallback = `Guest_${Date.now().toString(36)}`;
        try {
            const user = await User.create({ username: fallback, isGuest: true, lastActive: new Date() });
            res.status(201).json({
                _id: user._id,
                username: user.username,
                avatar: user.avatar,
                isGuest: true,
                stats: user.stats,
                currentStreak: 0,
                bestStreak: 0,
                token: generateToken(user._id),
            });
        } catch (e) {
            res.status(500).json({ message: 'Failed to create guest session' });
        }
    }
};

const googleLogin = async (req, res) => {
    const { credential, accessToken } = req.body;

    try {
        let googleId, email, name, picture;

        if (credential) {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            googleId = payload.sub;
            email = payload.email;
            name = payload.name;
            picture = payload.picture;
        } else if (accessToken) {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!resp.ok) throw new Error('Invalid access token');
            const data = await resp.json();
            googleId = data.sub;
            email = data.email;
            name = data.name;
            picture = data.picture;
        } else {
            return res.status(400).json({ message: 'No credentials provided' });
        }

        let user = await User.findOne({ googleId });

        if (!user && email) {
            const emailUser = await User.findOne({ email });
            if (emailUser) {
                // Only link if the account doesn't have a password (not email/password registered)
                if (!emailUser.password) {
                    emailUser.googleId = googleId;
                    emailUser.avatar = picture || emailUser.avatar;
                    emailUser.lastActive = new Date();
                    await emailUser.save();
                    user = emailUser;
                } else {
                    // Email belongs to a password-registered account; don't auto-link
                    return res.status(409).json({
                        message: 'An account with this email already exists. Please sign in with your password.'
                    });
                }
            }
        }

        if (user) {
            user.lastActive = new Date();
            await user.save();
        } else {
            user = await User.create({
                username: name.replace(/\s+/g, '_').substring(0, 15) + '_' + Math.floor(Math.random() * 1000),
                email,
                googleId,
                avatar: picture,
                isGuest: false,
            });
        }

        res.status(200).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            isGuest: false,
            stats: user.stats,
            currentStreak: user.currentStreak,
            bestStreak: user.bestStreak,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(401).json({ message: 'Google authentication failed' });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -__v');
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.lastActive = new Date();
        await user.save();

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            isGuest: user.isGuest,
            stats: user.stats,
            currentStreak: user.currentStreak,
            bestStreak: user.bestStreak,
            friends: user.friends,
            friendRequests: user.friendRequests,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getRecentPlayers = async (req, res) => {
    try {
        const games = await Game.find({ players: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('players', 'username avatar stats currentStreak');

        const seen = new Set();
        const recentPlayers = [];
        for (const game of games) {
            for (const p of game.players) {
                if (p._id.toString() !== req.user._id.toString() && !seen.has(p._id.toString())) {
                    seen.add(p._id.toString());
                    const isFriend = req.user.friends?.some(f => f.toString() === p._id.toString());
                    recentPlayers.push({
                        _id: p._id,
                        username: p.username,
                        avatar: p.avatar,
                        stats: p.stats,
                        currentStreak: p.currentStreak,
                        isFriend,
                    });
                }
            }
            if (recentPlayers.length >= 10) break;
        }
        res.json(recentPlayers);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const sendFriendRequest = async (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'Target user ID required' });
    if (targetUserId === req.user._id.toString()) return res.status(400).json({ message: 'Cannot friend yourself' });

    try {
        const target = await User.findById(targetUserId);
        if (!target) return res.status(404).json({ message: 'User not found' });

        if (target.friends.some(f => f.toString() === req.user._id.toString())) {
            return res.status(400).json({ message: 'Already friends' });
        }
        if (target.friendRequests.some(r => r.from.toString() === req.user._id.toString())) {
            return res.status(400).json({ message: 'Request already sent' });
        }

        target.friendRequests.push({ from: req.user._id });
        await target.save();
        res.json({ message: 'Friend request sent' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const respondFriendRequest = async (req, res) => {
    const { requesterId, action } = req.body;
    if (!requesterId || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Requester ID and action (accept/reject) required' });
    }

    try {
        const user = await User.findById(req.user._id);
        const idx = user.friendRequests.findIndex(r => r.from.toString() === requesterId);
        if (idx === -1) return res.status(404).json({ message: 'No pending request from this user' });

        user.friendRequests.splice(idx, 1);

        if (action === 'accept') {
            user.friends.addToSet(requesterId);
            await User.findByIdAndUpdate(requesterId, { $addToSet: { friends: user._id } });
        }

        await user.save();
        res.json({ message: action === 'accept' ? 'Friend added' : 'Request rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'username avatar stats currentStreak bestStreak lastActive')
            .populate('friendRequests.from', 'username avatar');
        res.json({
            friends: user.friends,
            requests: user.friendRequests.map(r => ({
                _id: r.from._id,
                username: r.from.username,
                avatar: r.from.avatar,
                createdAt: r.createdAt,
            })),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const removeFriend = async (req, res) => {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ message: 'Friend ID required' });

    try {
        await User.findByIdAndUpdate(req.user._id, { $pull: { friends: friendId } });
        await User.findByIdAndUpdate(friendId, { $pull: { friends: req.user._id } });
        res.json({ message: 'Friend removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const searchUsers = async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    try {
        const users = await User.find({
            username: { $regex: q, $options: 'i' },
            _id: { $ne: req.user._id },
            isGuest: { $ne: true }
        })
        .limit(10)
        .select('username avatar stats currentStreak friendRequests');

        const currentUser = await User.findById(req.user._id);

        const results = users.map(u => {
            const isFriend = currentUser.friends.some(f => f.toString() === u._id.toString());
            const hasPendingRequest = u.friendRequests && u.friendRequests.some(r => r.from.toString() === req.user._id.toString());
            return {
                _id: u._id,
                username: u.username,
                avatar: u.avatar,
                stats: u.stats,
                currentStreak: u.currentStreak,
                isFriend,
                hasPendingRequest
            };
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    authUser,
    registerUser,
    guestLogin,
    googleLogin,
    getUserProfile,
    getRecentPlayers,
    sendFriendRequest,
    respondFriendRequest,
    getFriends,
    removeFriend,
    searchUsers,
};
