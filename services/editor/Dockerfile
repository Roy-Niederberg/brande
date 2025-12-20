FROM node:22-alpine AS base
WORKDIR /app
COPY ./src/package*.json ./

# Development stage
FROM base AS development
RUN npm install -g npm@latest
RUN npm ci
ENV NODE_ENV=development
CMD ["npx", "nodemon", "--watch", "src", "src/server.js"]

# Production stage
FROM base AS production
RUN npm install -g npm@latest
RUN npm ci --production
COPY ./src/views ./views
COPY ./src/server.js ./server.js
ENV NODE_ENV=production
RUN rm -f package*.json
CMD ["node", "server.js"]
