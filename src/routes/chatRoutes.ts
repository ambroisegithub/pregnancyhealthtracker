import { NextFunction, Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { ChatController } from '../controllers/ChatController';
import { authenticate } from '../middlewares/authMiddleware'; 

const router = Router();

router.post(
  '/chat',
  authenticate, 
  [
    body('message').notEmpty().withMessage('Message is required.'),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    ChatController.startOrContinueChat(req as any, res, next).catch(next);
  })



export default router;