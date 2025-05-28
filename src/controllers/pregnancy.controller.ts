import type { Response, NextFunction } from "express"
import { validationResult } from "express-validator"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import dbConnection from "../database/index"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"
import { PregnancyForm } from "../database/models/PregnancyForm"
import { PregnancyMilestone } from "../database/models/PregnancyMilestone"
import { MilestoneTranslation } from "../database/models/MilestoneTranslation"
import { geminiService } from "../services/geminiService"
import { NotificationService } from "../services/notification.service"
import type { Language } from "../database/models/User"

export class PregnancyController {
  private static pregnancyRepository = dbConnection.getRepository(PregnancyForm)
  private static milestoneRepository = dbConnection.getRepository(PregnancyMilestone)

  // Fallback translation function
  private static getTranslation(req: any, key: string, options?: any): string {
    if (req.t && typeof req.t === "function") {
      return req.t(key, options)
    }

    // Fallback translations
    const fallbackTranslations: Record<string, string> = {
      "errors.validation_error": "Validation error occurred",
      "pregnancy.invalid_lmp_date": "Last menstruation date cannot be in the future",
      "pregnancy.form.save": "Pregnancy form saved successfully",
      "pregnancy.form_not_found": "No pregnancy form found",
      "pregnancy.status_retrieved": "Pregnancy status retrieved successfully",
      "pregnancy.milestones.title": "Pregnancy milestones retrieved",
      "pregnancy.milestones.week": `Week ${options?.week || ""}`,
      "errors.server_error": "Internal server error",
      "pregnancy.no_ai_insight": "AI insight not available at the moment",
      "pregnancy.status_with_insight": "Pregnancy status with AI insight retrieved",
      "pregnancy.form_updated": "Pregnancy form updated successfully",
    }

    return fallbackTranslations[key] || key
  }

  static async submitPregnancyForm(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: PregnancyController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      const { dateOfBirth, pregnancyStatus, lastDateOfMenstruation, gravida, term, preterm, abortion, living } =
        req.body

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
            message: PregnancyController.getTranslation(req, "pregnancy.invalid_lmp_date"),
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
      const pregnancyForm = PregnancyController.pregnancyRepository.create(pregnancyData)
      const savedPregnancyForm = await PregnancyController.pregnancyRepository.save(pregnancyForm)

      // Send WhatsApp confirmation message
      try {
        await NotificationService.sendPregnancyFormConfirmation(
          req.user,
          savedPregnancyForm as unknown as PregnancyForm,
        )
      } catch (error) {
        console.error("Failed to send WhatsApp confirmation:", error)
        // Don't fail the form submission if WhatsApp message fails
      }

      res.status(201).json({
        success: true,
        message: PregnancyController.getTranslation(req, "pregnancy.form.save"),
        data: savedPregnancyForm,
      })
    } catch (error) {
      console.error("Submit pregnancy form error:", error)
      next(error)
    }
  }

  static async getPregnancyStatus(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Get latest pregnancy form for the user
      const pregnancyForm = await PregnancyController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: PregnancyController.getTranslation(req, "pregnancy.form_not_found"),
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

        await PregnancyController.pregnancyRepository.save(pregnancyForm)
      }

      res.json({
        success: true,
        message: PregnancyController.getTranslation(req, "pregnancy.status_retrieved"),
        data: pregnancyForm,
      })
    } catch (error) {
      console.error("Get pregnancy status error:", error)
      next(error)
    }
  }

  static async getMilestones(req: AuthenticatedRequest & LocalizedRequest, res: Response): Promise<void> {
    try {
      const { week } = req.query
      const language = (req.language as Language) || "en"

      const queryBuilder = PregnancyController.milestoneRepository
        .createQueryBuilder("milestone")
        .leftJoinAndSelect("milestone.translations", "translation", "translation.language = :language", { language })
        .where("milestone.isActive = :isActive", { isActive: true })

      if (week) {
        queryBuilder.andWhere("milestone.week = :week", { week: Number.parseInt(week as string) })
      }

      const milestones = await queryBuilder.orderBy("milestone.week", "ASC").getMany()

      const localizedMilestones = milestones.map((milestone) => ({
        id: milestone.id,
        week: milestone.week,
        trimester: milestone.trimester,
        imageUrl: milestone.imageUrl,
        title:
          milestone.translations[0]?.title ||
          PregnancyController.getTranslation(req, "pregnancy.milestones.week", { week: milestone.week }),
        babyDevelopment: milestone.translations[0]?.babyDevelopment || "",
        motherChanges: milestone.translations[0]?.motherChanges || "",
        tips: milestone.translations[0]?.tips || "",
        warnings: milestone.translations[0]?.warnings || "",
      }))

      res.json({
        success: true,
        message: PregnancyController.getTranslation(req, "pregnancy.milestones.title"),
        data: { milestones: localizedMilestones },
      })
    } catch (error) {
      console.error("Get milestones error:", error)
      res.status(500).json({
        success: false,
        message: PregnancyController.getTranslation(req, "errors.server_error"),
      })
    }
  }

  static async getPregnancyStatusWithAIInsight(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const pregnancyForm = await PregnancyController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: PregnancyController.getTranslation(req, "pregnancy.form_not_found"),
        })
        return
      }

      if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.lastDateOfMenstruation) {
        const lmpDate = new Date(pregnancyForm.lastDateOfMenstruation)
        if (!isNaN(lmpDate.getTime())) {
          const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(lmpDate)
          pregnancyForm.currentTrimester = pregnancyDetails.trimester
          pregnancyForm.gestationalWeeks = pregnancyDetails.gestationalAge.weeks
          pregnancyForm.gestationalDays = pregnancyDetails.gestationalAge.days
          await PregnancyController.pregnancyRepository.save(pregnancyForm)
        }
      }

      const userData = req.user
      const pregnancyData = pregnancyForm
      const language = req.language || userData.language || "en"

      // Enhanced language-specific prompts with cultural context
      const languagePrompts = {
        en: {
          instruction: "Provide a concise, encouraging, and informative pregnancy update in English",
          languageName: "English",
          culturalContext: "Use encouraging and supportive tone typical in English-speaking healthcare",
        },
        fr: {
          instruction: "Fournissez une mise à jour de grossesse concise, encourageante et informative en français",
          languageName: "French",
          culturalContext: "Utilisez un ton encourageant et bienveillant typique des soins de santé francophones",
        },
        rw: {
          instruction: "Tanga amakuru y'inda make, ashimangira kandi afasha mu kinyarwanda",
          languageName: "Kinyarwanda",
          culturalContext: "Koresha ijambo rishimangira kandi rifasha nk'uko bisanzwe mu buvuzi bwa kinyarwanda",
        },
      }

      const selectedLanguage = languagePrompts[language as keyof typeof languagePrompts] || languagePrompts.en

      // Convert all date fields to Date objects if they exist
      const dateOfBirth = pregnancyData.dateOfBirth ? new Date(pregnancyData.dateOfBirth) : null
      const lastDateOfMenstruation = pregnancyData.lastDateOfMenstruation
        ? new Date(pregnancyData.lastDateOfMenstruation)
        : null
      const expectedDeliveryDate = pregnancyData.expectedDeliveryDate
        ? new Date(pregnancyData.expectedDeliveryDate)
        : null

      // Enhanced prompt construction with better language specification
      const prompt = `
      ${selectedLanguage.instruction} for the user based on their pregnancy information.
      
      LANGUAGE REQUIREMENTS:
      - Respond ONLY in ${selectedLanguage.languageName}
      - ${selectedLanguage.culturalContext}
      - Keep response under 100 words
      - Use warm, encouraging, and supportive tone
      - Include relevant pregnancy advice for their current stage
      
      User Profile:
      First Name: ${userData.profile?.firstName || "N/A"}
      Last Name: ${userData.profile?.lastName || "N/A"}
      Date of Birth: ${dateOfBirth && !isNaN(dateOfBirth.getTime()) ? dateOfBirth.toDateString() : "N/A"}
      Preferred Language: ${selectedLanguage.languageName}
      
      Current Pregnancy Information:
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
      
      CRITICAL: Your entire response must be in ${selectedLanguage.languageName} language only. 
      Do not mix languages or provide translations. 
      Address the user by their first name if available.
      Focus on their current pregnancy stage and provide relevant, encouraging advice.
    `

      let aiInsight = PregnancyController.getTranslation(req, "pregnancy.no_ai_insight")
      try {
        aiInsight = await geminiService.generateText(prompt)

        // Validate that the response is in the correct language (basic check)
        if (aiInsight && aiInsight.length > 10) {
          // Log successful generation for monitoring
          console.log(`AI insight generated successfully in ${selectedLanguage.languageName} for user ${userData.id}`)
        } else {
          throw new Error("AI response too short or empty")
        }
      } catch (aiError) {
        console.warn("Could not get AI insight:", aiError)
        // Provide language-specific fallback messages
        const fallbackMessages = {
          en: "Your pregnancy journey is progressing well. Keep taking care of yourself and your baby!",
          fr: "Votre grossesse se déroule bien. Continuez à prendre soin de vous et de votre bébé !",
          rw: "Inda yawe igenda neza. Komeza kwita ku buzima bwawe n'ubw'uruhinja rwawe!",
        }
        aiInsight = fallbackMessages[language as keyof typeof fallbackMessages] || fallbackMessages.en
      }

      res.json({
        success: true,
        message: PregnancyController.getTranslation(req, "pregnancy.status_with_insight"),
        data: {
          ...pregnancyForm,
          aiInsight: aiInsight,
          language: language, // Include language in response for frontend reference
        },
      })
    } catch (error) {
      console.error("Get pregnancy status with AI insight error:", error)
      next(error)
    }
  }


  static async updatePregnancyForm(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: PregnancyController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      // Get latest pregnancy form
      const pregnancyForm = await PregnancyController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: PregnancyController.getTranslation(req, "pregnancy.form_not_found"),
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
            message: PregnancyController.getTranslation(req, "pregnancy.invalid_lmp_date"),
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
      await PregnancyController.pregnancyRepository.save(pregnancyForm)

      res.json({
        success: true,
        message: PregnancyController.getTranslation(req, "pregnancy.form_updated"),
        data: pregnancyForm,
      })
    } catch (error) {
      console.error("Update pregnancy form error:", error)
      next(error)
    }
  }
}
