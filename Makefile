.PHONY: install build clean dev start stop restart logs

# Variables
NODE_ENV ?= production
PORT ?= 3002

# Quick install
install:
	@echo "🚀 Installing MuxTerm..."
	@npm ci --production
	@if [ -f "client-dist.tar.gz" ]; then \
		echo "📦 Using pre-built client..."; \
		mkdir -p client && tar -xzf client-dist.tar.gz -C client/; \
	else \
		echo "🔨 Building client from source..."; \
		cd client && npm ci --production && npm run build; \
	fi
	@mkdir -p data logs sessions
	@if [ ! -f .env ]; then \
		echo "JWT_SECRET=$$(openssl rand -base64 32)" > .env; \
		echo "PORT=$(PORT)" >> .env; \
		echo "NODE_ENV=$(NODE_ENV)" >> .env; \
	fi
	@echo "✅ Installation complete!"

# Build only
build:
	@echo "🔨 Building client..."
	@cd client && npm run build
	@echo "✅ Build complete!"

# Development mode
dev:
	@echo "🔧 Starting in development mode..."
	@NODE_ENV=development npm run dev

# Production start
start:
	@echo "🚀 Starting MuxTerm..."
	@NODE_ENV=production npm start

# Start with systemd
start-service:
	@sudo systemctl start muxterm

# Stop service
stop:
	@sudo systemctl stop muxterm

# Restart service
restart:
	@sudo systemctl restart muxterm

# View logs
logs:
	@journalctl -u muxterm -f

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf client/dist
	@rm -rf node_modules client/node_modules
	@rm -f client-dist.tar.gz
	@echo "✅ Clean complete!"

# Update from git
update:
	@./update.sh

# Docker build
docker-build:
	@docker build -t muxterm:latest .

# Docker run
docker-run:
	@docker run -d -p $(PORT):3002 \
		-v muxterm-data:/app/data \
		-v muxterm-sessions:/tmp/muxterm \
		--name muxterm \
		muxterm:latest

# Create release
release:
	@echo "📦 Creating release..."
	@cd client && npm run build
	@tar -czf client-dist.tar.gz -C client dist
	@echo "✅ Release package created: client-dist.tar.gz"