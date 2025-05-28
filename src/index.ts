
import dotenv from "dotenv"
dotenv.config()

import "reflect-metadata"

import app from "./app"

import dbConnection from "./database"
import { createServer } from "http"
import { SchedulerService } from "./services/scheduler.service"

const PORT = process.env.PORT || 3002
const httpServer = createServer(app)
;(async () => {
  try {
    if (!dbConnection.isInitialized) {
      await dbConnection.initialize()
      console.log("Database connection established successfully.")
    }

    SchedulerService.initializeAll()

    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
  
      console.log(`WhatsApp webhook URL: https://pregnancyhealthtracker.onrender.com/api/whatsapp/webhook`)
    })
  } catch (error) {
    console.error("Error initializing database connection:", error)
    process.exit(1)
  }
})()
