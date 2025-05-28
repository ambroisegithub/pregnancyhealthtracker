import { Router } from "express"
import { WhatsAppController } from "../controllers/whatsapp.controller"
import { body } from "express-validator"

const router = Router()

// Webhook for receiving WhatsApp messages
router.post("/webhook", WhatsAppController.receiveMessage)

// Webhook verification
router.get("/webhook", WhatsAppController.verifyWebhook)

// Get webhook status (for debugging)
router.get("/status", WhatsAppController.getWebhookStatus)

// Send test message
router.post(
  "/send-test",
  [
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
    body("message").notEmpty().withMessage("Message is required"),
  ],
  WhatsAppController.sendTestMessage,
)

// Link WhatsApp number to user account
router.post(
  "/link-whatsapp",
  [
    body("userId").isInt().withMessage("Valid user ID is required"),
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
  ],
  WhatsAppController.linkWhatsAppNumber,
)

export default router
