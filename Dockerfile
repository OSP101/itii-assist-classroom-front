FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ARG NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN [ -f .env.local ] || touch .env.local
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env.local ./.env.local
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=deps /app/node_modules ./node_modules

RUN chmod -R a+rX /app/.next /app/public /app/node_modules
USER node

EXPOSE 3000

CMD ["npm", "run", "start"]
