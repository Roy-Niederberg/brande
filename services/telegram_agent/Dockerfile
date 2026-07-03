FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS base

WORKDIR /app
# The agent SDK pulls a musl-native Claude Code binary via optional deps, but its
# bundled ripgrep has had musl issues historically — apk's rg is cheap insurance.
RUN apk add --no-cache ripgrep libgcc libstdc++
ENV USE_BUILTIN_RIPGREP=0
COPY ./src/package*.json ./

# Development stage
FROM base AS development
RUN npm ci
ENV NODE_ENV=development
CMD ["npx", "nodemon", "--watch", "src", "src/server.js"]

# Production stage — the agent SDK is a runtime dep, so npm ci here too
FROM base AS production
RUN npm ci --omit=dev
COPY ./src/server.js ./src/
ENV NODE_ENV=production
CMD ["node", "./src/server.js"]
