import { Request } from 'express';
import { User } from './database/models/User';
export interface AuthenticatedRequest extends Request {
  user: User;
}

export interface PregnancyCalculations {
  expectedDeliveryDate: Date;
  gestationalAge: {
    weeks: number;
    days: number;
    totalDays: number;
  };
  trimester: number;
}