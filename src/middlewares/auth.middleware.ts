import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Étendre l'interface Request pour inclure une propriété user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé: Droits d\'administrateur requis' });
  }
  
  next();
};

export const sellerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'SELLER') {
    return res.status(403).json({ error: 'Accès refusé: Droits de vendeur requis' });
  }
  
  next();
};

export const superAdminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Accès refusé: Droits de super administrateur requis' });
  }
  
  next();
};