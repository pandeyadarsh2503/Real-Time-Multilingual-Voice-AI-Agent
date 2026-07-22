# SwasthyaAI — Deployment Guide

Two supported paths:

- **A. Single host (Docker Compose)** — one VPS, TLS + DB + Redis + optional TURN all in `docker-compose.prod.yml`. Simplest; fully self-contained. **Recommended to start.**
- **B. Managed platform** — Neon (Postgres) + Upstash (Redis) + a PaaS for the backend + a static host for the frontend.

Both need the same third-party accounts and the same Firebase setup.

---

## 0. Prerequisites (accounts you create)

| Service | Why | Free tier |
|---|---|---|
| **Firebase** | Authentication (email/password + Google) | Spark (free) |
| **Groq** | LLM (LLaMA-3.3-70B) | free tier |
| **Azure Speech** | Text-to-speech voices | free tier |
| A **domain** | TLS + Firebase authorized domain | — |
| A **host** (path A: any VPS with Docker; path B: Fly.io/Render) | runs the backend | varies |
| **Neon** (path B only) | managed Postgres | free tier |
| **Upstash** (path B only) | managed Redis | free tier |
| **coturn/TURN** (optional) | live WebRTC voice through strict NAT | self-host or managed |

> Exotel (outbound phone calls) is **optional and off by default** — the app runs fully without it.

---

## 1. Firebase setup (both paths)

1. [console.firebase.google.com](https://console.firebase.google.com) → create/select project.
2. **Build → Authentication → Sign-in method** → enable **Email/Password** and **Google**.
3. **Authentication → Settings → Authorized domains** → add your production domain (e.g. `swasthya.example.com`).
4. **Project settings → Your apps → Web app** → copy the config into the `VITE_FIREBASE_*` vars.
5. Note the **Project ID** — it goes in `backend/.env` as `FIREBASE_PROJECT_ID` (the backend verifies ID tokens against it; no service-account key needed).

---

## 2. Backend secrets — `backend/.env`

Copy `backend/.env.example` → `backend/.env` and set at minimum:

```
GROQ_API_KEY=...
AZURE_TTS_KEY=...
AZURE_TTS_REGION=eastus
FIREBASE_PROJECT_ID=your-project-id
ENVIRONMENT=production          # hides /docs, /openapi.json
AUTH_DISABLED=false             # never true in production
```

`DATABASE_URL`, `REDIS_URL`, `ALLOWED_ORIGINS`, `STUN_URL`, `TURN_*`, `WEB_CONCURRENCY`
are supplied by the deployment (compose or platform env), not this file.

---

## A. Single-host Docker Compose

On a VPS (2 vCPU / 2–4 GB RAM recommended; the Whisper model needs headroom) with Docker + Docker Compose, and DNS for your domain pointed at the host (ports **80/443** open):

```bash
git clone <repo> && cd <repo>
cp backend/.env.example backend/.env     # fill in secrets (section 2)
cp .env.prod.example .env                # fill in DOMAIN, POSTGRES_PASSWORD,
                                         # REDIS_PASSWORD, VITE_FIREBASE_*
docker compose -f docker-compose.prod.yml up -d --build
```

What happens:
- **Caddy** obtains a Let's Encrypt cert for `$DOMAIN` and serves HTTPS.
- **backend** waits for Postgres + Redis to be healthy, runs `alembic upgrade head` on boot, then serves under `uvicorn --workers ${WEB_CONCURRENCY}` as a non-root user.
- **frontend** is built with your Firebase config baked in and served by nginx (which also proxies `/api` → backend).

Verify:
```bash
curl -s https://$DOMAIN/api/../health          # {"status":"healthy"}   (via the host)
curl -s https://$DOMAIN/                        # SPA loads
docker compose -f docker-compose.prod.yml logs backend | grep -i "schema\|migrat"
```

### Using managed DB/Redis instead of the bundled ones
Set `DATABASE_URL=<Neon>` and `REDIS_URL=<Upstash>` in `.env` and remove the
`postgres` / `redis` services (and their `depends_on`) from the compose file.

### Live voice (TURN)
Push-to-talk voice (STT/TTS over HTTPS) works with **no** extra setup. The **live**
WebRTC mode additionally needs a TURN relay for users behind strict NAT:
1. Fill `deploy/turnserver.conf` (public IP + a TURN user/password).
2. Set `TURN_URLS/TURN_USERNAME/TURN_CREDENTIAL` **and** `VITE_TURN_*` in `.env` to match.
3. Open UDP/TCP **3478, 5349** and UDP **49160–49200** on the firewall.
4. Start it: `docker compose -f docker-compose.prod.yml --profile turn up -d`.

---

## B. Managed platform (Neon + Upstash + PaaS)

1. **Neon**: create a project → copy the **pooled** connection string → this is `DATABASE_URL` (append `?sslmode=require`).
2. **Upstash**: create a Redis database → copy the `rediss://…` URL → this is `REDIS_URL`.
3. **Backend** on Fly.io (`fly.toml` is included) or Render:
   - Set env: `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`, `AZURE_TTS_KEY`, `AZURE_TTS_REGION`, `FIREBASE_PROJECT_ID`, `ENVIRONMENT=production`, `ALLOWED_ORIGINS=https://<frontend-domain>`, `WEB_CONCURRENCY=2`, `STUN_URL`, and `TURN_*` if using TURN.
   - Fly.io: `fly launch --no-deploy` (reuses `fly.toml`), `fly secrets set KEY=val ...`, `fly deploy`. Migrations run automatically on boot.
4. **Frontend** on Cloudflare Pages / Render Static / Netlify:
   - Build command `npm run build`, output dir `dist`, root `frontend/`.
   - Build-time env: all `VITE_FIREBASE_*` (+ `VITE_STUN_URL`, `VITE_TURN_*` if used).
   - Add a redirect/proxy so `/api/*` → your backend URL (Cloudflare Pages: a `_redirects` rule or a Function; Netlify: `netlify.toml`), or set the app to call the backend origin directly and add that origin to `ALLOWED_ORIGINS`.
5. Add the frontend domain to Firebase **Authorized domains**.

---

## 3. Post-deploy smoke test (run against the live URL)

```bash
BASE=https://your-domain
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/doctors            # 401 (auth enforced)
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/appointments       # 401
curl -s $BASE/health                                                  # {"status":"healthy"} (backend)
# then in a browser: sign up, book an appointment, switch language, push-to-talk.
```
`/docs` and `/openapi.json` must return **404** in production (they do when `ENVIRONMENT=production`).

---

## 4. Operations

- **Health**: `GET /health` (liveness), `GET /health/ready` (checks DB + Redis — use for the orchestrator's readiness probe).
- **Metrics**: `GET /metrics` (Prometheus). Protect it by setting `METRICS_TOKEN` and scraping with `Authorization: Bearer <token>`.
- **Logs**: set `LOG_FORMAT=json` for structured logs; every request carries an `X-Request-ID`.
- **Retention**: conversation transcripts auto-prune after `MEMORY_RETENTION_DAYS` (default 30) — enforced at boot and every 24h.
- **Scaling**: `WEB_CONCURRENCY>1` is safe only with a real `REDIS_URL` (the in-process session store is per-worker).

---

## 5. Known limitations to accept before launch

- **Token revocation**: the backend verifies Firebase ID tokens against Google's public certs but does not call `check_revoked`. A disabled/deleted account's token stays valid until it expires (~1h). Acceptable for short-TTL tokens; add firebase-admin `verify_id_token(check_revoked=True)` if you need instant revocation.
- **Live WebRTC voice** requires TURN for many real networks (see above). Push-to-talk is the always-works fallback.
- **Exotel** outbound calling is architecture-only unless you complete Exotel KYC and wire real credentials; the app does not depend on it.
