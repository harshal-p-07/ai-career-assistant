# ⚡ AI Career Assistant — Phase 1

> AI-powered Resume Analyzer with ATS scoring, skill gap analysis, and personalized improvement suggestions.

Built with: **React + Node.js + Express + MongoDB + Gemini/Groq AI**

---

## 🚀 Quick Start

### 1. Clone / open the project
```
ai-career-assistant/
├── server/   ← Node.js + Express backend
└── client/   ← React frontend
```

---

### 2. Backend Setup

```bash
cd server
npm install
```

Edit `.env` file:
```env
# Switch AI provider here — "gemini" or "groq"
AI_PROVIDER=gemini

GEMINI_API_KEY=your_key_from_aistudio.google.com
GROQ_API_KEY=your_key_from_console.groq.com

MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=any_random_long_string
```

Start backend:
```bash
npm run dev
```
Server runs on: http://localhost:5000

---

### 3. Frontend Setup

```bash
cd client
npm install
npm run dev
```
App runs on: http://localhost:5173

---

## 🔑 Getting Free API Keys

| Service | Link | Free Limit |
|---------|------|------------|
| Gemini (recommended) | https://aistudio.google.com | 1,500 req/day |
| Groq (fastest) | https://console.groq.com | 14,400 req/day |
| MongoDB Atlas | https://mongodb.com/atlas | 512MB free |

---

## 🔄 Switching Between Gemini and Groq

Just change ONE line in `server/.env`:

```env
AI_PROVIDER=gemini   # use Google Gemini
AI_PROVIDER=groq     # use Groq (Llama 3.1 70B)
```

Restart server. That's it. No code changes needed.

---

## 📁 Project Structure

```
server/
├── index.js                  # Express app entry point
├── .env                      # API keys (never commit this)
├── models/
│   ├── User.js               # User schema
│   └── Analysis.js           # Resume analysis schema
├── controllers/
│   ├── authController.js     # Register, login, getMe
│   └── resumeController.js   # Upload, analyze, history
├── routes/
│   ├── auth.js               # /api/auth/*
│   └── resume.js             # /api/resume/*
├── middleware/
│   └── auth.js               # JWT verification
└── services/
    └── aiService.js          # Gemini/Groq AI switcher

client/
├── src/
│   ├── App.jsx               # Routes
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx     # Upload page
│   │   └── Results.jsx       # Analysis results
│   └── services/
│       └── api.js            # Axios API calls
└── .env                      # VITE_API_URL
```

---

## 🔌 API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Login |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/resume/analyze | Yes | Upload + analyze PDF |
| GET | /api/resume/history | Yes | Past analyses |
| GET | /api/resume/:id | Yes | Single analysis |

---

## 🗺️ What's Next (Phase 2)

- [ ] Deep Research Agent (Serper API + web search)
- [ ] LangGraph memory (remembers past resumes)
- [ ] Mock interview Q&A
- [ ] DSA roadmap generator
- [ ] Vector DB for semantic resume search
