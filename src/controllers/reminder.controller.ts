import type { Response, NextFunction } from "express"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import { enhancedReminderService } from "../services/enhanced-reminder.service"
import { ReminderType } from "../database/models/ReminderTemplate"

export class ReminderController {
  async getUpcomingReminders(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const reminders = await enhancedReminderService.getUpcomingReminders(req.user.id)

      res.json({
        success: true,
        message: req.t("reminders.upcoming"),
        data: { reminders },
      })
    } catch (error) {
      next(error)
    }
  }

  async getReminderHistory(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { limit = 20 } = req.query
      const reminders = await enhancedReminderService.getReminderHistory(req.user.id, Number(limit))

      res.json({
        success: true,
        message: req.t("reminders.history"),
        data: { reminders },
      })
    } catch (error) {
      next(error)
    }
  }

  async sendTestReminder(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { type = ReminderType.ANC } = req.body

      const success = await enhancedReminderService.sendTestReminder(req.user.id, type)

      if (success) {
        res.json({
          success: true,
          message: req.t("reminders.test_sent"),
        })
      } else {
        res.status(400).json({
          success: false,
          message: req.t("reminders.test_failed"),
        })
      }
    } catch (error) {
      next(error)
    }
  }

  async getReminderStats(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const upcomingCount = (await enhancedReminderService.getUpcomingReminders(req.user.id)).length
      const historyCount = (await enhancedReminderService.getReminderHistory(req.user.id, 100)).length

      res.json({
        success: true,
        message: req.t("reminders.stats"),
        data: {
          upcomingCount,
          totalReminders: historyCount,
          reminderTypes: [
            { type: ReminderType.ANC, name: req.t("reminders.types.anc") },
            { type: ReminderType.VACCINATION, name: req.t("reminders.types.vaccination") },
            { type: ReminderType.MILESTONE, name: req.t("reminders.types.milestone") },
          ],
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
