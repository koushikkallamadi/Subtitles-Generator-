# CaptionKit

**AI subtitle generator + editor for short videos (reels)**

## Overview
CaptionKit lets you upload a short video (or audio), automatically generates word‑level timestamps, offers romanisation/translation for Indian languages, lets you edit cues on a timeline, style the subtitles, and export them as SRT/VTT, green‑screen MP4, or a fully burned‑in video.

### Tech stack
- **Frontend** – Next.js (App Router) + TypeScript + Tailwind CSS + Zustand (dark theme, coral accent `#E0725F`).
- **Backend** – FastAPI (Python) + SQLite (dev) / PostgreSQL (prod) + SQLAlchemy. Background jobs use FastAPI `BackgroundTasks`.
- **Media** – FFmpeg (must be installed on the system). Used for audio extraction, waveform generation, and final video rendering.
- **Transcription** – Abstract `TranscriptionProvider` with two implementations:
  1. **Groq/OpenAI Whisper API** (default, needs an API key).
  2. **Local `faster‑whisper`** fallback (no key).
- **Romanisation / Translation** – LLM abstraction (`TranslationProvider`). Defaults to Gemini API; can be swapped.
- **Auth** – Google Sign‑In via NextAuth + a "continue as guest" mode for local dev.

## Getting started (Windows)
1. **Install FFmpeg** – open PowerShell and run:
   ```powershell
   winget install -e --id Gyan.FFmpeg
   ```
   Verify with `ffmpeg -version`.
2. **Clone the repo** (or copy the generated files into a folder).
3. **Backend**
   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   # copy .env.example to .env and fill in keys you have (Groq, Gemini). For dev you can leave them empty.
   uvicorn app.main:app --reload
   ```
   The API will be available at `http://127.0.0.1:8000`.
4. **Frontend**
   ```powershell
   cd frontend
   npm install
   # copy .env.example to .env (only NEXT_PUBLIC_BACKEND_URL is required)
   npm run dev
   ```
   Open `http://localhost:3000` in a browser.
5. **Try the sample** – the "Try a sample" button loads a bundled 6‑second video with pre‑generated cues, so you can explore the editor without any API keys.

## Environment variables (`.env.example`)
```
# ---------- Backend ----------
# FastAPI secret key (any random string)
SECRET_KEY=super-secret-key
# Database URL – dev uses SQLite automatically
DATABASE_URL=sqlite:///./captionkit.db
# FFmpeg binary path (optional, defaults to "ffmpeg" on PATH)
FFMPEG_PATH=ffmpeg

# Transcription provider – "groq", "openai" or "local"
TRANSCRIPTION_PROVIDER=local
# Groq / OpenAI API key (optional if you use local provider)
GROQ_API_KEY=
OPENAI_API_KEY=

# Translation provider – "gemini" (default) or "openai"
TRANSLATION_PROVIDER=gemini
GEMINI_API_KEY=

# Credits configuration
FREE_MAX_SECONDS=240
FREE_INITIAL_CREDITS=24
CREDIT_COST_PER_MINUTE=1
TRANSLATION_COST_PER_MINUTE=0.5

# ---------- Frontend ----------
# URL of the backend API
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
# Google OAuth client ID (optional for dev you can skip – guest mode works)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

## Running tests
```powershell
# Backend tests
cd backend
pytest
# Frontend tests
cd ../frontend
npm test
```

## What’s missing / TODO
- Real payment integration (Razorpay) – stubbed.
- Production Docker compose (optional, kept for reference).
- Full unit‑test coverage for all edge cases.
- Polish UI micro‑animations (basic hover effects are included).

---

Enjoy building subtitles with CaptionKit! 🎬📝
