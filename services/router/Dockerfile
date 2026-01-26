FROM caddy:2.10.2-alpine AS base

# Development stage
FROM base AS development
COPY ./src/Caddyfile /etc/caddy/Caddyfile
RUN caddy fmt --overwrite /etc/caddy/Caddyfile

# Production stage
FROM base AS production
COPY ./src/Caddyfile /etc/caddy/Caddyfile
RUN caddy fmt --overwrite /etc/caddy/Caddyfile && \
    sed -i 's/http/https/g' /etc/caddy/Caddyfile
