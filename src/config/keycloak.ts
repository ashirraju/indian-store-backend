import jwksRsa from 'jwks-rsa';
import dotenv from 'dotenv';
dotenv.config();

export const keycloakConfig = {
  realm: process.env.KEYCLOAK_REALM || 'indian-store-realm',
  url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'indian-store-api',
  jwksUri: process.env.KEYCLOAK_JWKS_URI || 'http://localhost:8080/realms/indian-store-realm/protocol/openid-connect/certs',
  devAuthBypass: process.env.DEV_AUTH_BYPASS !== 'false',
};

// JWKS Client to fetch Keycloak public signing keys dynamically
export const jwksClient = jwksRsa({
  jwksUri: keycloakConfig.jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});
