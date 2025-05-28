// @ts-nocheck

import { Router } from "express"
import { ReminderController } from "../controllers/reminder.controller"
import {authenticate} from "../middlewares/authMiddleware"
import { i18nMiddleware } from "../middlewares/i18nMiddleware"

const router = Router()
const reminderController = new ReminderController()

router.use(authenticate)
router.use(i18nMiddleware)

router.get("/upcoming", reminderController.getUpcomingReminders.bind(reminderController))

router.get("/history", reminderController.getReminderHistory.bind(reminderController))

router.post("/test", reminderController.sendTestReminder.bind(reminderController))

router.get("/stats", reminderController.getReminderStats.bind(reminderController))

export default router
