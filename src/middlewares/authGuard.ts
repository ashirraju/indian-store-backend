import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import { jwksClient, keycloakConfig } from '../config/keycloak.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'Customer' | 'Manager' | 'Operations' | 'Delivery' | 'Admin';
  realm_access?: {
    roles: string[];
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // 1. Dev Bypass Mode for rapid local testing without live Keycloak
  if (keycloakConfig.devAuthBypass && (!authHeader || authHeader === 'Bearer dev-token')) {
    const roleHeader = (req.headers['x-mock-role'] as any) || 'Customer';
    req.user = {
      id: 'usr-dev-100',
      email: (req.headers['x-mock-email'] as string) || 'aarav@example.com',
      name: 'Dev Test User',
      role: roleHeader,
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header with Bearer token.',
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded: any) => {
    if (err || !decoded) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'JWT token verification failed: ' + (err?.message || 'Invalid signature'),
      });
    }

    // Map Keycloak Realm / Resource roles to application AppRole
    const realmRoles: string[] = decoded.realm_access?.roles || [];
    let appRole: 'Customer' | 'Manager' | 'Operations' | 'Delivery' | 'Admin' = 'Customer';

    if (realmRoles.includes('ROLE_ADMIN') || realmRoles.includes('admin')) {
      appRole = 'Admin';
    } else if (realmRoles.includes('ROLE_MANAGER') || realmRoles.includes('manager')) {
      appRole = 'Manager';
    } else if (realmRoles.includes('ROLE_OPERATIONS') || realmRoles.includes('operations')) {
      appRole = 'Operations';
    } else if (realmRoles.includes('ROLE_DELIVERY') || realmRoles.includes('delivery')) {
      appRole = 'Delivery';
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email || decoded.preferred_username || 'customer@indianstore.com',
      name: decoded.name || decoded.preferred_username || 'Valued User',
      role: appRole,
      realm_access: decoded.realm_access,
    };

    next();
  });
}
