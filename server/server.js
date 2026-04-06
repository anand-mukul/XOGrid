const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const handleSocketConnection = require('./sockets/gameSocket');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(u => u.trim())
    : ['http://localhost:5173'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'XOGrid API is running' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication Error'));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password -__v');
        if (!user) return next(new Error('User not found'));

        socket.user = {
            id: user._id.toString(),
            username: user.username,
            avatar: user.avatar
        };
        next();
    } catch (err) {
        return next(new Error('Authentication Error: Invalid Token'));
    }
});

handleSocketConnection(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
