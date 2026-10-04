# SURVIVAL — 7-Day Online Puzzle Game

> 7 Days. One Winner. Private competitive survival puzzle game.

---

## Project Structure

```
group-game/
├── backend/                  Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/db.ts      MongoDB Atlas connection
│   │   ├── middleware/
│   │   │   ├── auth.ts       JWT authentication middleware
│   │   │   └── rateLimiter.ts  Express rate limiting
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Game.ts
│   │   │   ├── GameDay.ts
│   │   │   ├── Challenge.ts
│   │   │   ├── PlayerGame.ts
│   │   │   ├── ChallengeAttempt.ts
│   │   │   ├── Submission.ts
│   │   │   ├── Elimination.ts
│   │   │   └── Announcement.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── games.ts
│   │   │   ├── challenges.ts
│   │   │   └── players.ts
│   │   ├── services/
│   │   │   ├── puzzleEngine.ts   Per-player puzzle generation + server-side validation
│   │   │   └── socketService.ts  Socket.IO real-time events
│   │   └── server.ts
│   ├── .env                  ← Your secrets (gitignored)
│   ├── .env.example
│   └── package.json
│
└── frontend/                 React + Vite + TypeScript + Tailwind
    ├── src/
    │   ├── components/
    │   │   ├── layout/ProtectedRoute.tsx
    │   │   └── shared/
    │   │       ├── CountdownTimer.tsx
    │   │       ├── GroupDiscussionButton.tsx
    │   │       ├── LoadingScreen.tsx
    │   │       └── StatusBadge.tsx
    │   ├── lib/
    │   │   ├── api.ts          Axios API client
    │   │   └── socket.ts       Socket.IO client
    │   ├── pages/
    │   │   ├── LandingPage.tsx
    │   │   ├── LoginPage.tsx
    │   │   ├── AdminLoginPage.tsx
    │   │   ├── DashboardPage.tsx
    │   │   ├── ChallengePage.tsx
    │   │   └── admin/
    │   │       ├── AdminDashboardPage.tsx
    │   │       └── tabs/
    │   │           ├── AdminOverview.tsx
    │   │           ├── AdminGames.tsx
    │   │           ├── AdminPlayers.tsx
    │   │           ├── AdminChallenges.tsx
    │   │           ├── AdminResults.tsx
    │   │           └── AdminAnnouncements.tsx
    │   ├── store/authStore.ts  Zustand auth state
    │   ├── types/index.ts      Shared TypeScript types
    │   ├── vite-env.d.ts
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── .env                   ← Frontend env vars (gitignored)
    ├── .env.example
    └── package.json
```

---

## Database Models

| Model            | Purpose                                        |
|-----------------|------------------------------------------------|
| User            | Players and admins (hashed passwords)         |
| Game            | Game instance (name, status, days)            |
| GameDay         | Per-day config (start/end times, elim count)  |
| Challenge       | Puzzle config per day (answers server-side)   |
| PlayerGame      | Player enrollment + score per game            |
| ChallengeAttempt| Timer, puzzle seed, individual puzzle data    |
| Submission      | Player answers + server-validated score       |
| Elimination     | Elimination log per day                       |
| Announcement    | Admin announcements (draft/published)         |

---

## API Routes

### Auth  `/api/auth`
| Method | Route              | Description                        |
|--------|--------------------|------------------------------------|
| POST   | /login             | Player or admin login              |
| POST   | /register          | Create player account              |
| POST   | /register-admin    | Create admin (requires ADMIN_SECRET)|
| GET    | /me                | Get current user                   |
| POST   | /logout            | Logout (stateless)                 |

### Games  `/api/games`
| Method | Route                                    | Access |
|--------|------------------------------------------|--------|
| GET    | /                                        | Auth   |
| POST   | /                                        | Admin  |
| GET    | /:gameId                                 | Auth   |
| PATCH  | /:gameId                                 | Admin  |
| GET    | /:gameId/days                            | Auth   |
| POST   | /:gameId/days                            | Admin  |
| PATCH  | /:gameId/days/:dayId                     | Admin  |
| GET    | /:gameId/players                         | Auth   |
| POST   | /:gameId/enroll/:userId                  | Admin  |
| POST   | /:gameId/enroll-bulk                     | Admin  |
| GET    | /:gameId/stats                           | Admin  |
| GET    | /:gameId/announcements                   | Auth   |
| POST   | /:gameId/announcements                   | Admin  |
| PATCH  | /:gameId/announcements/:annId/publish    | Admin  |

### Challenges  `/api/challenges`
| Method | Route                    | Access |
|--------|--------------------------|--------|
| GET    | /                        | Auth   |
| POST   | /                        | Admin  |
| GET    | /:id                     | Auth   |
| PATCH  | /:id                     | Admin  |
| DELETE | /:id                     | Admin  |
| POST   | /:id/start               | Player |
| POST   | /:id/submit              | Player |
| GET    | /:id/my-attempt          | Player |
| GET    | /:id/attempts            | Admin  |
| GET    | /:id/submissions         | Admin  |

### Players  `/api/players`
| Method | Route                         | Access |
|--------|-------------------------------|--------|
| GET    | /                             | Admin  |
| POST   | /                             | Admin  |
| GET    | /:userId                      | Auth   |
| PATCH  | /:userId                      | Admin  |
| POST   | /:userId/reset-password       | Admin  |
| DELETE | /:userId                      | Admin  |
| GET    | /:userId/games                | Auth   |
| GET    | /:userId/submissions          | Auth   |
| GET    | /:userId/attempts             | Auth   |
| POST   | /eliminate                    | Admin  |
| POST   | /declare-winner               | Admin  |
| GET    | /eliminations/:gameId         | Admin  |

---

## Frontend Pages

| Page                  | Route              | Description                            |
|-----------------------|--------------------|----------------------------------------|
| Landing Page          | /                  | Game info, CTA, game status            |
| Player Login          | /login             | Secure login form                      |
| Admin Login           | /admin/login       | Separate admin portal                  |
| Player Dashboard      | /dashboard         | Status, challenge card, announcements  |
| Challenge Page        | /challenge/:id     | Briefing → Timer → Puzzle → Result     |
| Admin Dashboard       | /admin/*           | Full management panel (6 tabs)         |

---

## Environment Variables

### Backend (`backend/.env`)
```
MONGODB_URI=         MongoDB Atlas connection string
JWT_SECRET=          Long random secret (32+ chars)
JWT_EXPIRES_IN=7d    Token expiry
PORT=5000            Server port
CLIENT_URL=          Frontend URL (for CORS)
GROUP_LINK=          WhatsApp group URL
NODE_ENV=development
ADMIN_SECRET=        Secret used to create the first admin account
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_NAME=SURVIVAL
```

---

## How to Run

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 3. Start Backend
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

### 4. Start Frontend
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

### 5. Connect MongoDB Atlas
The `MONGODB_URI` in `backend/.env` already contains your Atlas connection string.
The backend will connect automatically on startup.

---

## First Admin Account

Create your first admin account by calling:

```
POST http://localhost:5000/api/auth/register-admin
Content-Type: application/json

{
  "username": "admin",
  "displayName": "Game Admin",
  "email": "admin@yourdomain.com",
  "password": "your_secure_password",
  "adminSecret": "YOUR_ADMIN_SECRET_FROM_ENV"
}
```

The `adminSecret` value comes from `ADMIN_SECRET` in `backend/.env`.

You can do this via Postman, curl, or the browser console. After creating the admin, log in at `/admin/login`.

---

## Test Player Account

Create a player either via admin panel (Players → Add Player) or:

```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "player1",
  "displayName": "Test Player",
  "email": "player1@test.com",
  "password": "password123"
}
```

Log in at `/login`.

---

## Phase 1 — What is Complete

✅ Secure authentication (JWT, bcrypt, admin/player roles)  
✅ MongoDB Atlas models (9 models, clean relationships)  
✅ Game management (create, activate, pause, end)  
✅ 7-day configuration (per-day start/end times, elimination counts)  
✅ Player management (create, enroll, reset password, deactivate)  
✅ Challenge system (create, configure, activate, open/close)  
✅ Server-side timer (deadline stored on server, client uses it for display)  
✅ Timer persistence (refresh/reconnect restores remaining time correctly)  
✅ Puzzle engine (per-player seeded variants — TEST_CHALLENGE + SEQUENCE_PUZZLE)  
✅ No answer keys sent to browser  
✅ Server-side answer validation  
✅ Late submission rejection  
✅ Auto-submit on timer expiry  
✅ Paste disabled on answer inputs  
✅ Elimination logic (lowest score, tie broken by slowest time)  
✅ Winner declaration  
✅ Announcements system (draft + publish)  
✅ Socket.IO real-time (challenge open/close, announcements, eliminations)  
✅ Player statuses (ACTIVE → ELIMINATED → FINALIST → WINNER)  
✅ Group discussion button (WhatsApp link from env var)  
✅ Admin dashboard (6 tabs: Overview, Games, Players, Challenges, Results, Announcements)  
✅ Player dashboard (status, challenge card, countdown, announcements)  
✅ Rate limiting  
✅ CORS, Helmet, input validation (Zod)  
✅ Responsive design (mobile-first Tailwind)  
✅ Dark survival visual theme  

---

## Phase 2 — What Remains

- Additional puzzle types (visual puzzles, arrangement, code-breaking, etc.)
- Tie-breaker secondary challenge flow
- Email notifications for eliminations
- Game reset / test mode
- Audit log for admin actions
- Player submission history page
- Public results reveal (admin toggles what is visible)
- Day-by-day score chart
- Final leaderboard page
- Production deployment configuration
