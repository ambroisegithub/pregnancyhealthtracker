// src/app.ts
import "reflect-metadata" // Only once at the very top of this file
import express, { type Application, type Request, type Response, type NextFunction } from "express"
import morgan from "morgan"
import articleRouter from "./routes/articleRoutes"
import cors from "cors"
import authRouter from "./routes/authRoutes"
import pregnancyRouter from "./routes/pregnancyRoutes"
import chatroutes from "./routes/chatRoutes"
import whatsappRouter from "./routes/whatsappRoutes"
import smsRouter from "./routes/smsRoutes"

const app: Application = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(morgan("dev"))

// Add this line with your other routes
app.use("/api/auth", authRouter)
app.use("/api", pregnancyRouter)
app.use("/api", articleRouter)
app.use("/api", chatroutes)
app.use("/api/whatsapp", whatsappRouter)
app.use("/api/sms", smsRouter)

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to Pregnancy Support API with WhatsApp and SMS Integration" })
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err.message)
  if (err.message.includes("Driver not Connected")) {
    res.status(500).json({ message: "Database connection error. Please try again later." })
  } else {
    res.status(500).json({ message: "Internal server error" })
  }
})

export default app
