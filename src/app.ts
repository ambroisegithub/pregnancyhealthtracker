import "reflect-metadata" // Only once at the very top of this file
import express, { type Application, type Request, type Response, type NextFunction } from "express"
import morgan from "morgan"

// Extend Express Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}
import articleRouter from "./routes/articleRoutes"
import cors from "cors"
import authRouter from "./routes/authRoutes"
import pregnancyRouter from "./routes/pregnancyRoutes"
import chatroutes from "./routes/chatRoutes"
import whatsappRouter from "./routes/whatsappRoutes"
import milestoneRoutes from "./routes/milestoneRoutes"
import reminderRoutes from "./routes/reminderRoutes"
import dailyTipRoutes from "./routes/dailyTipRoutes"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import patientRoutes from "./routes/patientRoutes"
const app: Application = express()

console.log("🚀 === APPLICATION STARTUP ===")

// IMPORTANT: Trust proxy for Render deployment
app.set("trust proxy", true)

// Add global debug middleware FIRST
const globalDebugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.requestId || Math.random().toString(36).substring(7)
  console.log(`🌍 PRE-ROUTE: ${req.method} ${req.url} [${requestId}]`)
  req.requestId = requestId
  next()
}
app.use(globalDebugMiddleware)

// Validate critical environment variables
const requiredEnvVars = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "WHATSAPP_BUSINESS_NUMBER", "WHATSAPP_VERIFY_TOKEN"]

console.log("🔍 Environment Variables Check:")
requiredEnvVars.forEach((envVar) => {
  const value = process.env[envVar]
  console.log(`- ${envVar}: ${value ? "✅ Set" : "❌ Missing"}`)
  if (envVar === "TWILIO_ACCOUNT_SID" && value) {
    console.log(`  - Format valid: ${value.startsWith("AC") ? "✅" : "❌"} (should start with AC)`)
  }
  if (envVar === "WHATSAPP_BUSINESS_NUMBER" && value) {
    console.log(`  - Format: ${value} ${value.startsWith("+") ? "✅" : "⚠️ Should start with +"}`)
  }
})

// Security middleware
app.use(helmet())
app.use(cors())

// Rate limiting - but exclude webhook from rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  skip: (req) => {
    const isWebhook = req.url.includes("/api/whatsapp/webhook")
    if (isWebhook) {
      console.log(`⚡ Skipping rate limit for webhook: ${req.method} ${req.url}`)
    }
    return isWebhook
  },
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan("dev"))

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`🌍 ${new Date().toISOString()} - ${req.method} ${req.url}`)
  console.log(`- IP: ${req.ip}`)
  console.log(`- User-Agent: ${req.get("User-Agent")}`)
  console.log(`- Content-Type: ${req.get("Content-Type")}`)
  console.log(`- Authorization: ${req.get("Authorization") ? "Present" : "Not present"}`)
  next()
})

// Add route registration logging
console.log("🚀 Starting route registration...")

// IMPORTANT: Register WhatsApp routes FIRST to avoid conflicts
console.log("📱 Registering WhatsApp routes at /api/whatsapp...")
app.use("/api/whatsapp", whatsappRouter)

console.log("🔐 Registering auth routes at /api/auth...")
app.use("/api/auth", authRouter)

console.log("🤰 Registering pregnancy routes at /api/pregnancy...")
app.use("/api/pregnancy", pregnancyRouter)

console.log("📚 Registering article routes at /api...")
app.use("/api", articleRouter)

console.log("💬 Registering chat routes at /api...")
app.use("/api", chatroutes)

console.log("🎯 Registering milestone routes at /api/milestones...")
app.use("/api/milestones", milestoneRoutes)

console.log("⏰ Registering reminder routes at /api/reminders...")
app.use("/api/reminders", reminderRoutes)

console.log("💡 Registering daily tip routes at /api/tips...")
app.use("/api/tips", dailyTipRoutes)

console.log("✅ All routes registered successfully")

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to Pregnancy Support API with WhatsApp Integration",
    webhook: `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`,
    status: "active",
  })
})

// Debug endpoint to list all routes
app.get("/debug/routes", (req: Request, res: Response) => {
  const routes: any[] = []

  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
      })
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          routes.push({
            path: middleware.regexp.source.replace("\\/?(?=\\/|$)", "") + handler.route.path,
            methods: Object.keys(handler.route.methods),
          })
        }
      })
    }
  })

  res.json({
    message: "All registered routes",
    routes: routes,
    timestamp: new Date().toISOString(),
  })
})

// Health check with WhatsApp status
app.get("/health", (req: Request, res: Response) => {
  const whatsappConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.WHATSAPP_BUSINESS_NUMBER
  )

  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    whatsapp: {
      configured: whatsappConfigured,
      webhook: `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`,
    },
  })
})
app.use("/api/patients", patientRoutes)

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.requestId || "unknown"
  console.error(`❌ [${requestId}] Global Error Handler:`)
  console.error("- Error:", err.message)
  console.error("- Stack:", err.stack)
  console.error("- URL:", req.url)
  console.error("- Method:", req.method)
  console.error("- Headers:", JSON.stringify(req.headers, null, 2))

  if (err.message.includes("Driver not Connected")) {
    res.status(500).json({ message: "Database connection error. Please try again later." })
  } else {
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
      requestId,
    })
  }
})

// 404 handler
app.use((req: Request, res: Response) => {
  const requestId = req.requestId || "unknown"
  console.log(`❌ [${requestId}] 404 - Route not found: ${req.method} ${req.url}`)
  res.status(404).json({
    message: "Route not found",
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    requestId,
  })
})

console.log("🚀 === APPLICATION STARTUP COMPLETE ===")

export default app
