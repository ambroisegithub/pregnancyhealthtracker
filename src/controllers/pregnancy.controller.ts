import type { Response, NextFunction } from "express"
import { validationResult } from "express-validator"
import type { AuthenticatedRequest } from "../types"
import dbConnection from "../database/index"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"
import { PregnancyForm } from "../database/models/PregnancyForm"
import { geminiService } from "../services/geminiService"
import { NotificationService } from "../services/notification.service"

export class PregnancyController {
  static async submitPregnancyForm(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        })
        return
      }

      const { dateOfBirth, pregnancyStatus, lastDateOfMenstruation, gravida, term, preterm, abortion, living } =
        req.body

      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)

      let pregnancyData: any = {
        dateOfBirth: new Date(dateOfBirth),
        pregnancyStatus,
        gravida,
        term,
        preterm,
        abortion,
        living,
        user: req.user,
      }

      // Calculate pregnancy details if user is pregnant
      if (pregnancyStatus === "Pregnant" && lastDateOfMenstruation) {
        const lmpDate = new Date(lastDateOfMenstruation)

        // Validate LMP date is not in the future
        if (lmpDate > new Date()) {
          res.status(400).json({
            success: false,
            message: "Last menstruation date cannot be in the future",
          })
          return
        }

        // Calculate pregnancy details
        const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(lmpDate)

        pregnancyData = {
          ...pregnancyData,
          lastDateOfMenstruation: lmpDate,
          expectedDeliveryDate: pregnancyDetails.expectedDeliveryDate,
          currentTrimester: pregnancyDetails.trimester,
          gestationalWeeks: pregnancyDetails.gestationalAge.weeks,
          gestationalDays: pregnancyDetails.gestationalAge.days,
        }
      } else {
        pregnancyData.lastDateOfMenstruation = lastDateOfMenstruation ? new Date(lastDateOfMenstruation) : null
      }

      // Create pregnancy form
      const pregnancyForm = pregnancyRepository.create(pregnancyData)
      const savedPregnancyForm = await pregnancyRepository.save(pregnancyForm)

      // Send WhatsApp confirmation message
      try {
        await NotificationService.sendPregnancyFormConfirmation(req.user, savedPregnancyForm as unknown as PregnancyForm)
      } catch (error) {
        console.error("Failed to send WhatsApp confirmation:", error)
        // Don't fail the form submission if WhatsApp message fails
      }

      res.status(201).json({
        success: true,
        message: "Pregnancy form submitted successfully",
        data: savedPregnancyForm,
      })
    } catch (error) {
      next(error)
    }
  }

  static async getPregnancyStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)

      // Get latest pregnancy form for the user
      const pregnancyForm = await pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: "No pregnancy information found. Please submit pregnancy form first.",
        })
        return
      }

      // If pregnant, update current gestational age
      if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.lastDateOfMenstruation) {
        const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(pregnancyForm.lastDateOfMenstruation)

        // Update pregnancy form with current data
        pregnancyForm.currentTrimester = pregnancyDetails.trimester
        pregnancyForm.gestationalWeeks = pregnancyDetails.gestationalAge.weeks
        pregnancyForm.gestationalDays = pregnancyDetails.gestationalAge.days

        await pregnancyRepository.save(pregnancyForm)
      }

      res.json({
        success: true,
        data: pregnancyForm,
      })
    } catch (error) {
      next(error)
    }
  }

  static async updatePregnancyForm(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        })
        return
      }

      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)

      // Get latest pregnancy form
      const pregnancyForm = await pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: "No pregnancy form found to update",
        })
        return
      }

      const updateData = req.body

      // If updating LMP date and pregnant, recalculate pregnancy details
      if (updateData.lastDateOfMenstruation && pregnancyForm.pregnancyStatus === "Pregnant") {
        const lmpDate = new Date(updateData.lastDateOfMenstruation)
        if (lmpDate > new Date()) {
          res.status(400).json({
            success: false,
            message: "Last menstruation date cannot be in the future",
          })
          return
        }

        const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(lmpDate)
        updateData.expectedDeliveryDate = pregnancyDetails.expectedDeliveryDate
        updateData.currentTrimester = pregnancyDetails.trimester
        updateData.gestationalWeeks = pregnancyDetails.gestationalAge.weeks
        updateData.gestationalDays = pregnancyDetails.gestationalAge.days
      }

      // Update pregnancy form
      Object.assign(pregnancyForm, updateData)
      await pregnancyRepository.save(pregnancyForm)

      res.json({
        success: true,
        message: "Pregnancy form updated successfully",
        data: pregnancyForm,
      })
    } catch (error) {
      next(error)
    }
  }

  static async getPregnancyStatusWithAIInsight(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)
      const pregnancyForm = await pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: "No pregnancy information found. Please submit pregnancy form first.",
        })
        return
      }

      if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.lastDateOfMenstruation) {
        const lmpDate = new Date(pregnancyForm.lastDateOfMenstruation)
        if (!isNaN(lmpDate.getTime())) {
          const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(lmpDate)
          // Update pregnancy form with current data
          pregnancyForm.currentTrimester = pregnancyDetails.trimester
          pregnancyForm.gestationalWeeks = pregnancyDetails.gestationalAge.weeks
          pregnancyForm.gestationalDays = pregnancyDetails.gestationalAge.days
          await pregnancyRepository.save(pregnancyForm)
        }
      }

      const userData = req.user // User object from AuthenticatedRequest
      const pregnancyData = pregnancyForm // Latest pregnancy form data

      // Convert all date fields to Date objects if they exist
      const dateOfBirth = pregnancyData.dateOfBirth ? new Date(pregnancyData.dateOfBirth) : null
      const lastDateOfMenstruation = pregnancyData.lastDateOfMenstruation
        ? new Date(pregnancyData.lastDateOfMenstruation)
        : null
      const expectedDeliveryDate = pregnancyData.expectedDeliveryDate
        ? new Date(pregnancyData.expectedDeliveryDate)
        : null

      // Construct a detailed prompt for Gemini
      const prompt = `
        User Profile:
        First Name: ${userData.profile?.firstName || "N/A"}
        Last Name: ${userData.profile?.lastName || "N/A"}
        Date of Birth: ${dateOfBirth && !isNaN(dateOfBirth.getTime()) ? dateOfBirth.toDateString() : "N/A"}
        
        Pregnancy Information:
        Pregnancy Status: ${pregnancyData.pregnancyStatus}
        ${lastDateOfMenstruation && !isNaN(lastDateOfMenstruation.getTime()) ? `Last Menstruation Date: ${lastDateOfMenstruation.toDateString()}` : ""}
        Gravida (Total Pregnancies): ${pregnancyData.gravida || "N/A"}
        Term Births: ${pregnancyData.term || "N/A"}
        Preterm Births: ${pregnancyData.preterm || "N/A"}
        Abortions/Miscarriages: ${pregnancyData.abortion || "N/A"}
        Living Children: ${pregnancyData.living || "N/A"}
        ${expectedDeliveryDate && !isNaN(expectedDeliveryDate.getTime()) ? `Expected Delivery Date: ${expectedDeliveryDate.toDateString()}` : ""}
        ${pregnancyData.currentTrimester ? `Current Trimester: ${pregnancyData.currentTrimester}` : ""}
        ${pregnancyData.gestationalWeeks !== null && pregnancyData.gestationalWeeks !== undefined ? `Gestational Age: ${pregnancyData.gestationalWeeks} weeks and ${pregnancyData.gestationalDays} days` : ""}
        
        Based on the above user and pregnancy information, provide a concise, encouraging, and informative update for the user. If the user is pregnant, focus on their current gestational age and trimester, offering general advice or what to expect. If they are not pregnant or have a different status, provide a relevant and supportive message.
        
        Example for pregnant user: "You are currently in your [Trimester] trimester, at [Gestational Weeks] weeks and [Gestational Days] days. This is a crucial time for development. Remember to..."
        Example for non-pregnant user: "It looks like your current status is [Pregnancy Status]. We are here to support you on your journey."
        
        Keep the response under 100 words.
      `

      let aiInsight = "No specific AI insight available at this moment."
      try {
        aiInsight = await geminiService.generateText(prompt)
      } catch (aiError) {
        console.warn("Could not get AI insight:", aiError)
        // Optionally, send a default message or skip AI insight if an error occurs
      }

      res.json({
        success: true,
        data: {
          ...pregnancyForm,
          aiInsight: aiInsight, // Add the AI-generated insight to the response
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
