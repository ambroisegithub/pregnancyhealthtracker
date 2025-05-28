// @ts-nocheck

import type { Response, NextFunction } from "express"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import dbConnection from "../database"
import { PregnancyMilestone } from "../database/models/PregnancyMilestone"
import { MilestoneTranslation } from "../database/models/MilestoneTranslation"
import { PregnancyForm } from "../database/models/PregnancyForm"
import type { Language } from "../database/models/User"

export class MilestoneController {
  private static milestoneRepository = dbConnection.getRepository(PregnancyMilestone)
  private static translationRepository = dbConnection.getRepository(MilestoneTranslation)
  private static pregnancyRepository = dbConnection.getRepository(PregnancyForm)

  // Fallback translation function
  private static getTranslation(req: any, key: string): string {
    if (req.t && typeof req.t === "function") {
      return req.t(key)
    }

    // Fallback translations
    const fallbackTranslations: Record<string, string> = {
      "pregnancy.form_required": "Pregnancy form is required",
      "pregnancy.milestones.title": "Pregnancy Milestones",
      "pregnancy.milestones.week": "Week {{week}} Milestone",
      "pregnancy.milestones.not_found": "No milestones found",
      "pregnancy.milestones.created_success": "Milestone created successfully",
      "pregnancy.milestones.updated_success": "Milestone updated successfully",
      "pregnancy.milestones.deleted_success": "Milestone deleted successfully",
      "errors.validation_error": "Validation error",
      "errors.server_error": "Internal server error",
      "common.success": "Success",
    }

    return fallbackTranslations[key] || key
  }

  static async getMilestones(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const language = req.language as Language
      const { week } = req.query

      // Get user's current pregnancy status
      const pregnancyForm = await MilestoneController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: MilestoneController.getTranslation(req, "pregnancy.form_required"),
        })
        return
      }

      const queryBuilder = MilestoneController.milestoneRepository
        .createQueryBuilder("milestone")
        .leftJoinAndSelect("milestone.translations", "translation", "translation.language = :language", { language })
        .where("milestone.user = :userId", { userId: req.user.id })

      if (week && !isNaN(Number(week))) {
        queryBuilder.andWhere("milestone.gestationalWeek = :week", { week: Number(week) })
      }

      const milestones = await queryBuilder
        .orderBy("milestone.gestationalWeek", "ASC")
        .addOrderBy("milestone.createdAt", "DESC")
        .getMany()

      // If no user-specific milestones found, create default milestones based on pregnancy status
      if (milestones.length === 0 && pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.gestationalWeeks) {
        const defaultMilestones = await MilestoneController.createDefaultMilestones(
          req.user.id,
          pregnancyForm.gestationalWeeks,
        )

        const localizedMilestones = defaultMilestones.map((milestone) => ({
          id: milestone.id,
          milestoneType: milestone.milestoneType,
          gestationalWeek: milestone.gestationalWeek,
          scheduledDate: milestone.scheduledDate,
          completed: milestone.completed,
          reminderSent: milestone.reminderSent,
          notes: milestone.notes,
          createdAt: milestone.createdAt,
          title: MilestoneController.getTranslation(req, "pregnancy.milestones.week").replace(
            "{{week}}",
            milestone.gestationalWeek.toString(),
          ),
          description: MilestoneController.getMilestoneDescription(milestone.milestoneType),
        }))

        res.json({
          success: true,
          message: MilestoneController.getTranslation(req, "pregnancy.milestones.title"),
          data: {
            milestones: localizedMilestones,
            pregnancyInfo: {
              status: pregnancyForm.pregnancyStatus,
              trimester: pregnancyForm.currentTrimester,
              gestationalWeeks: pregnancyForm.gestationalWeeks,
              gestationalDays: pregnancyForm.gestationalDays,
            },
          },
        })
        return
      }

      const localizedMilestones = milestones.map((milestone) => ({
        id: milestone.id,
        milestoneType: milestone.milestoneType,
        gestationalWeek: milestone.gestationalWeek,
        scheduledDate: milestone.scheduledDate,
        completed: milestone.completed,
        reminderSent: milestone.reminderSent,
        notes: milestone.notes,
        createdAt: milestone.createdAt,
        title:
          milestone.translations[0]?.title ||
          MilestoneController.getTranslation(req, "pregnancy.milestones.week").replace(
            "{{week}}",
            milestone.gestationalWeek.toString(),
          ),
        description:
          milestone.translations[0]?.description ||
          MilestoneController.getMilestoneDescription(milestone.milestoneType),
      }))

      res.json({
        success: true,
        message: MilestoneController.getTranslation(req, "pregnancy.milestones.title"),
        data: {
          milestones: localizedMilestones,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
          },
        },
      })
    } catch (error) {
      console.error("Get milestones error:", error)
      next(error)
    }
  }

  static async getMilestoneById(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params
      const language = req.language as Language

      const milestone = await MilestoneController.milestoneRepository
        .createQueryBuilder("milestone")
        .leftJoinAndSelect("milestone.translations", "translation", "translation.language = :language", { language })
        .where("milestone.id = :id", { id })
        .andWhere("milestone.user = :userId", { userId: req.user.id })
        .getOne()

      if (!milestone) {
        res.status(404).json({
          success: false,
          message: MilestoneController.getTranslation(req, "pregnancy.milestones.not_found"),
        })
        return
      }

      const localizedMilestone = {
        id: milestone.id,
        milestoneType: milestone.milestoneType,
        gestationalWeek: milestone.gestationalWeek,
        scheduledDate: milestone.scheduledDate,
        completed: milestone.completed,
        reminderSent: milestone.reminderSent,
        notes: milestone.notes,
        createdAt: milestone.createdAt,
        title:
          milestone.translations[0]?.title ||
          MilestoneController.getTranslation(req, "pregnancy.milestones.week").replace(
            "{{week}}",
            milestone.gestationalWeek.toString(),
          ),
        description:
          milestone.translations[0]?.description ||
          MilestoneController.getMilestoneDescription(milestone.milestoneType),
      }

      res.json({
        success: true,
        message: MilestoneController.getTranslation(req, "common.success"),
        data: localizedMilestone,
      })
    } catch (error) {
      console.error("Get milestone by ID error:", error)
      next(error)
    }
  }

  static async updateMilestone(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params
      const { completed, notes, scheduledDate } = req.body

      const milestone = await MilestoneController.milestoneRepository.findOne({
        where: { id: Number(id), user: { id: req.user.id } },
      })

      if (!milestone) {
        res.status(404).json({
          success: false,
          message: MilestoneController.getTranslation(req, "pregnancy.milestones.not_found"),
        })
        return
      }

      // Update milestone
      if (completed !== undefined) milestone.completed = completed
      if (notes !== undefined) milestone.notes = notes
      if (scheduledDate !== undefined) milestone.scheduledDate = new Date(scheduledDate)

      const updatedMilestone = await MilestoneController.milestoneRepository.save(milestone)

      res.json({
        success: true,
        message: MilestoneController.getTranslation(req, "pregnancy.milestones.updated_success"),
        data: updatedMilestone,
      })
    } catch (error) {
      console.error("Update milestone error:", error)
      next(error)
    }
  }

  // Helper method to create default milestones
  private static async createDefaultMilestones(userId: number, currentWeek: number): Promise<PregnancyMilestone[]> {
    const defaultMilestones = [
      { type: "first_ultrasound", week: 8 },
      { type: "anatomy_scan", week: 20 },
      { type: "glucose_test", week: 24 },
      { type: "tdap_vaccine", week: 28 },
      { type: "group_b_strep", week: 36 },
      { type: "weekly_checkups", week: 36 },
    ]

    const milestonesToCreate = defaultMilestones.filter((m) => m.week >= currentWeek)
    const createdMilestones: PregnancyMilestone[] = []

    for (const milestoneData of milestonesToCreate) {
      const scheduledDate = new Date()
      scheduledDate.setDate(scheduledDate.getDate() + (milestoneData.week - currentWeek) * 7)

      const milestone = MilestoneController.milestoneRepository.create({
        user: { id: userId },
        milestoneType: milestoneData.type as any,
        gestationalWeek: milestoneData.week,
        scheduledDate,
        completed: false,
        reminderSent: false,
      })

      const savedMilestone = await MilestoneController.milestoneRepository.save(milestone)
      createdMilestones.push(savedMilestone)
    }

    return createdMilestones
  }

  // Helper method to get milestone descriptions
  private static getMilestoneDescription(milestoneType: string): string {
    const descriptions: Record<string, string> = {
      first_ultrasound: "Your first ultrasound appointment to confirm pregnancy and check baby's development",
      anatomy_scan: "Detailed ultrasound to check baby's anatomy and development",
      glucose_test: "Screening test for gestational diabetes",
      tdap_vaccine: "Vaccination to protect against tetanus, diphtheria, and pertussis",
      group_b_strep: "Test for Group B Streptococcus bacteria",
      weekly_checkups: "Regular weekly checkups as you approach your due date",
    }

    return descriptions[milestoneType] || "Important pregnancy milestone"
  }
}
