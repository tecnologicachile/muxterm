# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install build dependencies
RUN npm ci
RUN cd client && npm ci

# Copy source
COPY . .

# Build client (optimized)
RUN cd client && npm run build

# Production stage
FROM node:18-alpine

# Install runtime dependencies only
RUN apk add --no-cache tmux

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production && npm cache clean --force

# Copy built application
COPY --from=builder /app/client/dist ./client/dist
COPY server ./server
COPY db ./db
COPY utils ./utils
COPY .tmux.webssh.conf ./
COPY update.sh ./

# Create directories
RUN mkdir -p data logs sessions && \
    adduser -D -s /bin/sh muxterm && \
    chown -R muxterm:muxterm /app

USER muxterm

EXPOSE 3002

VOLUME ["/app/data", "/app/logs", "/app/sessions"]

CMD ["node", "server/index.js"]