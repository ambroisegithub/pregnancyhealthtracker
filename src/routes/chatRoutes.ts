// @ts-nocheck

import { Router } from "express"
import { body } from "express-validator"
import { i18nMiddleware } from "../middlewares/i18nMiddleware"
import { ChatController } from "../controllers/ChatController"
import {authenticate} from "../middlewares/authMiddleware"
const router = Router()

// Apply i18n middleware to all chat routes
router.use(i18nMiddleware)

// Apply auth middleware to all chat routes
router.use(authenticate)

// POST /api/chat - Start or continue chat
router.post(
  "/chat",
  [
    body("message")
      .notEmpty()
      .withMessage("Message is required")
      .isLength({ min: 1, max: 2000 })
      .withMessage("Message must be between 1 and 2000 characters"),
  ],
  ChatController.startOrContinueChat,
)

// GET /api/chat/history - Get chat history
router.get("/history", ChatController.getChatHistory)

// DELETE /api/chat/history - Clear chat history
router.delete("/history", ChatController.clearChatHistory)

export default router
