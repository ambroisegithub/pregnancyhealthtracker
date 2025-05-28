
// @ts-nocheck
import type { Response, NextFunction } from "express"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import dbConnection from "../database"
import { DailyTip } from "../database/models/DailyTip"
import { PregnancyForm } from "../database/models/PregnancyForm"
import type { Language } from "../database/models/User"
import { geminiService } from "../services/geminiService"

export class DailyTipController {
  private static dailyTipRepository = dbConnection.getRepository(DailyTip)
  private static pregnancyRepository = dbConnection.getRepository(PregnancyForm)

  // Fallback translation function
  private static getTranslation(req: any, key: string): string {
    if (req.t && typeof req.t === "function") {
      return req.t(key)
    }

    const fallbackTranslations: Record<string, string> = {
      "tips.daily_tips": "Daily Tips",
      "tips.no_tips": "No tips available",
      "tips.generating": "Generating personalized tip for you...",
      "tips.generated_success": "Daily tip generated successfully",
      "tips.generation_failed": "Failed to generate daily tip",
      "pregnancy.form_required": "Pregnancy form is required",
      "errors.server_error": "Internal server error",
      "common.success": "Success",
    }

    return fallbackTranslations[key] || key
  }

  private static async generatePersonalizedTipPrompt(
    user: any,
    pregnancyForm: PregnancyForm,
    language: Language,
    tipDate: string,
  ): Promise<string> {
    const languageInstructions = {
      en: "Please respond in English.",
      fr: "Veuillez répondre en français.",
      rw: "Nyamuneka subiza mu kinyarwanda.",
    }

    const basePrompt = `You are a professional pregnancy health advisor. Create a personalized daily tip for a pregnant woman.

User Profile:
- Name: ${user.firstName || "Dear Mom"}
- Pregnancy Status: ${pregnancyForm.pregnancyStatus}
- Current Week: ${pregnancyForm.gestationalWeeks || "Unknown"}
- Trimester: ${pregnancyForm.currentTrimester || 1}
- Date: ${tipDate}
- Language: ${language}

${languageInstructions[language] || languageInstructions.en}

Requirements:
1. Create ONE simple, actionable daily tip
2. Keep it SHORT (maximum 2-3 sentences)
3. Make it specific to week ${pregnancyForm.gestationalWeeks || 1} of pregnancy
4. Use simple, encouraging language
5. Focus on practical advice
6. Include ONE relevant emoji at the start
7. Address the user personally using their name

Format your response as:
TITLE: [Short catchy title with emoji]
CONTENT: [2-3 sentences of practical advice]

Examples:
TITLE: 💊 Take Your Prenatal Vitamins
CONTENT: ${user.firstName || "Dear Mom"}, don't forget your prenatal vitamins today! They provide essential folic acid and nutrients your baby needs for healthy development.

TITLE: 🚶‍♀️ Gentle Movement Today
CONTENT: ${user.firstName || "Dear Mom"}, try a 10-minute gentle walk today. Light exercise helps reduce pregnancy discomfort and boosts your energy levels.`

    return basePrompt
  }

  private static async generateAndSaveDailyTip(
    user: any,
    pregnancyForm: PregnancyForm,
    language: Language,
    tipDate: string,
  ): Promise<DailyTip> {
    try {
      // Generate AI content
      const prompt = await this.generatePersonalizedTipPrompt(user, pregnancyForm, language, tipDate)
      const aiResponse = await geminiService.generateResponse(prompt, language)

      // Parse the AI response
      const lines = aiResponse.split("\n").filter((line) => line.trim())
      let title = "💡 Daily Tip"
      let content = aiResponse
      let icon = "💡"

      // Try to extract title and content from formatted response
      for (const line of lines) {
        if (line.startsWith("TITLE:")) {
          title = line.replace("TITLE:", "").trim()
          // Extract emoji from title
          const emojiMatch = title.match(/^(\p{Emoji})/u)
          if (emojiMatch) {
            icon = emojiMatch[1]
          }
        } else if (line.startsWith("CONTENT:")) {
          content = line.replace("CONTENT:", "").trim()
        }
      }

      // If parsing failed, use the whole response as content
      if (!content || content === aiResponse) {
        content = aiResponse
        // Try to extract emoji from the beginning of content
        const emojiMatch = content.match(/^(\p{Emoji})/u)
        if (emojiMatch) {
          icon = emojiMatch[1]
        }
      }

      // Create and save the daily tip
      const dailyTip = this.dailyTipRepository.create({
        user: user,
        tipDate: tipDate,
        title: title.substring(0, 255),
        content: content,
        icon: icon,
        language: language,
        gestationalWeek: pregnancyForm.gestationalWeeks,
        trimester: pregnancyForm.currentTrimester,
        pregnancyStatus: pregnancyForm.pregnancyStatus,
        category: "daily",
        isActive: true,
      })

      const savedTip = await this.dailyTipRepository.save(dailyTip)
      console.log(`Generated daily tip for user ${user.id} on ${tipDate}:`, savedTip.title)

      return savedTip
    } catch (error) {
      console.error("Error generating daily tip:", error)
      throw new Error("Failed to generate personalized daily tip")
    }
  }

  static async getMyDailyTips(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const language = req.language as Language
      const { date } = req.query
      const tipDate = (date as string) || new Date().toISOString().split("T")[0]

      console.log(`Getting daily tips for user ${req.user.id} on ${tipDate} in ${language}`)

      // Get user's latest pregnancy status
      const pregnancyForm = await DailyTipController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: DailyTipController.getTranslation(req, "pregnancy.form_required"),
        })
        return
      }

      // Check if tip already exists for this user, date, and language
      let dailyTip = await DailyTipController.dailyTipRepository.findOne({
        where: {
          user: { id: req.user.id },
          tipDate: tipDate,
          language: language,
          isActive: true,
        },
        relations: ["user"],
      })

      // If no tip exists, generate one
      if (!dailyTip) {
        console.log(`No existing tip found, generating new tip for user ${req.user.id}`)
        dailyTip = await DailyTipController.generateAndSaveDailyTip(req.user, pregnancyForm, language, tipDate)
      }

      // Format response
      const tipResponse = {
        id: dailyTip.id,
        title: dailyTip.title,
        content: dailyTip.content,
        icon: dailyTip.icon,
        date: dailyTip.tipDate,
        category: dailyTip.category,
        gestationalWeek: dailyTip.gestationalWeek,
        trimester: dailyTip.trimester,
        pregnancyStatus: dailyTip.pregnancyStatus,
        language: dailyTip.language,
        createdAt: dailyTip.createdAt,
      }

      res.json({
        success: true,
        message: DailyTipController.getTranslation(req, "tips.daily_tips"),
        data: {
          tip: tipResponse,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
            expectedDeliveryDate: pregnancyForm.expectedDeliveryDate,
          },
        },
      })
    } catch (error) {
      console.error("Get daily tips error:", error)
      res.status(500).json({
        success: false,
        message: DailyTipController.getTranslation(req, "errors.server_error"),
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    }
  }

  static async getWeeklyTips(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const language = req.language as Language
      const { week } = req.query

      // Get user's latest pregnancy status
      const pregnancyForm = await DailyTipController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: DailyTipController.getTranslation(req, "pregnancy.form_required"),
        })
        return
      }

      const targetWeek = week ? Number(week) : pregnancyForm.gestationalWeeks || 1

      // Get tips for the specified week
      const weeklyTips = await DailyTipController.dailyTipRepository.find({
        where: {
          user: { id: req.user.id },
          gestationalWeek: targetWeek,
          language: language,
          isActive: true,
        },
        order: { tipDate: "DESC" },
        take: 7, // Last 7 tips for the week
      })

      // If no tips exist for this week, generate one for today
      if (weeklyTips.length === 0) {
        const today = new Date().toISOString().split("T")[0]
        const newTip = await DailyTipController.generateAndSaveDailyTip(req.user, pregnancyForm, language, today)
        weeklyTips.push(newTip)
      }

      const tipsResponse = weeklyTips.map((tip) => ({
        id: tip.id,
        title: tip.title,
        content: tip.content,
        icon: tip.icon,
        date: tip.tipDate,
        category: tip.category,
        gestationalWeek: tip.gestationalWeek,
        trimester: tip.trimester,
        pregnancyStatus: tip.pregnancyStatus,
        language: tip.language,
        createdAt: tip.createdAt,
      }))

      res.json({
        success: true,
        message: DailyTipController.getTranslation(req, "tips.daily_tips"),
        data: {
          tips: tipsResponse,
          week: targetWeek,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
            expectedDeliveryDate: pregnancyForm.expectedDeliveryDate,
          },
        },
      })
    } catch (error) {
      console.error("Get weekly tips error:", error)
      res.status(500).json({
        success: false,
        message: DailyTipController.getTranslation(req, "errors.server_error"),
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    }
  }

  static async getTipsByTrimester(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const language = req.language as Language
      const { trimester } = req.query

      // Get user's latest pregnancy status
      const pregnancyForm = await DailyTipController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: DailyTipController.getTranslation(req, "pregnancy.form_required"),
        })
        return
      }

      const targetTrimester = trimester ? Number(trimester) : pregnancyForm.currentTrimester || 1

      // Get tips for the specified trimester
      const trimesterTips = await DailyTipController.dailyTipRepository.find({
        where: {
          user: { id: req.user.id },
          trimester: targetTrimester,
          language: language,
          isActive: true,
        },
        order: { tipDate: "DESC" },
        take: 10, // Last 10 tips for the trimester
      })

      const tipsResponse = trimesterTips.map((tip) => ({
        id: tip.id,
        title: tip.title,
        content: tip.content,
        icon: tip.icon,
        date: tip.tipDate,
        category: tip.category,
        gestationalWeek: tip.gestationalWeek,
        trimester: tip.trimester,
        pregnancyStatus: tip.pregnancyStatus,
        language: tip.language,
        createdAt: tip.createdAt,
      }))

      res.json({
        success: true,
        message: DailyTipController.getTranslation(req, "tips.daily_tips"),
        data: {
          tips: tipsResponse,
          trimester: targetTrimester,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
            expectedDeliveryDate: pregnancyForm.expectedDeliveryDate,
          },
        },
      })
    } catch (error) {
      console.error("Get trimester tips error:", error)
      res.status(500).json({
        success: false,
        message: DailyTipController.getTranslation(req, "errors.server_error"),
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    }
  }
}
