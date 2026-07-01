# PIZO — Play More, Pay Less
## Deployment Guide

### Prerequisites
- **Node.js** 24.13.0+ (or compatible version)
- **Python** 3.14+
- **MongoDB** (local or Atlas cloud instance) — optional, uses mongomock in-memory DB by default
- **Razorpay Account** (test or production keys)

---

## Local Development Setup

### 1. Backend Setup
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and set:
# - MONGO_URL (optional; defaults to localhost:27017)
# - RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test keys provided)

# Start backend server (FastAPI + Uvicorn)
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Backend will be available at `http://localhost:8000`.
- Uses **mongomock** (in-memory database) if MongoDB is not available.
- API endpoints: `/api/*`

### 2. Frontend Setup
```bash
cd frontend

# Install Node dependencies
corepack yarn install

# Start development server (CRA with Craco)
corepack yarn start
```

Frontend will be available at `http://localhost:3000`.
- Configured with proxy to `/api` → `http://localhost:8000/api`
- Hot-reload enabled for development

### 3. Verify Setup
```bash
# In a new terminal, test the API
curl http://localhost:8000/api/venues
curl http://localhost:3000/api/venues

# Both should return venue data (200 OK)
```

---

## Production Deployment

### GitHub + Netlify (Recommended)

#### 1. Frontend on Netlify
```bash
# Ensure package.json has homepage (already set to "/")
# Build output: frontend/build/

# Netlify Settings:
# - Build command: cd frontend && corepack yarn build
# - Publish directory: frontend/build
# - Environment variables:
#   REACT_APP_BACKEND_URL=https://your-backend-domain.com

# Redirect API calls to backend:
# Create netlify.toml in project root:
```

**netlify.toml:**
```toml
[build]
  command = "cd frontend && corepack yarn build"
  publish = "frontend/build"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend-domain.com/api/:splat"
  status = 200
```

#### 2. Backend on Render or Heroku

**Render:**
```bash
# Create render.yaml in project root
```

**render.yaml:**
```yaml
services:
  - type: web
    name: pizo-backend
    env: python-3.11
    buildCommand: cd backend && pip install -r requirements.txt
    startCommand: cd backend && python -m uvicorn server:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: MONGO_URL
        value: <your-mongodb-atlas-uri>  # Required for production
      - key: DB_NAME
        value: pizo
      - key: JWT_SECRET
        value: <generate-strong-secret>
      - key: RAZORPAY_KEY_ID
        value: rzp_live_xxxxx  # Use live keys in production
      - key: RAZORPAY_KEY_SECRET
        value: <razorpay-secret>
      - key: CORS_ORIGINS
        value: https://your-frontend-domain.com
```

---

## Environment Variables

### Backend (.env)
```bash
# MongoDB (use MongoDB Atlas for production)
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=pizo

# JWT Secret (generate a strong random string)
JWT_SECRET=<generate-random-secret-key>

# Razorpay (get from https://dashboard.razorpay.com)
# Test mode (development):
RAZORPAY_KEY_ID=rzp_test_T5NYMLhEo1ovmZ
RAZORPAY_KEY_SECRET=e0mit0qzM2uhcDLtNYmgEPw9

# Production: Use live keys
# RAZORPAY_KEY_ID=rzp_live_xxxxx
# RAZORPAY_KEY_SECRET=xxxxxx

# CORS (allow frontend origin)
CORS_ORIGINS=http://localhost:3000  # or production domain
```

### Frontend (.env.local for dev, build-time for production)
```bash
REACT_APP_BACKEND_URL=http://localhost:8000
# (leave empty to use CRA proxy in dev, or set to production backend URL)
```

---

## Database Setup

### Option A: MongoDB Atlas (Cloud) — Recommended for Production
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection URI: `mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority`
4. Set `MONGO_URL` in `.env` or environment variables

### Option B: Local MongoDB (Development)
```bash
# Windows: Download and install MongoDB Community Edition
# https://www.mongodb.com/try/download/community

# macOS:
brew tap mongodb/brew
brew install mongodb-community

# Linux (Ubuntu):
sudo apt-get install -y mongodb

# Start MongoDB service
# Windows: mongod (or via Services)
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod
```

### Option C: In-Memory (mongomock) — Default
If `MONGO_URL` is unreachable, the backend automatically falls back to mongomock (in-memory database). Data is **not persisted** across restarts.

---

## Testing

### Run Backend Tests
```bash
cd backend
python -m pytest tests/ -v  # if tests exist
```

### Run Frontend Build
```bash
cd frontend
corepack yarn build
# Output in: frontend/build/
```

### Smoke Tests
```bash
# Auth: register and login
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Venues: list and fetch
curl http://localhost:8000/api/venues
curl http://localhost:8000/api/venues/venue_xxxxx

# Bookings: create booking
curl -X POST http://localhost:8000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"venue_id":"venue_xxxxx","date":"2026-06-25","slot":"10:00-11:00"}'
```

---

## Troubleshooting

### Frontend can't fetch API
- Check CRA proxy in `frontend/package.json`: `"proxy": "http://localhost:8000"`
- Verify backend is running on port 8000
- Check browser DevTools Network tab for CORS errors

### Backend returns 500 errors
- Check `backend/.env` is set correctly
- Ensure `MONGO_URL` is valid if using external MongoDB
- Restart backend after changing `.env`

### MongoDB connection fails
- Backend will auto-fallback to mongomock (in-memory DB)
- To use real MongoDB, install locally or connect to MongoDB Atlas
- Verify `MONGO_URL` format: `mongodb://host:port` or `mongodb+srv://user:pass@host`

### Razorpay payments fail
- Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set
- Test keys work in development mode only
- For production, update to live Razorpay keys

---

## Deployment Checklist

- [ ] Set strong `JWT_SECRET` in production
- [ ] Use live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (not test keys)
- [ ] Configure MongoDB Atlas with password auth
- [ ] Set `CORS_ORIGINS` to production frontend URL
- [ ] Enable HTTPS on backend and frontend
- [ ] Set up environment variables in Netlify and Render dashboards
- [ ] Test auth flow (register, login, token refresh)
- [ ] Test payment flow with Razorpay test mode
- [ ] Monitor logs on Render/Heroku for errors
- [ ] Set up error tracking (Sentry, LogRocket, etc.)

---

## Quick Commands

### Development
```bash
# Terminal 1: Backend
cd backend && python -m uvicorn server:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend && corepack yarn start

# Browser: http://localhost:3000
```

### Production Build
```bash
# Frontend
cd frontend && corepack yarn build
# Output: frontend/build/

# Backend
cd backend && pip install -r requirements.txt
# Run with: python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

---

**Last Updated:** 2026-06-24
**Maintainer:** PIZO Team
