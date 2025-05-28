import type { Request, Response, NextFunction } from "express"
import { whatsappService } from "../services/whatsapp.service"
import dbConnection from "../database"
import { User } from "../database/models/User"

export class WhatsAppController {
  // Webhook to receive incoming WhatsApp messages
  static async receiveMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { From, Body, MessageSid } = req.body

      console.log(`Received WhatsApp message from ${From}: ${Body}`)
      console.log(`Message SID: ${MessageSid}`)

      // Find user by phone number (handle both formats)
      const phoneNumber = From.replace("whatsapp:", "")
      const userRepository = dbConnection.getRepository(User)

      const user = await userRepository.findOne({
        where: { phoneNumber },
        relations: ["profile"],
      })

      console.log(`User found: ${user ? `${user.profile?.firstName} ${user.profile?.lastName}` : "No user found"}`)

      // Generate response
      const response = await whatsappService.handleIncomingMessage(From, Body, user ?? undefined)

      console.log(`AI Response: ${response}`)

      // Send response back
      const success = await whatsappService.sendMessage(phoneNumber, response)

      if (success) {
        console.log(`Response sent successfully to ${phoneNumber}`)
      } else {
        console.error(`Failed to send response to ${phoneNumber}`)
      }

      res.status(200).json({ success: true, message: "Message processed" })
    } catch (error) {
      console.error("Error processing WhatsApp message:", error)

      // Try to send error message to user
      try {
        const phoneNumber = req.body.From?.replace("whatsapp:", "")
        if (phoneNumber) {
          await whatsappService.sendMessage(
            phoneNumber,
            "Sorry, I'm experiencing technical difficulties. Please try again later or contact support. 🔧",
          )
        }
      } catch (sendError) {
        console.error("Failed to send error message:", sendError)
      }

      next(error)
    }
  }

  // Webhook verification for Twilio
  static async verifyWebhook(req: Request, res: Response): Promise<void> {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query

    console.log(`Webhook verification attempt - Mode: ${mode}, Token: ${token}`)

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("WhatsApp webhook verified successfully")
      res.status(200).send(challenge)
    } else {
      console.log("WhatsApp webhook verification failed")
      res.status(403).send("Verification failed")
    }
  }

  // Send test message (for testing purposes)
  static async sendTestMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber, message } = req.body

      if (!phoneNumber || !message) {
        res.status(400).json({
          success: false,
          message: "Phone number and message are required",
        })
        return
      }

      console.log(`Sending test message to ${phoneNumber}: ${message}`)

      const success = await whatsappService.sendMessage(phoneNumber, message)

      res.json({
        success,
        message: success ? "Message sent successfully" : "Failed to send message",
      })
    } catch (error) {
      console.error("Error sending test message:", error)
      next(error)
    }
  }

  // Link WhatsApp number to user account
  static async linkWhatsAppNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, phoneNumber } = req.body

      if (!userId || !phoneNumber) {
        res.status(400).json({
          success: false,
          message: "User ID and phone number are required",
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
        })
        return
      }

      // Update user's phone number
      user.phoneNumber = phoneNumber
      await userRepository.save(user)

      console.log(
        `WhatsApp linked for user ${user.profile?.firstName} ${user.profile?.lastName} - Phone: ${phoneNumber}`,
      )

      // Send welcome message
      const welcomeMessage = `🎉 Welcome to Pregnancy Support, ${user.profile?.firstName || "there"}! 

Your WhatsApp is now linked to your account. You'll receive:
📅 Daily pregnancy tips
🔔 Important milestone reminders
💬 24/7 AI support for your questions

Feel free to ask me anything about your pregnancy journey! 🤱

Try asking: "What's my current status?" or "Tell me about my pregnancy journey"`

      await whatsappService.sendMessage(phoneNumber, welcomeMessage)

      res.json({
        success: true,
        message: "WhatsApp number linked successfully",
      })
    } catch (error) {
      console.error("Error linking WhatsApp number:", error)
      next(error)
    }
  }

  // Get webhook status (for debugging)
  static async getWebhookStatus(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      message: "WhatsApp webhook is active",
      webhookUrl: `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`,
      timestamp: new Date().toISOString(),
    })
  }
}
