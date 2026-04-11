FROM node:24.11.1-alpine3.22 AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

FROM node:24.11.1-alpine3.22 AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm run build

FROM node:24.11.1-alpine3.22 AS runner
RUN apk add --no-cache libc6-compat su-exec
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3417
ENV DATABASE_URL=file:/data/reposhare.db

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /app /data \
 && chown -R nextjs:nodejs /app /data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3417

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3417}/api/health`).then((res)=>res.ok?res.json().then((body)=>body.ok?process.exit(0):process.exit(1)):process.exit(1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
