import { Router } from "express"
import { SMSController } from "../controllers/sms.controller"
import { body } from "express-validator"

const router = Router()

// Webhook for receiving SMS messages
router.post("/webhook", SMSController.receiveSMS)

// Get SMS status (for debugging)
router.get("/status", SMSController.getSMSStatus)

// Send test SMS
router.post(
  "/send-test",
  [
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
    body("message").notEmpty().withMessage("Message is required"),
  ],
  SMSController.sendTestSMS,
)

export default router
