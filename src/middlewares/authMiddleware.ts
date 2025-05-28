import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dbConnection from '../database';
import { User } from '../database/models/User';
import { AuthenticatedRequest } from '../types';

export const authenticate = async (
  req: Request, // <-- Use Express' Request here
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required. Please provide a valid token.' 
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { 
      userId: number; 
      role: string; 
    };

    // Get user from database
    const userRepository = dbConnection.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: decoded.userId },
      relations: ['profile']
    });

    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid authentication token' 
      });
      return;
    }

    // Add user to request (type assertion)
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired authentication token' 
    });
  }
};