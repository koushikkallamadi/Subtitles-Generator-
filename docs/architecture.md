# Architecture and code map

## Application boundaries

Padalu is a small two-service application. Keep browser and media-provider responsibilities on their existing sides of the API boundary.

```text
Browser
  frontend/ (Next.js App Router)
      | HTTP / JSON, cookies, media upload and download
      v
  backend/ (FastAPI)
      | SQLAlchemy
      v
  configured database

Backend media flow: upload -> stored media -> transcription job -> cues -> editor
Export flow: project + cues + style -> export job -> downloadable artifact
```

## Frontend map

```text
frontend/
  app/                 Routes and route-level composition
  components/          Shared UI, grouped by feature
    brand/             Brand presentation elements
    generate/          Generation panel pieces
    style/             Caption renderer, presets, fine-tuning, and export UI
  lib/                 API clients, domain helpers, brand metadata, and unit tests
  store/               Shared Zustand application state
```

- `app/editor/page.tsx` coordinates the editor and project state.
- `components/Timeline.tsx`, `TransportBar.tsx`, `TranscriptTab.tsx`, and `CueCard.tsx` own the primary editing surfaces.
- `components/style/CaptionRenderer.tsx` is the shared caption renderer used by preview surfaces.
- `lib/projects.ts` contains the frontend API boundary; keep request and response mapping there.
- `store/videoStore.ts` owns shared client state. Keep feature-specific transient UI state local to the component that uses it.
- `lib/brand.ts` is the single source for product identity and public-facing metadata.

## Backend map

```text
backend/app/
  api/                 HTTP routes and request handling
  core/                Application settings
  services/            Transcription, segmentation, media, jobs, and export logic
    transcription/     Provider interfaces and provider-specific adapters
  db.py                SQLAlchemy engine and session setup
  models.py            Persistent data models
  main.py              FastAPI application composition and startup hooks
backend/scripts/       Developer and provider-analysis utilities
backend/tests/         Backend tests
```

Route handlers should stay thin: validate and authorize requests, call service functions, and map results to API responses. Provider-specific logic belongs in `services/transcription/`; shared cue construction belongs in `services/segmentation.py`.

## Development conventions

- Treat `frontend/` and `backend/` as the canonical application roots. Root-level `app/`, `store/`, and Node configuration are a retained earlier prototype and are not used by the documented run commands.
- Prefer feature-based component grouping where a feature already has a directory; avoid creating broad catch-all utility folders.
- Keep shared data shapes near the domain helper or API boundary that defines them. Avoid duplicating API mapping logic across UI components.
- Add focused unit tests next to pure frontend domain helpers (`*.test.mjs`) and backend tests under `backend/tests/`.
- Keep generated files, local media, databases, virtual environments, and secrets out of version control.

## Local checks

Run frontend checks from `frontend/`:

```powershell
npx tsc --noEmit
npm test
npm run lint
```

Run backend tests from `backend/`:

```powershell
.venv\Scripts\python -m pytest
```
