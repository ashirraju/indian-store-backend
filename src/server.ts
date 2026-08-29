import { app } from './app.js';
import { checkDatabaseConnection, pool } from './config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 Indian Store Backend API running on port ${PORT}`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📦 Catalog API: http://localhost:${PORT}/api/v1/products`);
  console.log(`🔑 Keycloak Realm: ${process.env.KEYCLOAK_REALM || 'indian-store-realm'}`);
  console.log(`====================================================`);

  const isDbConnected = await checkDatabaseConnection();
  if (isDbConnected) {
    console.log('✅ PostgreSQL Database connected successfully.');
  } else {
    console.log('⚠️ PostgreSQL offline or not reachable. Start via: cd backend && docker compose up -d');
  }
});

// Graceful Shutdown
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Gracefully closing HTTP server and PostgreSQL pool...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('✅ PostgreSQL connection pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
