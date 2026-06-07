# syntax = docker/dockerfile:1

# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Public build arguments inlined by Astro at build time.
# Passed via --build-arg from the deploy workflow or fly deploy CLI.
# If absent (e.g. fork build), analytics is silently omitted.
ARG PUBLIC_POSTHOG_KEY
ARG PUBLIC_POSTHOG_HOST
ARG PUBLIC_POSTHOG_UI_HOST
ARG PUBLIC_ANALYTICS_ALLOWED_HOSTS
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY

ENV PUBLIC_POSTHOG_KEY=$PUBLIC_POSTHOG_KEY
ENV PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST
ENV PUBLIC_POSTHOG_UI_HOST=$PUBLIC_POSTHOG_UI_HOST
ENV PUBLIC_ANALYTICS_ALLOWED_HOSTS=$PUBLIC_ANALYTICS_ALLOWED_HOSTS
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY

RUN npm install -g pnpm@10

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Runtime stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 8080; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    port_in_redirect off; \
    absolute_redirect off; \
    \
    location / { \
        try_files $uri $uri/index.html /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080