# Node 20 reached end of life in April 2026
FROM node:22-alpine

# Install build tools needed for better-sqlite3 native module
RUN apk add --no-cache python3 make g++ sqlite

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY backend/package.json backend/package-lock.json* ./backend/
COPY frontend/package.json frontend/package-lock.json* ./frontend/

# Install backend dependencies (includes native better-sqlite3)
RUN cd backend && npm ci --omit=dev

# Install frontend dependencies and build
RUN cd frontend && npm ci

# Copy all application files
COPY . .

# Build frontend (the app and the public link page)
RUN cd frontend && npm run build

# Create db directory with proper permissions
RUN mkdir -p /app/db && chown -R node:node /app/db

# The commit this image was built from (make and the updater pass it).
# Last, so a new commit doesn't invalidate the cached layers above.
ARG GIT_COMMIT=""
ENV GIT_COMMIT=$GIT_COMMIT

# Set non-root user
USER node

# Expose port 3000
EXPOSE 3000

# Start the Hono server
CMD ["node", "backend/src/index.js"]
