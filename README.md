# Padalu

Padalu turns speech in short videos and audio into editable, word-timed captions. It supports Indian languages, Roman-script styles such as Hinglish and Tenglish, native scripts, cue editing, caption styling, and video or subtitle exports.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `frontend/` | The current Next.js application: marketing pages, sign-in, editor, timeline, transcript, styling, and browser-side state. |
| `backend/` | FastAPI API, database models, authentication, project/media handling, transcription, segmentation, and export jobs. |
| `docs/` | Architecture notes and contributor workflow. |
| `app/`, `store/`, and root Node configuration | Earlier root-level Next.js prototype retained in the repository. The active application and normal development commands are under `frontend/`. |

See [the architecture guide](docs/architecture.md) for module responsibilities and data flow.

## Requirements

- Node.js and npm
- Python 3.11 or newer (the backend dependencies are listed in `backend/requirements.txt`)
- FFmpeg available on `PATH` for media processing and exports
- API credentials for the transcription or text services selected in the backend settings

## Run locally on Windows

Open two PowerShell terminals from the repository root.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Add provider credentials to backend/.env as needed.
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

The API health endpoint is `/health` on the backend address configured for the deployment.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app runs on the Next.js development server. Set `NEXT_PUBLIC_API_URL` in the frontend environment to the backend address (for local development, `http://localhost:8000`; for Vercel, the public Render service URL).

### Deployment

- Render: create a Docker web service with `backend/Dockerfile`; set the backend environment variables listed in `backend/.env.example`. Set `PORT` through Render, configure `ALLOWED_ORIGINS` with the Vercel site origin, and use `/health` for the health check.
- Vercel: set the root directory to `frontend`, use `npm run build`, and provide `NEXT_PUBLIC_API_URL` with the public Render service URL. Next.js manages its own output directory.

## Checks

Run these from `frontend/`:

```powershell
npx tsc --noEmit
npm test
npm run lint
```

Run backend tests from `backend/`:

```powershell
.venv\Scripts\python -m pytest
```

## Configuration and secrets

Backend configuration is defined in `backend/app/core/settings.py`; example values live in `backend/.env.example`. Keep credentials in the ignored `backend/.env` file and never commit it. The frontend's shared product metadata is defined in `frontend/lib/brand.ts`.

## Current scope

The frontend supports subtitle generation, timeline and transcript editing, per-word caption preview, style customization, project management, and export flows. The backend provides the corresponding project, cue, authentication, transcription, and export-job APIs. Feature availability depends on local FFmpeg setup and configured provider credentials.
