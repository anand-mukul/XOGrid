# XOGrid - Client

React frontend for XOGrid.

## Stack
- Framework: React 19 + Vite
- Styling: Tailwind CSS v4
- Animations: Framer Motion
- 3D Graphics: React Three Fiber, Drei, Three.js
- WebSockets: Socket.io-client

## Setup

```bash
npm install
cp .env.example .env
# Fill in your environment variables (VITE_API_URL and VITE_GOOGLE_CLIENT_ID)
npm run dev     # Development
npm run build   # Production build
```

## Environment Variables

Expected variables in `.env`:
- `VITE_API_URL`: Backend API URL (e.g., `http://localhost:5000/api` or Production URL)
- `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID

## Deploy to Vercel (from monorepo)

1. Connect the root GitHub repo
2. Set Root Directory to `client`
3. Framework Preset: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add environment variables
