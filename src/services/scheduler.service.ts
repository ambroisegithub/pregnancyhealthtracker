import cron from "node-cron"
import dbConnection from "../database"
import { PregnancyForm } from "../database/models/PregnancyForm"
import { Article } from "../database/models/Article"
import { whatsappService } from "./whatsapp.service"
import { smsService } from "./sms.service"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"

class SchedulerService {
  // Send daily pregnancy tips at 9 AM every day
  static initializeDailyTips(): void {
    cron.schedule("0 9 * * *", async () => {
      console.log("Running daily pregnancy tips scheduler...")
      await this.sendDailyTips()
    })
  }

  // Send daily articles at 10 AM every day
  static initializeDailyArticles(): void {
    cron.schedule("0 10 * * *", async () => {
      console.log("Sending daily pregnancy articles...")
      await this.sendDailyArticles()
    })
  }

  // Check for milestones every day at 8 AM
  static initializeMilestoneChecks(): void {
    cron.schedule("0 8 * * *", async () => {
      console.log("Checking pregnancy milestones...")
      await this.checkMilestones()
    })
  }

  private static async sendDailyTips(): Promise<void> {
    try {
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)

      const pregnantUsers = await pregnancyRepository.find({
        where: { pregnancyStatus: "Pregnant" },
        relations: ["user", "user.profile"],
      })

      console.log(`Found ${pregnantUsers.length} pregnant users for daily tips`)

      for (const pregnancyForm of pregnantUsers) {
        if (!pregnancyForm.user?.phoneNumber || !pregnancyForm.lastDateOfMenstruation) {
          console.log(`Skipping user ${pregnancyForm.user?.id} - missing phone or LMP`)
          continue
        }

        try {
          // Try WhatsApp first
          let whatsappSuccess = false
          try {
            whatsappSuccess = await whatsappService.sendDailyTip(pregnancyForm.user, pregnancyForm)
            if (whatsappSuccess) {
              console.log(`Daily tip sent via WhatsApp to ${pregnancyForm.user.phoneNumber}`)
            }
          } catch (whatsappError) {
            console.error(`Failed to send daily tip via WhatsApp: ${whatsappError}`)
          }

          // If WhatsApp fails, try SMS
          if (!whatsappSuccess) {
            const smsSuccess = await smsService.sendDailyTip(pregnancyForm.user, pregnancyForm)
            if (smsSuccess) {
              console.log(`Daily tip sent via SMS to ${pregnancyForm.user.phoneNumber}`)
            } else {
              console.error(`Failed to send daily tip via SMS to ${pregnancyForm.user.phoneNumber}`)
            }
          }
        } catch (error) {
          console.error(`Error sending daily tip to ${pregnancyForm.user.phoneNumber}:`, error)
        }
      }
    } catch (error) {
      console.error("Error in sendDailyTips:", error)
    }
  }

  private static async sendDailyArticles(): Promise<void> {
    try {
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)
      const articleRepository = dbConnection.getRepository(Article)

      const pregnantUsers = await pregnancyRepository.find({
        where: { pregnancyStatus: "Pregnant" },
        relations: ["user", "user.profile"],
      })

      console.log(`Found ${pregnantUsers.length} pregnant users for daily articles`)

      for (const pregnancyForm of pregnantUsers) {
        if (!pregnancyForm.user?.phoneNumber || !pregnancyForm.lastDateOfMenstruation) {
          console.log(`Skipping user ${pregnancyForm.user?.id} - missing phone or LMP`)
          continue
        }

        try {
          const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(
            new Date(pregnancyForm.lastDateOfMenstruation),
          )

          // Find article for current week
          let article = await articleRepository.findOne({
            where: {
              week: pregnancyDetails.gestationalAge.weeks,
              isActive: true,
            },
          })

          // Fallback to trimester article
          if (!article) {
            const trimesterStart = pregnancyDetails.trimester === 1 ? 1 : pregnancyDetails.trimester === 2 ? 13 : 29
            const trimesterEnd = pregnancyDetails.trimester === 1 ? 12 : pregnancyDetails.trimester === 2 ? 28 : 40

            article = await articleRepository
              .createQueryBuilder("article")
              .where("article.week BETWEEN :start AND :end", {
                start: trimesterStart,
                end: trimesterEnd,
              })
              .andWhere("article.isActive = :isActive", { isActive: true })
              .orderBy("RANDOM()")
              .getOne()
          }

          if (article) {
            // Format WhatsApp message
            const whatsappMessage = `📝 Week ${pregnancyDetails.gestationalAge.weeks} Pregnancy Update:

${article.title}

${article.content.substring(0, 100)}...

Check the app for the full article! 📱`

            // Try WhatsApp first
            let whatsappSuccess = false
            try {
              whatsappSuccess = await whatsappService.sendMessage(pregnancyForm.user.phoneNumber, whatsappMessage)
              if (whatsappSuccess) {
                console.log(`Daily article sent via WhatsApp to ${pregnancyForm.user.phoneNumber}`)
              }
            } catch (whatsappError) {
              console.error(`Failed to send daily article via WhatsApp: ${whatsappError}`)
            }

            // If WhatsApp fails, try SMS
            if (!whatsappSuccess) {
              const smsSuccess = await smsService.sendDailyArticle(
                pregnancyForm.user,
                pregnancyForm,
                article.title,
                article.content,
              )
              if (smsSuccess) {
                console.log(`Daily article sent via SMS to ${pregnancyForm.user.phoneNumber}`)
              } else {
                console.error(`Failed to send daily article via SMS to ${pregnancyForm.user.phoneNumber}`)
              }
            }
          }
        } catch (error) {
          console.error(`Error sending daily article to ${pregnancyForm.user.phoneNumber}:`, error)
        }
      }
    } catch (error) {
      console.error("Error in sendDailyArticles:", error)
    }
  }

  private static async checkMilestones(): Promise<void> {
    try {
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)

      const pregnantUsers = await pregnancyRepository.find({
        where: { pregnancyStatus: "Pregnant" },
        relations: ["user", "user.profile"],
      })

      console.log(`Checking milestones for ${pregnantUsers.length} pregnant users`)

      for (const pregnancyForm of pregnantUsers) {
        if (!pregnancyForm.user?.phoneNumber || !pregnancyForm.lastDateOfMenstruation) {
          continue
        }

        try {
          const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(
            new Date(pregnancyForm.lastDateOfMenstruation),
          )

          const weeks = pregnancyDetails.gestationalAge.weeks
          const milestone = this.checkForMilestone(weeks)

          if (milestone) {
            // Try WhatsApp first
            let whatsappSuccess = false
            try {
              whatsappSuccess = await whatsappService.sendMilestoneAlert(pregnancyForm.user, pregnancyForm, milestone)
              if (whatsappSuccess) {
                console.log(`Milestone alert sent via WhatsApp to ${pregnancyForm.user.phoneNumber}: ${milestone}`)
              }
            } catch (whatsappError) {
              console.error(`Failed to send milestone alert via WhatsApp: ${whatsappError}`)
            }

            // If WhatsApp fails, try SMS
            if (!whatsappSuccess) {
              const smsSuccess = await smsService.sendMilestoneAlert(pregnancyForm.user, pregnancyForm, milestone)
              if (smsSuccess) {
                console.log(`Milestone alert sent via SMS to ${pregnancyForm.user.phoneNumber}: ${milestone}`)
              } else {
                console.error(`Failed to send milestone alert via SMS to ${pregnancyForm.user.phoneNumber}`)
              }
            }
          }
        } catch (error) {
          console.error(`Failed to check milestones for ${pregnancyForm.user.phoneNumber}:`, error)
        }
      }
    } catch (error) {
      console.error("Error in checkMilestones:", error)
    }
  }

  private static checkForMilestone(weeks: number): string | null {
    // Check for specific milestone weeks
    if (weeks === 12) return "first_trimester_end"
    if (weeks === 20) return "anatomy_scan"
    if (weeks === 24) return "glucose_screening"
    if (weeks === 28) return "third_trimester"
    if (weeks === 37) return "full_term"
    if (weeks >= 42) return "overdue"

    return null
  }

  // Initialize all schedulers
  static initializeAll(): void {
    this.initializeDailyTips()
    this.initializeDailyArticles()
    this.initializeMilestoneChecks()
    console.log("All pregnancy schedulers initialized")
  }
}

export { SchedulerService }
