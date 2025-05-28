import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
//   body('phoneNumber').optional().isMobilePhone('any').withMessage('Valid phone number required'),
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth required'),
  body('country').optional().trim(),
  body('city').optional().trim()
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Routes
import { Request, Response, NextFunction } from 'express';

router.post(
  '/register',
  registerValidation,
  AuthController.register as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>
);
router.post('/login', loginValidation, AuthController.login as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>);
router.get('/profile', authenticate, AuthController.getProfile as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>);

export default router;