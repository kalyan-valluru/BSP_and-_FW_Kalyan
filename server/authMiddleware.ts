import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_enterprise_vkr_jwt_token_2026';
const AUTH_MODE = process.env.AUTH_MODE || 'optional';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export function optionalJwtMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (AUTH_MODE === 'disabled') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (AUTH_MODE === 'required') {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }
    // Optional mode: proceed as guest
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (AUTH_MODE === 'required') {
      return res.status(403).json({ error: 'Forbidden: Invalid JWT Token' });
    }
    next(); // Fallback for optional mode
  }
}
