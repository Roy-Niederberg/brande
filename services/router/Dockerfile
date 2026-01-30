FROM caddy:2.10.2-builder-alpine AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.10.2-alpine AS base
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

FROM base AS production
COPY ./src/Caddyfile /etc/caddy/Caddyfile
RUN caddy fmt --overwrite /etc/caddy/Caddyfile
CMD CLOUDFLARE_API_TOKEN=$(cat /run/secrets/cloudflare_api_token) caddy run --config /etc/caddy/Caddyfile
