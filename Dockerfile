# Multi-stage build for React + Vite frontend

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Vite bakes env vars at build time, so VITE_API_URL must be a build arg
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

# Build
RUN npm run build

# Stage 2: Runtime (serve static files)
FROM node:22-alpine

WORKDIR /app

# Install a simple static server
RUN npm install -g serve

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Expose port (matches docker-compose + CONTRACT)
EXPOSE 5173

# Serve the dist folder
CMD ["serve", "-s", "dist", "-l", "5173"]
