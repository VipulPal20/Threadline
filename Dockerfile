# Threadline: production image.
# Build:  docker build -t threadline .
# Run:    docker compose up --build   (see docker-compose.yml; SESSION_SECRET and DATABASE_URL are required)

FROM node:22-alpine AS base
# openssl is needed by Prisma's query engine on Alpine.
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
# The build never touches a real database; this only satisfies Prisma's env lookup.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Keep only what runs the app. Prisma stays because the container applies migrations on start.
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    RESUME_DIR="/data/resumes"
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.mjs ./next.config.mjs
# /data holds uploaded résumés. Mount a volume here to keep them. The database is PostgreSQL, set with DATABASE_URL.
RUN mkdir -p /data/resumes && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
# Apply any new migrations, then start. The app refuses to run in production without SESSION_SECRET.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx next start -H 0.0.0.0 -p ${PORT}"]
