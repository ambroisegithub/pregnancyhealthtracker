import type { Request, Response, NextFunction } from "express"
import { smsService } from "../services/sms.service"
import dbConnection from "../database"
import { User } from "../database/models/User"

export class SMSController {
  // Webhook to receive incoming SMS messages
  static async receiveSMS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { From, Body, MessageSid } = req.body

      console.log(`Received SMS from ${From}: ${Body}`)
      console.log(`Message SID: ${MessageSid}`)

      // Find user by phone number
      const phoneNumber = From
      const userRepository = dbConnection.getRepository(User)

      const user = await userRepository.findOne({
        where: { phoneNumber },
        relations: ["profile"],
      })

      console.log(`User found: ${user ? `${user.profile?.firstName} ${user.profile?.lastName}` : "No user found"}`)

      // Generate response
      const response = await smsService.handleIncomingSMS(From, Body, user ?? undefined)

      console.log(`AI Response: ${response}`)

      // Send response back
      const success = await smsService.sendSMS(phoneNumber, response)

      if (success) {
        console.log(`Response sent successfully to ${phoneNumber}`)
      } else {
        console.error(`Failed to send response to ${phoneNumber}`)
      }

      // Respond to Twilio webhook
      res.set("Content-Type", "text/xml")
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${response}</Message>
</Response>`)
    } catch (error) {
      console.error("Error processing SMS:", error)

      // Try to send error message to user
      try {
        const phoneNumber = req.body.From
        if (phoneNumber) {
          await smsService.sendSMS(
            phoneNumber,
            "Sorry, I'm experiencing technical difficulties. Please try again later or contact support.",
          )
        }
      } catch (sendError) {
        console.error("Failed to send error message:", sendError)
      }

      // Respond to Twilio with error
      res.set("Content-Type", "text/xml")
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I'm experiencing technical difficulties. Please try again later.</Message>
</Response>`)
    }
  }

  // Send test SMS (for testing purposes)
  static async sendTestSMS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber, message } = req.body

      if (!phoneNumber || !message) {
        res.status(400).json({
          success: false,
          message: "Phone number and message are required",
        })
        return
      }

      console.log(`Sending test SMS to ${phoneNumber}: ${message}`)

      const success = await smsService.sendSMS(phoneNumber, message)

      res.json({
        success,
        message: success ? "SMS sent successfully" : "Failed to send SMS",
      })
    } catch (error) {
      console.error("Error sending test SMS:", error)
      next(error)
    }
  }

  // Get SMS status (for debugging)
  static async getSMSStatus(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      message: "SMS service is active",
      webhookUrl: `${req.protocol}://${req.get("host")}/api/sms/webhook`,
      timestamp: new Date().toISOString(),
    })
  }
}
