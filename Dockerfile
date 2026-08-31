# Build context for this Dockerfile is THIS directory (the frontend repo root).
#
# It briefly used the parent `webapp/` directory as context so it could COPY the
# sibling MANUAL_GUIDE_TH/MANUAL_GUIDE_EN folders that /docs/* reads. That could
# never work on a deploy host: `webapp/` is not a git repo (only
# itii-assist-classroom-front/, itii-assist-classroom-back/ and deploy-vm-https/
# are), so neither those folders nor a root .dockerignore ever shipped there.
# The manual sources now live in ./content/manuals/{th,en} inside this repo.

FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ARG NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
# Unique per deploy: appends ?dpl=<id> to every static asset URL so the KKU
# reverse proxy's per-URL rate counters reset on each deploy (cache busting).
ARG NEXT_DEPLOYMENT_ID=""
# Origin that serves /_next/static/* (see next.config.ts). Empty keeps assets
# on the page's own origin. Build-time only — Next.js bakes it into every
# asset URL, so switching it means a rebuild.
ARG NEXT_PUBLIC_ASSET_PREFIX=""
# Origin pinned into student-facing links/QRs (check-in, queue booking,
# display pairing) — see lib/app-url.ts. Build-time only, like
# NEXT_PUBLIC_ASSET_PREFIX above.
ARG NEXT_PUBLIC_STUDENT_LINK_ORIGIN=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
ENV NEXT_PUBLIC_ASSET_PREFIX=$NEXT_PUBLIC_ASSET_PREFIX
ENV NEXT_PUBLIC_STUDENT_LINK_ORIGIN=$NEXT_PUBLIC_STUDENT_LINK_ORIGIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN [ -f .env.local ] || touch .env.local
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ARG NEXT_DEPLOYMENT_ID=""
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# lib/docs.server.ts readdirSync/readFileSync these at REQUEST time, so Next's
# standalone output tracing does not pull them in — they must be copied.
COPY --from=builder /app/content ./content

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "server.js"]
