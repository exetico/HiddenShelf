.PHONY: help up down restart logs dev build-frontend test test-backend test-frontend clean install backup restore upgrade

# Default target
help:
	@echo "Hidden Shelf - Available commands:"
	@echo ""
	@echo "  make up              - Build and start the app (production)"
	@echo "  make upgrade         - Back up the database, pull the latest code, rebuild"
	@echo "  make backup          - Copy the database to db/backups/ (OUT=path also copies it there)"
	@echo "  make restore FILE=.. - Replace the database with a backup from db/"
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

# Runs a shell command in the app container, running or not. Files go
# through the container (as the app's user), so db/ ownership never matters.
IN_WEB = if docker compose ps --status running --services | grep -qx web; then \
		docker compose exec -T web sh -c "$$cmd"; \
	else \
		docker compose run --rm --no-deps -T web sh -c "$$cmd"; \
	fi

BACKUP_NAME := hiddenshelf-$(shell date +%Y%m%d-%H%M%S).sqlite

# Consistent copy of the database (safe while the app runs) into
# db/backups/ on the host. OUT=/some/path also copies it there.
backup:
	@cmd='mkdir -p /app/db/backups && sqlite3 /app/db/database.sqlite ".backup /app/db/backups/$(BACKUP_NAME)"'; \
	$(IN_WEB)
	@echo "Backup: db/backups/$(BACKUP_NAME)"
	@if [ -n "$(OUT)" ]; then cp "db/backups/$(BACKUP_NAME)" "$(OUT)" && echo "Copied to $(OUT)"; fi

# Replace the database with a backup. The current database is backed up
# first, so a restore can be undone the same way.
restore:
	@[ -n "$(FILE)" ] || { echo "Usage: make restore FILE=db/backups/hiddenshelf-YYYYMMDD-HHMMSS.sqlite"; exit 1; }
	@case "$(FILE)" in db/*) ;; *) echo "FILE must be inside db/, e.g. db/backups/..."; exit 1;; esac
	@[ -f "$(FILE)" ] || { echo "$(FILE) not found"; exit 1; }
	@if [ -f db/database.sqlite ]; then $(MAKE) --no-print-directory backup; fi
	docker compose stop web
	@cmd='cp "/app/$(FILE)" /app/db/database.sqlite && rm -f /app/db/database.sqlite-wal /app/db/database.sqlite-shm'; \
	$(IN_WEB)
	docker compose up -d web
	@echo "Restored $(FILE)"

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
