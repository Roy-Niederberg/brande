FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS base

WORKDIR /app
COPY ./src/package*.json ./

# Development stage
FROM base AS development
RUN npm ci
ENV NODE_ENV=development
CMD ["npx", "nodemon", "--watch", "src", "src/server.js"]

# Production stage
FROM base AS production
RUN npm ci --production
COPY ./src/server.js ./src/
ENV NODE_ENV=production
RUN rm package*.json
CMD ["node", "src/server.js"]
