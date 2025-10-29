FROM node:22-alpine  AS base

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
COPY ./src/server ./src/
ENV NODE_ENV=production
RUN rm package*.json
CMD ["node", "src/server.js"]
