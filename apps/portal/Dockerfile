# syntax=docker/dockerfile:1
# Build from the monorepo root: docker build -f apps/portal/Dockerfile .

FROM node:22.12-alpine AS deps
WORKDIR /app
COPY . .
RUN npm ci

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL=http://api:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=portal

FROM node:22.12-alpine AS runner
WORKDIR /app/apps/portal
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3006

COPY --from=builder --chown=node:node /app/apps/portal/.next/standalone /app
COPY --from=builder --chown=node:node /app/apps/portal/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/apps/portal/public ./public

USER node
EXPOSE 3006

CMD ["node", "server.js"]
