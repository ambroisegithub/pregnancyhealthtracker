import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export const isPatient = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || user.role !== 'patient') {
    res.status(403).json({ 
      success: false, 
      message: 'Patient access required' 
    });
    return;
  }
  next();
};

export const isDoctor = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['doctor', 'admin', 'superadmin'].includes(user.role)) {
    res.status(403).json({ 
      success: false, 
      message: 'Doctor access required' 
    });
    return;
  }
  next();
};

export const isAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
    return;
  }
  next();
};