FROM caddy:2.10.2-builder-alpine@sha256:4cff3ae272ea05842adb4546e35961e4947aeea65f80fa1eb62a35b960e84971 AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d AS base
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Production stage
FROM base AS production
COPY ./src/Caddyfile /etc/caddy/Caddyfile
RUN caddy fmt --overwrite /etc/caddy/Caddyfile
CMD CLOUDFLARE_API_TOKEN=$(cat /run/secrets/cloudflare_api_token) caddy run --config /etc/caddy/Caddyfile
