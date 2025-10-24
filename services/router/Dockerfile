FROM caddy:2.10.2-alpine AS base

# Development stage
FROM base AS development
# nothing to do

# Production stage
FROM base AS production
COPY ./src/Caddyfile /etc/caddy/Caddyfile
RUN sed -i 's/http/https/g' /etc/caddy/Caddyfile
