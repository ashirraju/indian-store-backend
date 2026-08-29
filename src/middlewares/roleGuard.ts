import { Request, Response, NextFunction } from 'express';

export type AllowedRole = 'Customer' | 'Manager' | 'Operations' | 'Delivery' | 'Admin';

export function roleGuard(...allowedRoles: AllowedRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication required before role authorization check.',
      });
    }

    // Super Admin has universal access to all endpoints
    if (req.user.role === 'Admin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Insufficient permissions. Required role(s): [${allowedRoles.join(', ')}]. Your current role is '${req.user.role}'.`,
      });
    }

    next();
  };
}
