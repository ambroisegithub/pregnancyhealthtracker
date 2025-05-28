// @ts-nocheck

import { Router } from "express"
import { WhatsAppController } from "../controllers/whatsapp.controller"
import { i18nMiddleware } from "../middlewares/i18nMiddleware"
import { authenticate } from "../middlewares/authMiddleware"
import { debugMiddleware, authDebugMiddleware } from "../middlewares/debugMiddleware"

const router = Router()

console.log("🔧 === WHATSAPP ROUTES SETUP START ===")

// Add debug middleware to all WhatsApp routes
router.use(debugMiddleware)

// Add a middleware to log ALL requests to this router
router.use((req, res, next) => {
  console.log(`📱 WHATSAPP ROUTER: ${req.method} ${req.originalUrl}`)
  console.log(`- Route path: ${req.path}`)
  console.log(`- Base URL: ${req.baseUrl}`)
  next()
})

// Public webhook endpoints (NO AUTH) - These must be registered FIRST
console.log("🔧 Registering PUBLIC webhook routes (no auth)...")

// Test endpoint
router.get("/test-public", (req, res) => {
  console.log("🎯 TEST PUBLIC ROUTE HIT")
  res.json({
    success: true,
    message: "Public route working - no authentication required",
    timestamp: new Date().toISOString(),
    url: req.url,
    originalUrl: req.originalUrl,
  })
})

// Webhook status
router.get(
  "/webhook-status",
  (req, res, next) => {
    console.log("🎯 WEBHOOK STATUS ROUTE HIT")
    next()
  },
  WhatsAppController.getWebhookStatus,
)

// Webhook verification (GET)
router.get(
  "/webhook",
  (req, res, next) => {
    console.log("🎯 WEBHOOK GET ROUTE HIT (verification)")
    next()
  },
  WhatsAppController.verifyWebhook,
)

// Webhook message handler (POST) - This is the main problematic route
router.post(
  "/webhook",
  (req, res, next) => {
    console.log("🎯 WEBHOOK POST ROUTE HIT (message handler)")
    console.log("- This should NOT require authentication")
    next()
  },
  WhatsAppController.receiveMessage,
)

console.log("✅ Public routes registered")

// Add auth debug middleware
console.log("🔧 Adding auth debug middleware...")
router.use(authDebugMiddleware)

// Add middleware to check if auth should be applied
router.use((req, res, next) => {
  console.log(`🔐 AUTH CHECK: ${req.url}`)
  console.log(`- Is webhook route: ${req.url.includes("/webhook")}`)
  console.log(`- Is test route: ${req.url.includes("/test-public")}`)

  // Skip auth for webhook and test routes
  if (req.url.includes("/webhook") || req.url.includes("/test-public")) {
    console.log("⚠️ WARNING: Auth middleware should not apply to this route!")
  }

  next()
})

console.log("🔧 Applying authentication middleware to protected routes...")
// Apply authentication to remaining routes
router.use(authenticate)
router.use(i18nMiddleware)

console.log("🔧 Registering PROTECTED routes (require auth)...")
router.post("/link-whatsapp", WhatsAppController.linkWhatsAppNumber)
router.post("/send-test", WhatsAppController.sendTestMessage)
router.get("/status", WhatsAppController.getWhatsAppStatus)

console.log("✅ === WHATSAPP ROUTES SETUP COMPLETE ===")

export default router
