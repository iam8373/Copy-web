# syntax=docker/dockerfile:1
# Production image for Railway (D-025): Next.js standalone server on Node 22,
# non-root, listening on $PORT (Railway injects it) on 0.0.0.0.
#
# Build-time inputs are ONLY public values: Next inlines NEXT_PUBLIC_* into the
# browser bundle during `next build`, and two flags read at build time.
# Server secrets (SUPABASE_SECRET_KEY, AUTH_COOKIE_SECRET, GEMINI_*) are
# runtime variables and are deliberately NOT declared as ARGs here.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The supabase CLI (devDependency) is not needed to build the app.
RUN npm ci --no-audit --no-fund --ignore-scripts

FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_REALTIME
ARG EMAIL_OTP_ENABLED=false
ARG ALLOW_INDEXING=false
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_REALTIME=$NEXT_PUBLIC_SUPABASE_REALTIME \
    EMAIL_OTP_ENABLED=$EMAIL_OTP_ENABLED \
    ALLOW_INDEXING=$ALLOW_INDEXING \
    NEXT_OUTPUT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# server.js reads PORT and HOSTNAME from the environment.
CMD ["node", "server.js"]
