// @ts-nocheck

import { Router } from "express"
import { DailyTipController } from "../controllers/DailyTipController"
import { isPatient } from "../middlewares/roleMiddleware"
import { authenticate } from "../middlewares/authMiddleware"
import { i18nMiddleware } from "../middlewares/i18nMiddleware"

const router = Router()

// Apply i18n middleware to all routes
router.use(i18nMiddleware)

// Patient Routes - All routes require authentication and patient role
router.get("/my-daily-tips", authenticate, isPatient, DailyTipController.getMyDailyTips)
router.get("/weekly-tips", authenticate, isPatient, DailyTipController.getWeeklyTips)
router.get("/trimester-tips", authenticate, isPatient, DailyTipController.getTipsByTrimester)

export default router
