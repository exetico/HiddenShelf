.PHONY: help up down restart logs dev build test test-backend test-frontend clean install

# Default target
help:
	@echo "Hidden Shelf - Available commands:"
	@echo ""
	@echo "  make up              - Start the app (Node.js/Hono backend)"
	@echo "  make dev             - Start dev mode (backend + Vue HMR)"
	@echo "  make build-frontend  - Build Vue frontend for production"
	@echo "  make test-frontend   - Run frontend tests in Docker"
	@echo "  make test-backend    - Run backend tests in Docker"
	@echo "  make test            - Run all tests (frontend + backend)"
	@echo "  make logs            - Follow backend logs"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make clean           - Stop and remove volumes"
	@echo "  make install         - Install dependencies locally"

# Start core app only
up:
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
