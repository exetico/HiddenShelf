.PHONY: help up down restart logs dev build-frontend test test-backend test-frontend clean install backup upgrade

# Default target
help:
	@echo "Hidden Shelf - Available commands:"
	@echo ""
	@echo "  make up              - Build and start the app (production)"
	@echo "  make upgrade         - Back up the database, pull the latest code, rebuild"
	@echo "  make backup          - Copy the database to db/backups/"
	@echo "  make dev             - Start dev mode (backend + Vue HMR)"
	@echo "  make build-frontend  - Build Vue frontend for production"
	@echo "  make test-frontend   - Run frontend tests in Docker"
	@echo "  make test-backend    - Run backend tests in Docker"
	@echo "  make test            - Run all tests (frontend + backend)"
	@echo "  make logs            - Follow backend logs"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make clean           - Stop and remove volumes (your db/ folder is kept)"
	@echo "  make install         - Install dependencies locally"

# Build and start the app (the image includes the built frontend)
up:
	docker compose up -d --build web

# Consistent copy of the running database, into db/backups/ on the host
backup:
	docker compose exec -T web sh -c 'mkdir -p /app/db/backups && sqlite3 /app/db/database.sqlite ".backup /app/db/backups/hiddenshelf-$$(date +%Y%m%d-%H%M%S).sqlite"'
	@ls -1t db/backups | head -1

# Back up, update the code and rebuild. The database in db/ is not part of
# the repository, so git pull never touches it; migrations run on start.
upgrade:
	@if docker compose ps --status running --services | grep -qx web; then \
		$(MAKE) backup; \
	else \
		echo "App is not running, skipping backup"; \
	fi
	git pull --ff-only
	docker compose up -d --build web

# Start dev mode with Vue HMR (magic links are logged, not emailed)
dev:
	DEBUG_MODE=$${DEBUG_MODE:-true} docker compose --profile dev up --build web frontend

# Build Vue frontend for production
build-frontend:
	docker compose --profile build run --rm frontend-build

# Run frontend tests
test-frontend:
	docker compose --profile test run --rm frontend-test

# Run backend tests
test-backend:
	docker compose --profile test run --rm backend-test

# Run all tests
test: test-frontend test-backend

# Follow backend logs
logs:
	docker compose logs -f web

# Stop all services
down:
	docker compose down

# Restart services
restart: down up

# Stop and remove volumes (clean slate)
clean:
	docker compose down -v

# Install dependencies locally (for IDE support)
install:
	cd frontend && npm install
	cd backend && npm install
