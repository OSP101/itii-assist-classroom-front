# Build context for this Dockerfile is the REPO ROOT (webapp/), not this
# directory — see the `context: ..`/`context: .` (+ `dockerfile:` pointing
# here) in every compose file that builds this service. This is required so
# the build can also COPY the sibling MANUAL_GUIDE_TH/MANUAL_GUIDE_EN
# directories that lib/docs.server.ts reads for /docs/* at both build time
# (generateStaticParams) and runtime. (We previously tried BuildKit's
# `additional_contexts` to avoid widening the primary context, but it
# resolved to an empty context under `docker compose`'s buildx-bake path on
# at least one deployment target — this plain single-context form is the
# universally-supported fallback.)

FROM node:22-alpine AS deps

WORKDIR /app
COPY itii-assist-classroom-front/package.json itii-assist-classroom-front/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ARG NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
# Unique per deploy: appends ?dpl=<id> to every static asset URL so the KKU
# reverse proxy's per-URL rate counters reset on each deploy (cache busting).
ARG NEXT_DEPLOYMENT_ID=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID

COPY --from=deps /app/node_modules ./node_modules
COPY itii-assist-classroom-front/ .
# lib/docs.server.ts reads these from `../MANUAL_GUIDE_TH`/`../MANUAL_GUIDE_EN`
# relative to process.cwd() (`/app` here and at runtime below), i.e.
# `/MANUAL_GUIDE_TH` and `/MANUAL_GUIDE_EN`. Needed at build time too:
# generateStaticParams() in app/docs/[slug]/page.tsx reads them during
# `npm run build`.
COPY MANUAL_GUIDE_TH /MANUAL_GUIDE_TH
COPY MANUAL_GUIDE_EN /MANUAL_GUIDE_EN
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
COPY --from=builder /MANUAL_GUIDE_TH /MANUAL_GUIDE_TH
COPY --from=builder /MANUAL_GUIDE_EN /MANUAL_GUIDE_EN

RUN chown -R node:node /app /MANUAL_GUIDE_TH /MANUAL_GUIDE_EN
USER node

EXPOSE 3000

CMD ["node", "server.js"]
