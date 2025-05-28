import { Router } from 'express';
import { body } from 'express-validator';
import { PregnancyController } from '../controllers/pregnancy.controller';
import {  isPatient } from '../middlewares/roleMiddleware';
import { authenticate } from '../middlewares/authMiddleware';



const router = Router();

// Validation rules
const pregnancyFormValidation = [
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('pregnancyStatus').isIn([
    'Pregnant', 'Delivered', 'Aborted', 'Stillbirth', 
    'Infertile', 'Preconception', 'Menopausal', 'Nulligravid'
  ]).withMessage('Valid pregnancy status is required'),
  body('lastDateOfMenstruation').optional().isISO8601().withMessage('Valid LMP date required'),
  body('gravida').optional().isInt({ min: 0 }).withMessage('Gravida must be a positive integer'),
  body('term').optional().isInt({ min: 0 }).withMessage('Term must be a positive integer'),
  body('preterm').optional().isInt({ min: 0 }).withMessage('Preterm must be a positive integer'),
  body('abortion').optional().isInt({ min: 0 }).withMessage('Abortion must be a positive integer'),
  body('living').optional().isInt({ min: 0 }).withMessage('Living must be a positive integer')
];

const pregnancyUpdateValidation = [
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth required'),
  body('pregnancyStatus').optional().isIn([
    'Pregnant', 'Delivered', 'Aborted', 'Stillbirth', 
    'Infertile', 'Preconception', 'Menopausal', 'Nulligravid'
  ]).withMessage('Valid pregnancy status required'),
  body('lastDateOfMenstruation').optional().isISO8601().withMessage('Valid LMP date required'),
  body('gravida').optional().isInt({ min: 0 }).withMessage('Gravida must be a positive integer'),
  body('term').optional().isInt({ min: 0 }).withMessage('Term must be a positive integer'),
  body('preterm').optional().isInt({ min: 0 }).withMessage('Preterm must be a positive integer'),
  body('abortion').optional().isInt({ min: 0 }).withMessage('Abortion must be a positive integer'),
  body('living').optional().isInt({ min: 0 }).withMessage('Living must be a positive integer')
];

// Routes
router.post('/form', authenticate, isPatient, pregnancyFormValidation, PregnancyController.submitPregnancyForm as unknown as (req: any, res: any, next: any) => Promise<void>);
router.get('/status', authenticate, isPatient, PregnancyController.getPregnancyStatus as unknown as (req: any, res: any, next: any) => Promise<void>);
router.put('/form', authenticate, isPatient, pregnancyUpdateValidation, PregnancyController.updatePregnancyForm as unknown as (req: any, res: any, next: any) => Promise<void>);
router.get(
  '/pregnancy/status-with-ai',
  authenticate,
  PregnancyController.getPregnancyStatusWithAIInsight as unknown as (req: any, res: any, next: any) => Promise<void>
); 
export default router;
