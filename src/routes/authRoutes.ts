
// @ts-nocheck

import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middlewares/authMiddleware';

import { i18nMiddleware } from "../middlewares/i18nMiddleware"

const router = Router()

// Apply i18n middleware to all auth routes
router.use(i18nMiddleware)

// Registration validation rules
const registerValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("firstName").notEmpty().trim(),
  body("lastName").notEmpty().trim(),
  body("phoneNumber").optional().isMobilePhone("any"),
]

// Login validation rules
const loginValidation = [body("email").isEmail().normalizeEmail(), body("password").notEmpty()]


// Routes
import { Request, Response, NextFunction } from 'express';

router.post(
  '/register',
  registerValidation,
  AuthController.register as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>
);
router.post('/login', loginValidation, AuthController.login as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>);
router.get('/profile', authenticate, AuthController.getProfile as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>);
router.put('/language', authenticate, AuthController.updateLanguage as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>);


export default router
