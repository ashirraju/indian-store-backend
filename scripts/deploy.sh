#!/bin/bash
set -e

echo "🚀 Starting Indian Store Production Deployment with Traefik..."

# 1. Ensure letsencrypt directory and permissions exist
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

# 2. Build and launch all containers
echo "📦 Building and starting Docker containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 3. Wait for PostgreSQL to become healthy
echo "⏳ Waiting for PostgreSQL database to initialize..."
until docker exec indian_store_pg pg_isready -U "${DB_USER:-store_admin}" -d "${DB_NAME:-indian_store_db}" > /dev/null 2>&1; do
  sleep 2
done

# 4. Run database migrations inside API container
echo "🔄 Running Database Schema Migrations..."
docker exec -i indian_store_pg psql -U "${DB_USER:-store_admin}" -d "${DB_NAME:-indian_store_db}" < src/database/schema.sql

echo "✅ Deployment completed successfully!"
echo "📡 Traefik will automatically issue Let's Encrypt SSL certificates for your domains."
