import { Router } from 'express';
import { body } from 'express-validator';
import { ArticleController } from '../controllers/ArticleController';
import {  isPatient, isAdmin } from '../middlewares/roleMiddleware';
import { authenticate } from '../middlewares/authMiddleware';


const router = Router();

const articleValidation = [
  body('title').notEmpty().trim().withMessage('Article title is required'),
  body('content').notEmpty().trim().withMessage('Article content is required'),
  body('week').optional().isInt({ min: 1, max: 42 }).withMessage('Week must be between 1 and 42'),
  body('target').optional().isIn([
    'Pregnant', 'Delivered', 'Aborted', 'Stillbirth', 
    'Infertile', 'Preconception', 'Menopausal', 'Nulligravid'
  ]).withMessage('Valid target status required'),
  body('articleImage').optional().isURL().withMessage('Valid image URL required')
];

const updateArticleValidation = [
  body('title').optional().notEmpty().trim().withMessage('Article title cannot be empty'),
  body('content').optional().notEmpty().trim().withMessage('Article content cannot be empty'),
  body('week').optional().isInt({ min: 1, max: 42 }).withMessage('Week must be between 1 and 42'),
  body('target').optional().isIn([
    'Pregnant', 'Delivered', 'Aborted', 'Stillbirth', 
    'Infertile', 'Preconception', 'Menopausal', 'Nulligravid'
  ]).withMessage('Valid target status required'),
  body('articleImage').optional().isURL().withMessage('Valid image URL required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
];

import { Request, Response, NextFunction } from 'express';

router.get(
  '/my-articles',
  authenticate,
  isPatient,
  (ArticleController.getArticlesForUser as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>)
);
router.get('/daily', authenticate, isPatient, ArticleController.getDailyArticle   as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>);
router.post('/', authenticate, isAdmin, articleValidation, ArticleController.createArticle as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>);
export default router;