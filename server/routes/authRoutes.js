const express = require('express');
const {
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
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', registerUser);
router.post('/login', authUser);
router.post('/guest', guestLogin);
router.post('/google', googleLogin);
router.get('/profile', protect, getUserProfile);
router.get('/recent-players', protect, getRecentPlayers);
router.get('/friends', protect, getFriends);
router.post('/friends/request', protect, sendFriendRequest);
router.post('/friends/respond', protect, respondFriendRequest);
router.post('/friends/remove', protect, removeFriend);
router.get('/search', protect, searchUsers);

module.exports = router;
