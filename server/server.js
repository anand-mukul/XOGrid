const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const handleSocketConnection = require('./sockets/gameSocket');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const mongoose = require('mongoose');

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(u => u.trim())
    : ['http://localhost:5173'];

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — actually block unauthorized origins (BUG-002 fix)
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Origin not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' }
});
app.use(globalLimiter);

// Auth-specific strict limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many auth attempts, please try again later' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/guest', authLimiter);
app.use('/api/auth/google', authLimiter);

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'XOGrid API is running' });
});

// Enhanced health check (ARCH-008)
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    res.json({
        status: dbState === 1 ? 'ok' : 'degraded',
        uptime: process.uptime(),
        database: dbStatus,
        memory: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
            heap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        },
        timestamp: new Date().toISOString()
    });
});

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6, // 1MB max payload
});

// Socket authentication middleware
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

// Graceful shutdown (FEAT-010)
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    // Stop accepting new connections
    server.close(() => {
        console.log('HTTP server closed');
    });

    // Close Socket.IO connections
    io.close(() => {
        console.log('Socket.IO connections closed');
    });

    // Close database connection
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (err) {
        console.error('Error closing MongoDB:', err);
    }

    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled errors to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
});
