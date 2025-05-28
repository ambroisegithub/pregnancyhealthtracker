import type { Response, NextFunction } from "express"
import { validationResult } from "express-validator"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import dbConnection from "../database"
import { PregnancyForm } from "../database/models/PregnancyForm"
import { User } from "../database/models/User"
import { ChatHistory } from "../database/models/ChatHistory"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"
import { geminiService } from "../services/geminiService"

export class ChatController {
  static userRepository = dbConnection.getRepository(User)
  static pregnancyRepository = dbConnection.getRepository(PregnancyForm)
  static chatHistoryRepository = dbConnection.getRepository(ChatHistory)

  // Fallback translation function
  private static getTranslation(req: LocalizedRequest, key: string): string {
    if (req.t && typeof req.t === "function") {
      try {
        return req.t(key)
      } catch (error) {
        console.error("Translation error:", error)
      }
    }

    // Fallback translations
    const fallbackTranslations: Record<string, string> = {
      "errors.validation_error": "Validation error",
      "errors.server_error": "Internal server error",
      "chat.message_required": "Message is required",
      "chat.response_generated": "Response generated successfully",
      "chat.chat_history": "Chat history retrieved successfully",
      "chat.history_cleared": "Chat history cleared successfully",
      "auth.user_not_found": "User not found",
      "common.success": "Success",
    }

    return fallbackTranslations[key] || key
  }

  static async startOrContinueChat(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: ChatController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      const { message } = req.body
      const userId = req.user.id
      const language = req.language || "en"

      if (!message) {
        res.status(400).json({
          success: false,
          message: ChatController.getTranslation(req, "chat.message_required"),
        })
        return
      }

      // 1. Fetch User Profile and Pregnancy Data
      const user = await ChatController.userRepository.findOne({
        where: { id: userId },
        relations: ["profile"],
      })
      if (!user) {
        res.status(404).json({
          success: false,
          message: ChatController.getTranslation(req, "auth.user_not_found"),
        })
        return
      }

      const pregnancyForm = await ChatController.pregnancyRepository.findOne({
        where: { user: { id: userId } },
        order: { createdAt: "DESC" },
      })

      // Update gestational age if pregnant and LMP is available
      if (pregnancyForm && pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.lastDateOfMenstruation) {
        const lmpDate = new Date(pregnancyForm.lastDateOfMenstruation)
        if (!isNaN(lmpDate.getTime())) {
          const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(lmpDate)
          pregnancyForm.currentTrimester = pregnancyDetails.trimester
          pregnancyForm.gestationalWeeks = pregnancyDetails.gestationalAge.weeks
          pregnancyForm.gestationalDays = pregnancyDetails.gestationalAge.days
          await ChatController.pregnancyRepository.save(pregnancyForm)
        }
      }

      // 2. Fetch Conversation History for the user
      const rawHistory = await ChatController.chatHistoryRepository.find({
        where: { user: { id: userId } },
        order: { createdAt: "ASC" },
        take: 20,
      })

      // Format history for Gemini API
      const geminiHistory: { role: "user" | "model"; parts: { text: string }[] }[] = rawHistory.map((entry) => ({
        role: entry.role,
        parts: [{ text: entry.content }],
      }))

      // Create language-aware context prompt
      const languageInstructions = {
        en: "Respond in English",
        fr: "Répondez en français",
        rw: "Subiza mu kinyarwanda",
      }

      const initialContextPrompt = `
        You are a supportive and informative AI assistant specializing in pregnancy and women's health.
        Your goal is to provide helpful, encouraging, and accurate information based on the user's specific context.
        Always advise users to consult with a healthcare professional for medical advice.
        Keep responses concise and easy to understand.
        
        IMPORTANT: ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en}. The user's preferred language is ${language}.

        Here is the user's current profile and pregnancy information:
        ---
        User Profile:
        First Name: ${user.profile?.firstName || "N/A"}
        Last Name: ${user.profile?.lastName || "N/A"}
        Date of Birth: ${user.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toDateString() : "N/A"}
        Language: ${language}

        Pregnancy Information (if available):
        ${
          pregnancyForm
            ? `
          Pregnancy Status: ${pregnancyForm.pregnancyStatus}
          ${pregnancyForm.lastDateOfMenstruation ? `Last Menstruation Date: ${new Date(pregnancyForm.lastDateOfMenstruation).toDateString()}` : ""}
          Gravida (Total Pregnancies): ${pregnancyForm.gravida || "N/A"}
          Term Births: ${pregnancyForm.term || "N/A"}
          Preterm Births: ${pregnancyForm.preterm || "N/A"}
          Abortions/Miscarriages: ${pregnancyForm.abortion || "N/A"}
          Living Children: ${pregnancyForm.living || "N/A"}
          ${pregnancyForm.expectedDeliveryDate ? `Expected Delivery Date: ${new Date(pregnancyForm.expectedDeliveryDate).toDateString()}` : ""}
          ${pregnancyForm.currentTrimester ? `Current Trimester: ${pregnancyForm.currentTrimester}` : ""}
          ${pregnancyForm.gestationalWeeks !== null && pregnancyForm.gestationalWeeks !== undefined ? `Gestational Age: ${pregnancyForm.gestationalWeeks} weeks and ${pregnancyForm.gestationalDays} days` : ""}
        `
            : "No detailed pregnancy information submitted yet."
        }
        ---

        Based on the above context and the conversation history, respond to the user's query in their preferred language (${language}).
        Do not repeat the provided user and pregnancy information unless specifically asked.
        Focus on answering the user's direct question while incorporating relevant context.
      `

      const fullUserMessage = `${initialContextPrompt}\n\nUser's message: ${message}`

      const aiResponseContent = await geminiService.generateChatResponse(
        initialContextPrompt,
        geminiHistory,
        fullUserMessage,
      )

      // Save user message with language
      const userMessageEntry = ChatController.chatHistoryRepository.create({
        user: user,
        role: "user",
        content: message,
        language: language,
      })
      await ChatController.chatHistoryRepository.save(userMessageEntry)

      // Save AI response with language
      const aiMessageEntry = ChatController.chatHistoryRepository.create({
        user: user,
        role: "model",
        content: aiResponseContent,
        language: language,
      })
      await ChatController.chatHistoryRepository.save(aiMessageEntry)

      res.status(200).json({
        success: true,
        message: ChatController.getTranslation(req, "chat.response_generated"),
        data: {
          response: aiResponseContent,
        },
      })
    } catch (error) {
      console.error("Error in chat endpoint:", error)
      res.status(500).json({
        success: false,
        message: ChatController.getTranslation(req, "errors.server_error"),
      })
    }
  }

  static async getChatHistory(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user.id
      const { page = 1, limit = 50 } = req.query

      const chatHistory = await ChatController.chatHistoryRepository.find({
        where: { user: { id: userId } },
        order: { createdAt: "DESC" },
        skip: (Number.parseInt(page as string) - 1) * Number.parseInt(limit as string),
        take: Number.parseInt(limit as string),
      })

      // Reverse to show oldest first
      const messages = chatHistory.reverse().map((chat) => ({
        id: chat.id,
        message: chat.content,
        isFromUser: chat.role === "user",
        language: chat.language,
        createdAt: chat.createdAt,
      }))

      res.json({
        success: true,
        message: ChatController.getTranslation(req, "chat.chat_history"),
        data: {
          messages,
          pagination: {
            page: Number.parseInt(page as string),
            limit: Number.parseInt(limit as string),
            total: messages.length,
          },
        },
      })
    } catch (error) {
      console.error("Get chat history error:", error)
      res.status(500).json({
        success: false,
        message: ChatController.getTranslation(req, "errors.server_error"),
      })
    }
  }

  static async clearChatHistory(req: AuthenticatedRequest & LocalizedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user.id

      await ChatController.chatHistoryRepository.delete({ user: { id: userId } })

      res.json({
        success: true,
        message: ChatController.getTranslation(req, "chat.history_cleared"),
      })
    } catch (error) {
      console.error("Clear chat history error:", error)
      res.status(500).json({
        success: false,
        message: ChatController.getTranslation(req, "errors.server_error"),
      })
    }
  }
}
