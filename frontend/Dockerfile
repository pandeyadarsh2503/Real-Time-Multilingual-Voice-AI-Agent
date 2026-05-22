# ──────────────────────────────────────────────────────────────────────────────
# SwasthyaAI — Frontend Dockerfile
# React + Vite → served by Nginx
# Two-stage build: (1) node builder, (2) nginx static server
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci --silent

# Copy source and build
COPY . .

# VITE_API_URL tells the frontend where the backend lives.
# When using docker-compose this defaults to the backend service name.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config: enables SPA fallback (serves index.html for unknown routes)
# and reverse-proxies /api/* calls to the backend service.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
