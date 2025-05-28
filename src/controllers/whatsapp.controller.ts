import type { Request, Response, NextFunction } from "express"
import { whatsappService } from "../services/whatsapp.service"
import dbConnection from "../database"
import { User } from "../database/models/User"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"

export class WhatsAppController {
  // Webhook to receive incoming WhatsApp messages
  static async receiveMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = req.requestId || Math.random().toString(36).substring(7)
    const startTime = Date.now()

    try {
      console.log(`🎯 [${requestId}] === WEBHOOK RECEIVE MESSAGE START ===`)
      console.log(`- Timestamp: ${new Date().toISOString()}`)
      console.log(`- Method: ${req.method}`)
      console.log(`- URL: ${req.url}`)
      console.log(`- Original URL: ${req.originalUrl}`)
      console.log(`- IP: ${req.ip}`)
      console.log(`- User Agent: ${req.get("User-Agent")}`)
      console.log(`- Content Type: ${req.get("Content-Type")}`)
      console.log(`- Headers:`, JSON.stringify(req.headers, null, 2))
      console.log(`- Body:`, JSON.stringify(req.body, null, 2))

      const { From, Body, MessageSid, AccountSid, To } = req.body

      if (!From || !Body) {
        console.log(`⚠️ [${requestId}] Missing required fields`)
        res.status(400).json({
          success: false,
          message: "Missing required fields (From, Body)",
          received: { From, Body, MessageSid },
          requestId,
        })
        return
      }

      console.log(`📱 [${requestId}] Processing message:`)
      console.log(`- From: ${From}`)
      console.log(`- To: ${To}`)
      console.log(`- Body: ${Body}`)
      console.log(`- MessageSid: ${MessageSid}`)

      // Find user by phone number
      const phoneNumber = From.replace("whatsapp:", "")
      console.log(`🔍 [${requestId}] Looking up user: ${phoneNumber}`)

      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({
        where: { phoneNumber },
        relations: ["profile"],
      })

      console.log(
        `👤 [${requestId}] User found: ${user ? `${user.profile?.firstName} ${user.profile?.lastName}` : "No user found"}`,
      )

      // Generate AI response
      const userLanguage = user?.language || "en"
      console.log(`🤖 [${requestId}] Generating response in ${userLanguage}...`)

      const response = await whatsappService.handleIncomingMessage(From, Body, user ?? undefined, userLanguage)

      console.log(`🤖 [${requestId}] Response generated (${response.length} chars)`)

      // Send response
      const success = await whatsappService.sendMessage(phoneNumber, response)

      const processingTime = Date.now() - startTime
      console.log(`⏱️ [${requestId}] Processing complete: ${processingTime}ms`)

      res.status(200).json({
        success: true,
        message: "Message processed successfully",
        requestId,
        processingTime: `${processingTime}ms`,
        userFound: !!user,
        responseSent: success,
      })
    } catch (error) {
      const processingTime = Date.now() - startTime
      console.error(`❌ [${requestId}] Error processing webhook:`, error)

      // Try to send error message
      try {
        const phoneNumber = req.body.From?.replace("whatsapp:", "")
        if (phoneNumber) {
          await whatsappService.sendMessage(
            phoneNumber,
            "Sorry, I'm experiencing technical difficulties. Please try again later. 🔧",
          )
        }
      } catch (sendError) {
        console.error(`❌ [${requestId}] Failed to send error message:`, sendError)
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        requestId,
        processingTime: `${processingTime}ms`,
      })
    }
  }

  // Webhook verification
  static async verifyWebhook(req: Request, res: Response): Promise<void> {
    const requestId = req.requestId || Math.random().toString(36).substring(7)

    try {
      console.log(`🔍 [${requestId}] Webhook verification:`)
      console.log(`- Query:`, JSON.stringify(req.query, null, 2))

      const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query

      console.log(`🔍 [${requestId}] Verification params:`)
      console.log(`- Mode: ${mode}`)
      console.log(`- Token: ${token}`)
      console.log(`- Expected: ${process.env.WHATSAPP_VERIFY_TOKEN}`)
      console.log(`- Challenge: ${challenge}`)

      if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log(`✅ [${requestId}] Verification successful`)
        res.status(200).send(challenge)
      } else {
        console.log(`❌ [${requestId}] Verification failed`)
        res.status(403).send("Verification failed")
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Verification error:`, error)
      res.status(500).send("Internal server error")
    }
  }

  // Send test message (authenticated)
  static async sendTestMessage(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const requestId = req.requestId || Math.random().toString(36).substring(7)

    try {
      console.log(`🧪 [${requestId}] Send test message`)
      const { phoneNumber, message } = req.body
      const userId = req.user.id

      if (!phoneNumber || !message) {
        res.status(400).json({
          success: false,
          message: "Phone number and message are required",
          requestId,
        })
        return
      }

      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ["profile"],
      })

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
          requestId,
        })
        return
      }

      if (user.phoneNumber !== phoneNumber) {
        res.status(403).json({
          success: false,
          message: "You can only send test messages to your own phone number",
          requestId,
        })
        return
      }

      const success = await whatsappService.sendMessage(phoneNumber, message)

      res.json({
        success,
        message: success ? "Message sent successfully" : "Failed to send message",
        requestId,
      })
    } catch (error) {
      console.error(`❌ [${requestId}] Test message error:`, error)
      next(error)
    }
  }

  // Link WhatsApp number (authenticated)
  static async linkWhatsAppNumber(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const requestId = req.requestId || Math.random().toString(36).substring(7)

    try {
      console.log(`🔗 [${requestId}] Link WhatsApp number`)
      const { phoneNumber } = req.body
      const userId = req.user.id

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: "Phone number is required",
          requestId,
        })
        return
      }

      const userRepository = dbConnection.getRepository(User)

      // Check if phone number is already linked
      const existingUser = await userRepository.findOne({
        where: { phoneNumber },
        relations: ["profile"],
      })

      if (existingUser && existingUser.id !== userId) {
        res.status(409).json({
          success: false,
          message: "This phone number is already linked to another account",
          requestId,
        })
        return
      }

      // Get current user
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ["profile"],
      })

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
          requestId,
        })
        return
      }

      // Check if already linked
      if (user.phoneNumber === phoneNumber) {
        res.status(200).json({
          success: true,
          message: "Phone number is already linked to your account",
          data: {
            phoneNumber: user.phoneNumber,
            isLinked: true,
          },
          requestId,
        })
        return
      }

      // Update phone number
      user.phoneNumber = phoneNumber
      await userRepository.save(user)

      console.log(`✅ [${requestId}] WhatsApp linked: ${phoneNumber}`)

      // Send welcome message
      const userLanguage = user.language || "en"
      const welcomeMessages = {
        en: `🎉 Welcome to Pregnancy Support, ${user.profile?.firstName || "there"}! 

Your WhatsApp is now linked to your account. You'll receive:
📅 Daily pregnancy tips
🔔 Important milestone reminders
💬 24/7 AI support for your questions

Feel free to ask me anything about your pregnancy journey! 🤱`,
        fr: `🎉 Bienvenue dans Pregnancy Support, ${user.profile?.firstName || "là"}! 

Votre WhatsApp est maintenant lié à votre compte. Vous recevrez:
📅 Conseils quotidiens de grossesse
🔔 Rappels d'étapes importantes
💬 Support IA 24/7 pour vos questions

N'hésitez pas à me poser des questions sur votre parcours de grossesse! 🤱`,
        rw: `🎉 Murakaza neza kuri Pregnancy Support, ${user.profile?.firstName || "aho"}! 

WhatsApp yawe ubu irafatanye na konti yawe. Uzakira:
📅 Inama za buri munsi z'inda
🔔 Ibibutsa by'intambwe z'ingenzi
💬 Ubufasha bwa AI 24/7 ku bibazo byawe

Ntugire ubwoba wo kumbaza ibibazo byose ku rugendo rwawe rw'inda! 🤱`,
      }

      const welcomeMessage = welcomeMessages[userLanguage as keyof typeof welcomeMessages] || welcomeMessages.en

      await whatsappService.sendMessage(phoneNumber, welcomeMessage)

      res.json({
        success: true,
        message: "WhatsApp number linked successfully",
        data: {
          phoneNumber: user.phoneNumber,
          isLinked: true,
        },
        requestId,
      })
    } catch (error) {
      console.error(`❌ [${requestId}] Link error:`, error)
      next(error)
    }
  }

  // Get WhatsApp status (authenticated)
  static async getWhatsAppStatus(req: AuthenticatedRequest & LocalizedRequest, res: Response): Promise<void> {
    const requestId = req.requestId || Math.random().toString(36).substring(7)

    try {
      console.log(`📊 [${requestId}] Get WhatsApp status`)
      const userId = req.user.id
      const userRepository = dbConnection.getRepository(User)

      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ["profile"],
      })

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
          requestId,
        })
        return
      }

      const isLinked = !!user.phoneNumber

      res.json({
        success: true,
        message: "WhatsApp status retrieved successfully",
        data: {
          isLinked,
          phoneNumber: user.phoneNumber || null,
          webhookUrl: `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`,
          timestamp: new Date().toISOString(),
        },
        requestId,
      })
    } catch (error) {
      console.error(`❌ [${requestId}] Status error:`, error)
      res.status(500).json({
        success: false,
        message: "Failed to get WhatsApp status",
        requestId,
      })
    }
  }

  // Get webhook status (for debugging)
  static async getWebhookStatus(req: Request, res: Response): Promise<void> {
    const requestId = req.requestId || Math.random().toString(36).substring(7)

    console.log(`🔍 [${requestId}] Webhook status check`)

    res.json({
      success: true,
      message: "WhatsApp webhook is active",
      webhookUrl: `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`,
      timestamp: new Date().toISOString(),
      requestId,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        whatsappNumberConfigured: !!process.env.WHATSAPP_BUSINESS_NUMBER,
        verifyTokenConfigured: !!process.env.WHATSAPP_VERIFY_TOKEN,
      },
    })
  }
}
