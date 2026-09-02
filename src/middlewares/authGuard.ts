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
  const rawRoleHeader = (req.headers['x-mock-role'] || req.headers['x-user-role'] || req.query.role) as string;

  // 1. Dev Bypass Mode for rapid local development & testing without requiring live Keycloak
  if (keycloakConfig.devAuthBypass) {
    let decodedToken: any = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token && token !== 'null' && token !== 'undefined' && token !== 'dev-token') {
        try {
          decodedToken = jwt.decode(token);
        } catch {
          // Ignore decode errors in dev mode
        }
      }
    }

    // Determine user role: check decoded token first, then mock/role headers
    let appRole: 'Customer' | 'Manager' | 'Operations' | 'Delivery' | 'Admin' = 'Customer';

    if (decodedToken) {
      const realmRoles: string[] = decodedToken.realm_access?.roles || [];
      const resourceRoles: string[] = Object.values(decodedToken.resource_access || {}).flatMap(
        (r: any) => (r as any).roles || []
      );
      const allRoles = [...realmRoles, ...resourceRoles].map((r: string) => r.toLowerCase());

      if (allRoles.includes('admin') || allRoles.includes('role_admin') || allRoles.includes('superadmin')) {
        appRole = 'Admin';
      } else if (allRoles.includes('manager') || allRoles.includes('role_manager')) {
        appRole = 'Manager';
      } else if (allRoles.includes('operations') || allRoles.includes('role_operations')) {
        appRole = 'Operations';
      } else if (allRoles.includes('delivery') || allRoles.includes('role_delivery')) {
        appRole = 'Delivery';
      }
    }

    if (rawRoleHeader) {
      const formatted = rawRoleHeader.charAt(0).toUpperCase() + rawRoleHeader.slice(1).toLowerCase();
      if (['Customer', 'Manager', 'Operations', 'Delivery', 'Admin'].includes(formatted)) {
        appRole = formatted as any;
      }
    } else if (appRole === 'Customer' && (req.originalUrl?.includes('/notifications') || req.originalUrl?.includes('/orders'))) {
      // Default to Operations role for operations/orders management endpoints in dev mode
      appRole = 'Operations';
    }

    req.user = {
      id: decodedToken?.sub || 'usr-dev-100',
      email: decodedToken?.email || (req.headers['x-mock-email'] as string) || 'ops@indianstore.com',
      name: decodedToken?.name || 'Dev Operations User',
      role: appRole,
      realm_access: decodedToken?.realm_access,
    };
    return next();
  }

  // 2. Production Mode: Strict RS256 JWT signature verification with Keycloak JWKS
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

    // Map Keycloak Realm / Resource roles to application AppRole (case-insensitive)
    const realmRoles: string[] = decoded.realm_access?.roles || [];
    const resourceRoles: string[] = Object.values(decoded.resource_access || {}).flatMap(
      (res: any) => res.roles || []
    );
    const allRoles = [...realmRoles, ...resourceRoles].map((r: string) => r.toLowerCase());

    let appRole: 'Customer' | 'Manager' | 'Operations' | 'Delivery' | 'Admin' = 'Customer';

    if (allRoles.includes('admin') || allRoles.includes('role_admin') || allRoles.includes('superadmin')) {
      appRole = 'Admin';
    } else if (allRoles.includes('manager') || allRoles.includes('role_manager')) {
      appRole = 'Manager';
    } else if (allRoles.includes('operations') || allRoles.includes('role_operations')) {
      appRole = 'Operations';
    } else if (allRoles.includes('delivery') || allRoles.includes('role_delivery')) {
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
