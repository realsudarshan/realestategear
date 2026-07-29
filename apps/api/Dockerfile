# syntax=docker/dockerfile:1
# Build from monorepo root: docker build -f apps/api/Dockerfile .

FROM node:22.12-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY . .
RUN npm ci

FROM base AS builder
COPY --from=deps /app /app
RUN npm run build --workspace=db

FROM node:22.12-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat

RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001

COPY --from=builder --chown=api:nodejs /app /app

USER api

ENV API_PORT=3001
EXPOSE 3001

CMD ["npm", "start", "--workspace=api"]
