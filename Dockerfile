FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tmux \
    git \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production
RUN cd client && npm ci --only=production

# Copy application files
COPY . .

# Build client
RUN cd client && npm run build

# Create data directories
RUN mkdir -p data logs sessions

# Create non-root user
RUN useradd -m -s /bin/bash muxterm && \
    chown -R muxterm:muxterm /app

USER muxterm

# Expose port
EXPOSE 3002

# Volume for persistent data
VOLUME ["/app/data", "/app/logs", "/app/sessions"]

# Start command
CMD ["node", "server/index.js"]