FROM node:20 AS base
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY .swcrc ./
COPY locales ./locales

FROM base AS builder
COPY src /usr/src/app/src
RUN npm run build

FROM node:20-slim AS production
LABEL org.opencontainers.image.description "ActivityRank's Bot module"
ENV NODE_ENV=production
USER node
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/locales ./locales
