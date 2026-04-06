# XOGrid - Server

Backend API and WebSocket server for XOGrid.

## Stack
- Runtime: Node.js 18+
- Framework: Express 5
- Real-time: Socket.IO 4
- Database: MongoDB (Mongoose 9)
- Auth: JWT + bcrypt + Google OAuth 2.0

## Setup

```bash
npm install
cp .env.example .env
# Fill in your environment variables
npm run dev     # Development (nodemon)
npm start       # Production
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 5000, Render uses 10000) |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `CLIENT_URL` | Yes | Frontend URL for CORS (comma-separated for multiple) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 client ID |
| `GOOGLE_SECRET_ID` | No | Google OAuth 2.0 client secret |

## Deploy to Render (from monorepo)

1. Connect the root GitHub repo
2. Set Root Directory to `server`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add env vars in Render dashboard
6. Health check endpoint: `GET /health`

## API Overview

- `POST /api/auth/guest` - Guest login
- `POST /api/auth/signup` - Register
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/google` - Google OAuth
- `GET /api/auth/profile` - User profile
- `GET /api/auth/friends` - Friends list
- `GET /api/auth/recent-players` - Recent opponents
