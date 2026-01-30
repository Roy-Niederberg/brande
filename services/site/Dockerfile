FROM caddy:2.10.2-alpine AS base

# Development stage
FROM base AS development
COPY ./src/Caddyfile /etc/caddy/Caddyfile #todo: remove this
COPY ./public/widget.js /widget/widget.js #todo: remove this

# Production stage
FROM base AS production
COPY ./src/Caddyfile /etc/caddy/Caddyfile
COPY ./public/widget.js /widget/widget.js
