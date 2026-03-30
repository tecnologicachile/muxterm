# ============================================
# MuxTerm - Multi-stage Docker Build
# Includes: Node.js, tmux, ttyd, guacd, bw CLI
# ============================================

# Stage 1: Build guacd from source
FROM debian:bookworm-slim AS guacd-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates \
    libcairo2-dev libjpeg62-turbo-dev libpng-dev \
    libpango1.0-dev libssh2-1-dev libwebsockets-dev libwebp-dev \
    freerdp2-dev libvncserver-dev libpulse-dev \
    libavcodec-dev libswscale-dev libavutil-dev \
    autoconf automake libtool pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Build guacamole-server 1.5.5
RUN cd /tmp && \
    git clone --depth 1 --branch 1.5.5 https://github.com/apache/guacamole-server.git && \
    cd guacamole-server && \
    autoreconf -fi && \
    ./configure --with-init-dir=/etc/init.d && \
    make -j$(nproc) && \
    make install && \
    ldconfig

# Stage 2: Build Node.js app + client
FROM node:20-bookworm-slim AS app-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Server dependencies
COPY package*.json ./
RUN npm ci

# Client dependencies + build
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Stage 3: Production image
FROM node:20-bookworm-slim

# Install runtime + build dependencies (node-pty, better-sqlite3 need compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux bash curl ca-certificates \
    build-essential python3 \
    libcairo2 libjpeg62-turbo libpng16-16 \
    libpango-1.0-0 libpangocairo-1.0-0 \
    libssh2-1 libwebsockets17 libwebp7 \
    libfreerdp-client2-2 libfreerdp2-2 \
    libvncclient1 libpulse0 \
    libavcodec59 libswscale6 libavutil57 \
    locales \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 NODE_ENV=production

# Copy guacd and all guacamole libs from builder
COPY --from=guacd-builder /usr/local/sbin/guacd /usr/local/sbin/guacd
COPY --from=guacd-builder /usr/local/lib/ /usr/local/lib/
RUN ldconfig

# Install ttyd
RUN curl -sLo /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
    && chmod +x /usr/local/bin/ttyd

# Install Bitwarden CLI
RUN curl -sL "https://vault.bitwarden.com/download/?app=cli&platform=linux" -o /tmp/bw.zip \
    && apt-get update && apt-get install -y --no-install-recommends unzip \
    && unzip /tmp/bw.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/bw \
    && rm /tmp/bw.zip \
    && apt-get purge -y unzip && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production Node.js dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built client
COPY --from=app-builder /app/client/dist ./client/dist

# Copy server code
COPY server/ ./server/
COPY db/ ./db/
COPY utils/ ./utils/
COPY scripts/ ./scripts/
COPY .tmux.webssh.conf ./

# Create directories and symlink public -> client/dist
RUN mkdir -p data logs certs /tmp/muxterm /tmp/guac-drive \
    && ln -s /app/client/dist /app/public

# Startup script (auto-generates secrets if not provided via env)
RUN echo '#!/bin/bash\n\
export SESSION_SECRET=${SESSION_SECRET:-$(cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)}\n\
export JWT_SECRET=${JWT_SECRET:-$(cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)}\n\
export GUAC_SECRET=${GUAC_SECRET:-$(cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)}\n\
guacd -b 127.0.0.1 -l 4822 -L info &\n\
sleep 1\n\
exec node server/index.js' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3002 4823

VOLUME ["/app/db", "/app/data", "/app/certs", "/app/logs"]

CMD ["/app/start.sh"]
