FROM node:22-alpine AS base
WORKDIR /app
COPY ./src/package*.json ./

# Development stage
FROM base AS development
RUN npm ci
ENV NODE_ENV=development
CMD ["npx", "nodemon", "--watch", "src", "--ignore", "sessions", "src/server.js"]

# Production stage
FROM base AS production
RUN npm install -g npm@latest
RUN npm ci --production
COPY ./src/views ./views
COPY ./src/public ./public
COPY ./src/server.js ./src/server.js
ENV NODE_ENV=production
RUN rm package*.json
CMD ["node", "src/server.js"]
