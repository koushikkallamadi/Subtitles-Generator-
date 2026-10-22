# CaptionKit

AI subtitle generator and editor for short videos (reels) with strong Indian language support (Telugu, Hindi, Tamil, Marathi, Urdu, English). Users upload a video, pick the spoken language and a style (Roman letters like Tenglish/Hinglish, or native script), and get editable subtitles on a timeline.

## Stack
- Frontend: Next.js 14 (App Router, TypeScript, Tailwind, Zustand) in /frontend
- Backend: FastAPI + SQLite in /backend
- Windows machine, no Docker, no Redis.

## Run
- Frontend: `cd frontend` then `npm run dev` (http://localhost:3000)
- Backend: `cd backend` then `.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000`
- Type check: `cd frontend` then `npx tsc --noEmit`

## How subtitles are made
video -> ffmpeg audio -> Sarvam (main speech to text) with Groq Whisper as backup -> Groq chat model converts to Roman letters when the Roman style is chosen -> segmentation into cues (max words per line, lines per subtitle) -> cues shown on the timeline and as a live overlay on the video.
Provider settings are in backend/.env (TRANSCRIPTION_PROVIDER, ROMANIZATION_MODEL).

## Done
Home page, editor (video player, transport bar, timeline, Generate panel), subtitle generation, cues on the timeline and overlay, timing offset in the store, basic Transcript tab.

## Not done yet
Transcript tab polish, saving projects in a database (a refresh loses the video), History drawer, Style and export (SRT/VTT and burned-in video), credits and the 4 minute free limit, translation, final UI polish.

## Rules
- Do NOT change anything outside the files the task names. Keep changes small.
- Do NOT change the UI design, timeline, transport bar or home page unless the task says so.
- Never print, log, edit or commit secrets. API keys live only in backend/.env.
- Do not open a browser to test. Run `npx tsc --noEmit`, then show `git diff --stat` and name the files you changed.
- Say clearly what you did NOT finish. Never claim something works unless you ran it.
- UI polish comes last. Functionality first.
- Use small components and keep state in the existing Zustand store.