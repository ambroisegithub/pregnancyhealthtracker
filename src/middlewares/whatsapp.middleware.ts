import type { Request, Response, NextFunction } from "express"
import crypto from "crypto"

export class WhatsAppMiddleware {
  // Verify Twilio webhook signature
  static verifyTwilioSignature(req: Request, res: Response, next: NextFunction): void {
    const signature = req.headers["x-twilio-signature"] as string
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`

    if (!signature || !authToken) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    // Create expected signature
    const expectedSignature = crypto
      .createHmac("sha1", authToken)
      .update(Buffer.from(url + JSON.stringify(req.body), "utf-8"))
      .digest("base64")

    if (signature !== `sha1=${expectedSignature}`) {
      res.status(401).json({ error: "Invalid signature" })
      return
    }

    next()
  }

  // Rate limiting for WhatsApp messages
  static rateLimitWhatsApp(req: Request, res: Response, next: NextFunction): void {
    // Implement rate limiting logic here
    // For now, just pass through
    next()
  }

  // Log WhatsApp interactions
  static logWhatsAppInteraction(req: Request, res: Response, next: NextFunction): void {
    const { From, Body, MessageSid } = req.body

    console.log(`WhatsApp Interaction: ${new Date().toISOString()}`)
    console.log(`From: ${From}`)
    console.log(`Message: ${Body}`)
    console.log(`MessageSid: ${MessageSid}`)

    next()
  }
}
