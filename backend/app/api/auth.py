import base64
import hashlib
import hmac
import json
import logging
import secrets
import threading
import time
import uuid
from datetime import datetime
from urllib.parse import urlencode, urlparse

# Use Windows' trusted root certificates for outbound Google requests. The
# default bundled CA list may not include certificates installed in Windows.
import truststore

truststore.inject_into_ssl()

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db import SessionLocal
from app.models import Project, User

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)
SESSION_COOKIE = "captionkit_session"
FLOW_COOKIE = "captionkit_oauth_flow"
SESSION_SECONDS = 30 * 24 * 60 * 60
FLOW_SECONDS = 10 * 60
_rate_lock = threading.Lock()
_rate_hits: dict[str, list[float]] = {}


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _sign(payload: dict) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    message = f"{header}.{body}".encode()
    signature = _b64(hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).digest())
    return f"{header}.{body}.{signature}"


def _read_signed(token: str | None, expected_type: str) -> dict | None:
    if not token:
        return None
    try:
        header, body, signature = token.split(".")
        message = f"{header}.{body}".encode()
        expected = _b64(hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(_unb64(body))
        if payload.get("typ") != expected_type or int(payload.get("exp", 0)) <= int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def _secure_cookie(request: Request) -> bool:
    return request.url.hostname not in {"localhost", "127.0.0.1", "::1"}


def _set_session(response: Response, request: Request, user_id: str) -> None:
    now = int(time.time())
    token = _sign({"typ": "session", "sub": user_id, "iat": now, "exp": now + SESSION_SECONDS})
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_SECONDS, httponly=True, secure=_secure_cookie(request), samesite="lax", path="/")


def _rate_limit(request: Request, route: str) -> None:
    key = f"{route}:{request.client.host if request.client else 'unknown'}"
    now = time.monotonic()
    with _rate_lock:
        recent = [hit for hit in _rate_hits.get(key, []) if now - hit < 60]
        if len(recent) >= 20:
            raise HTTPException(status_code=429, detail="Please wait a moment before trying again")
        recent.append(now)
        _rate_hits[key] = recent


def _safe_next(value: str | None) -> str:
    candidate = value or "/"
    if not candidate.startswith("/") or candidate.startswith("//") or "\\" in candidate or urlparse(candidate).netloc:
        raise HTTPException(status_code=400, detail="Invalid next path")
    return candidate


def owned_project(db: Session, project_id: str, user: User) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_current_user(request: Request, response: Response) -> User:
    payload = _read_signed(request.cookies.get(SESSION_COOKIE), "session")
    if payload is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    with SessionLocal() as db:
        user = db.get(User, payload.get("sub"))
        if user is None:
            raise HTTPException(status_code=401, detail="Sign in required")
        if int(payload.get("exp", 0)) - int(time.time()) < SESSION_SECONDS // 2:
            _set_session(response, request, user.id)
        return user


@router.get("/google/login")
def google_login(request: Request, next: str = "/"):
    _rate_limit(request, "login")
    next_path = _safe_next(next)
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = _b64(hashlib.sha256(verifier.encode()).digest())
    now = int(time.time())
    flow = _sign({"typ": "oauth_flow", "state": state, "nonce": nonce, "verifier": verifier, "next": next_path, "iat": now, "exp": now + FLOW_SECONDS})
    callback = f"{settings.BACKEND_URL.rstrip('/')}/auth/google/callback"
    query = urlencode({"client_id": settings.GOOGLE_CLIENT_ID, "redirect_uri": callback, "response_type": "code", "scope": "openid email profile", "state": state, "nonce": nonce, "code_challenge": challenge, "code_challenge_method": "S256", "prompt": "select_account"})
    response = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{query}", status_code=302)
    response.set_cookie(FLOW_COOKIE, flow, max_age=FLOW_SECONDS, httponly=True, secure=_secure_cookie(request), samesite="lax", path="/auth/google")
    return response


@router.get("/google/callback")
async def google_callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    _rate_limit(request, "callback")
    if error == "access_denied":
        response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=cancelled", status_code=302)
        response.delete_cookie(FLOW_COOKIE, path="/auth/google")
        return response
    flow = _read_signed(request.cookies.get(FLOW_COOKIE), "oauth_flow")
    if not flow or not state or not hmac.compare_digest(str(flow.get("state", "")), state):
        response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=invalid_state", status_code=302)
        response.delete_cookie(FLOW_COOKIE, path="/auth/google")
        return response
    if not code:
        response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=missing_code", status_code=302)
        response.delete_cookie(FLOW_COOKIE, path="/auth/google")
        return response
    stage = "token_exchange"
    try:
        callback = f"{settings.BACKEND_URL.rstrip('/')}/auth/google/callback"
        async with httpx.AsyncClient(timeout=12) as client:
            token_response = await client.post("https://oauth2.googleapis.com/token", data={
                "code": code, "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET, "redirect_uri": callback,
                "grant_type": "authorization_code", "code_verifier": flow["verifier"],
            })
        token_data = token_response.json()
        if not token_response.is_success:
            google_error = token_data.get("error") if isinstance(token_data, dict) else None
            if google_error == "invalid_client":
                failure_code = "oauth_config"
            elif google_error == "invalid_grant":
                failure_code = "oauth_code"
            else:
                failure_code = "oauth_failed"
            safe_google_error = google_error if google_error in {"invalid_client", "invalid_grant", "unauthorized_client", "redirect_uri_mismatch"} else "unknown"
            logger.warning("Google OAuth token exchange rejected (%s)", safe_google_error)
            response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error={failure_code}", status_code=302)
            response.delete_cookie(FLOW_COOKIE, path="/auth/google")
            return response
        stage = "identity_verification"
        claims = id_token.verify_oauth2_token(token_data["id_token"], GoogleRequest(), settings.GOOGLE_CLIENT_ID)
        if claims.get("nonce") != flow.get("nonce") or claims.get("email_verified") not in (True, "true"):
            logger.warning("Google OAuth identity verification rejected claims")
            response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=identity_check", status_code=302)
            response.delete_cookie(FLOW_COOKIE, path="/auth/google")
            return response
        now = datetime.utcnow()
        stage = "user_update"
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.google_sub == claims["sub"]))
            if user is None:
                user = User(id=str(uuid.uuid4()), google_sub=claims["sub"], email=claims["email"], name=claims.get("name", ""), picture=claims.get("picture"), credits=settings.FREE_INITIAL_CREDITS, created_at=now, last_login_at=now)
                db.add(user)
            else:
                user.email = claims["email"]
                user.name = claims.get("name", "")
                user.picture = claims.get("picture")
                user.last_login_at = now
            db.commit()
            user_id = user.id
        destination = _safe_next(str(flow.get("next", "/")))
        response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}{destination}", status_code=302)
        _set_session(response, request, user_id)
        response.delete_cookie(FLOW_COOKIE, path="/auth/google")
        return response
    except httpx.RequestError as exc:
        logger.warning("Google OAuth failed during %s (%s)", stage, type(exc).__name__)
        response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=oauth_unavailable", status_code=302)
        response.delete_cookie(FLOW_COOKIE, path="/auth/google")
        return response
    except Exception as exc:
        logger.warning("Google OAuth failed during %s (%s)", stage, type(exc).__name__)
        response = RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=oauth_failed", status_code=302)
        response.delete_cookie(FLOW_COOKIE, path="/auth/google")
        return response


@router.get("/me")
def auth_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "picture": user.picture, "credits": user.credits}


@router.post("/logout")
def auth_logout():
    response = Response(content=json.dumps({"logged_out": True}), media_type="application/json")
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(FLOW_COOKIE, path="/auth/google")
    return response
