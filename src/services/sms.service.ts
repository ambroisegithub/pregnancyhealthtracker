import twilio from "twilio"
import type { PregnancyForm } from "../database/models/PregnancyForm"
import type { User } from "../database/models/User"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"
import { geminiService } from "./geminiService"
import dbConnection from "../database"

class SMSService {
  private client: twilio.Twilio
  private smsNumber: string

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    this.smsNumber = process.env.TWILIO_PHONE_NUMBER || ""

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials are not configured")
    }

    this.client = twilio(accountSid, authToken)
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      const result = await this.client.messages.create({
        from: this.smsNumber,
        to: to,
        body: message,
      })

      console.log(`SMS sent successfully: ${result.sid}`)
      return true
    } catch (error) {
      console.error("Error sending SMS:", error)
      return false
    }
  }

  async sendDailyTip(user: User, pregnancyForm: PregnancyForm): Promise<boolean> {
    try {
      if (!user.phoneNumber || pregnancyForm.pregnancyStatus !== "Pregnant") {
        return false
      }

      // Update gestational age
      if (pregnancyForm.lastDateOfMenstruation) {
        const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(
          new Date(pregnancyForm.lastDateOfMenstruation),
        )

        const tip = this.getDailyTip(
          pregnancyDetails.trimester,
          pregnancyDetails.gestationalAge.weeks,
          pregnancyDetails.gestationalAge.days,
        )

        return await this.sendSMS(user.phoneNumber, tip)
      }

      return false
    } catch (error) {
      console.error("Error sending daily tip via SMS:", error)
      return false
    }
  }

  async sendDailyArticle(
    user: User,
    pregnancyForm: PregnancyForm,
    articleTitle: string,
    articleContent: string,
  ): Promise<boolean> {
    try {
      if (!user.phoneNumber) return false

      const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(
        new Date(pregnancyForm.lastDateOfMenstruation!),
      )

      const message = `Week ${pregnancyDetails.gestationalAge.weeks} Update:

${articleTitle}

${articleContent.substring(0, 100)}...

Check our app for the full article!

Reply STOP to unsubscribe.`

      return await this.sendSMS(user.phoneNumber, message)
    } catch (error) {
      console.error("Error sending daily article via SMS:", error)
      return false
    }
  }

  async sendMilestoneAlert(user: User, pregnancyForm: PregnancyForm, milestone: string): Promise<boolean> {
    try {
      if (!user.phoneNumber) return false

      const message = this.getMilestoneMessage(milestone, pregnancyForm)
      return await this.sendSMS(user.phoneNumber, message)
    } catch (error) {
      console.error("Error sending milestone alert via SMS:", error)
      return false
    }
  }

  async handleIncomingSMS(from: string, body: string, user?: User): Promise<string> {
    try {
      // Handle STOP requests
      if (body.toUpperCase().includes("STOP")) {
        return "You have been unsubscribed from pregnancy tips. Text START to resubscribe. For urgent concerns, contact your healthcare provider."
      }

      // Handle START requests
      if (body.toUpperCase().includes("START")) {
        return "Welcome back! You'll now receive daily pregnancy tips and updates. Reply with any pregnancy questions for AI assistance."
      }

      if (!user) {
        return this.getRegistrationMessage()
      }

      // Get user's complete pregnancy context from database
      const fullContext = await this.getFullUserContext(user)

      // Generate AI response using Gemini with full context
      const aiResponse = await geminiService.generateText(`
        You are an AI pregnancy support assistant integrated with SMS. You have access to the user's complete pregnancy information and should provide personalized, helpful responses.
        
        IMPORTANT: Keep responses under 160 characters for SMS compatibility. If longer response needed, break into multiple messages.
        
        User Information:
        ${fullContext}
        
        User's SMS Message: "${body}"
        
        Instructions:
        1. Provide personalized advice based on their current pregnancy status and gestational age
        2. Be supportive, encouraging, and medically accurate
        3. If they ask about their status, provide their current pregnancy details
        4. For medical concerns, always advise consulting healthcare providers
        5. Use minimal emojis for SMS compatibility
        6. If they ask about their journey, provide a comprehensive overview of their current status
        
        Respond as a knowledgeable, caring pregnancy assistant who knows their specific situation.
      `)

      // Split long responses into multiple SMS messages
      return this.splitLongMessage(aiResponse)
    } catch (error) {
      console.error("Error handling incoming SMS:", error)
      return "I'm sorry, I'm having trouble responding right now. Please try again later or contact your healthcare provider for urgent concerns."
    }
  }

  private async getFullUserContext(user: User): Promise<string> {
    try {
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm)

      // Get user's latest pregnancy form with all details
      const pregnancyForm = await pregnancyRepository.findOne({
        where: { user: { id: user.id } },
        relations: ["user", "user.profile"],
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        return `User: ${user.profile?.firstName || "User"} ${user.profile?.lastName || ""}
Phone: ${user.phoneNumber}
Status: No pregnancy information available yet. User needs to complete pregnancy form.`
      }

      // Update gestational age if pregnant
      let currentGestationalInfo = ""
      if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.lastDateOfMenstruation) {
        const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(
          new Date(pregnancyForm.lastDateOfMenstruation),
        )

        // Update the form with current gestational age
        pregnancyForm.currentTrimester = pregnancyDetails.trimester
        pregnancyForm.gestationalWeeks = pregnancyDetails.gestationalAge.weeks
        pregnancyForm.gestationalDays = pregnancyDetails.gestationalAge.days

        // Save updated information
        await pregnancyRepository.save(pregnancyForm)

        currentGestationalInfo = `
Current Gestational Age: ${pregnancyDetails.gestationalAge.weeks} weeks and ${pregnancyDetails.gestationalAge.days} days
Current Trimester: ${pregnancyDetails.trimester}
Expected Delivery Date: ${pregnancyDetails.expectedDeliveryDate.toDateString()}
Days Pregnant: ${pregnancyDetails.gestationalAge.totalDays} days`
      }

      const context = `
User Profile:
- Name: ${user.profile?.firstName || "N/A"} ${user.profile?.lastName || ""}
- Phone: ${user.phoneNumber}
- Date of Birth: ${user.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toDateString() : "N/A"}
- Location: ${user.profile?.city || "N/A"}, ${user.profile?.country || "N/A"}

Pregnancy Information:
- Status: ${pregnancyForm.pregnancyStatus}
- Last Menstruation Date: ${pregnancyForm.lastDateOfMenstruation ? new Date(pregnancyForm.lastDateOfMenstruation).toDateString() : "N/A"}
- Gravida (Total Pregnancies): ${pregnancyForm.gravida || "N/A"}
- Term Births: ${pregnancyForm.term || "N/A"}
- Preterm Births: ${pregnancyForm.preterm || "N/A"}
- Abortions/Miscarriages: ${pregnancyForm.abortion || "N/A"}
- Living Children: ${pregnancyForm.living || "N/A"}${currentGestationalInfo}

Form Submitted: ${pregnancyForm.createdAt ? new Date(pregnancyForm.createdAt).toDateString() : "N/A"}`

      return context
    } catch (error) {
      console.error("Error getting full user context:", error)
      return `User: ${user.profile?.firstName || "User"}, Phone: ${user.phoneNumber}
Error: Could not retrieve complete pregnancy information.`
    }
  }

  private splitLongMessage(message: string): string {
    // SMS limit is 160 characters, but we'll use 150 to be safe
    if (message.length <= 150) {
      return message
    }

    // Split at sentence boundaries if possible
    const sentences = message.split(". ")
    let result = sentences[0]

    if (result.length > 150) {
      // If even first sentence is too long, truncate
      result = message.substring(0, 147) + "..."
    }

    return result + ". (1/2) Reply for more info."
  }

  private getDailyTip(trimester: number, weeks: number, days: number): string {
    const tips: Record<1 | 2 | 3, string[]> = {
      1: [
        `Week ${weeks}: Take folic acid daily & avoid alcohol. Your baby's organs are forming! Stay hydrated.`,
        `Week ${weeks}: Morning sickness? Try small frequent meals & ginger tea. This too shall pass!`,
        `Week ${weeks}: Prenatal vitamins are crucial now. Your baby's brain is developing rapidly.`,
        `Week ${weeks}: Avoid raw fish & deli meats. Your baby's safety comes first!`,
        `Week ${weeks}: Rest is important! Your body is working overtime. Listen to it.`,
      ],
      2: [
        `Week ${weeks}: Welcome to the golden trimester! Energy often improves now. Enjoy!`,
        `Week ${weeks}: Your bump is showing! Time for maternity clothes. Embrace the changes!`,
        `Week ${weeks}: Gentle exercise like walking is great. Stay active safely!`,
        `Week ${weeks}: Focus on calcium-rich foods. Baby's bones are developing!`,
        `Week ${weeks}: Schedule your anatomy scan if you haven't. Exciting times ahead!`,
      ],
      3: [
        `Week ${weeks}: Start preparing hospital bag. Include comfy clothes & baby essentials!`,
        `Week ${weeks}: Practice breathing exercises for labor. Deep breaths help!`,
        `Week ${weeks}: Consider breastfeeding classes. Knowledge is power for new moms!`,
        `Week ${weeks}: You might feel more tired. Rest when you can - baby's almost here!`,
        `Week ${weeks}: Discuss birth plan with your doctor. Communication is key!`,
      ],
    }

    const trimesterTips = tips[trimester as 1 | 2 | 3] || tips[1]
    const randomTip = trimesterTips[Math.floor(Math.random() * trimesterTips.length)]

    return randomTip
  }

  private getMilestoneMessage(milestone: string, pregnancyForm: PregnancyForm): string {
    type MilestoneKey =
      | "first_trimester_end"
      | "anatomy_scan"
      | "glucose_screening"
      | "third_trimester"
      | "full_term"
      | "overdue"

    const messages: Record<MilestoneKey, string> = {
      first_trimester_end: `Congratulations! You've completed your first trimester! Risk of miscarriage drops significantly. Time to share the news?`,
      anatomy_scan: `Time for your anatomy scan (18-22 weeks)! This detailed ultrasound checks baby's development. So exciting!`,
      glucose_screening: `Glucose screening time (24-28 weeks)! This test checks for gestational diabetes. Don't worry, it's routine!`,
      third_trimester: `Welcome to your third trimester! Baby is getting ready to meet you. Start preparing for delivery!`,
      full_term: `You're full term now! Baby could arrive any day. Watch for labor signs & stay close to hospital!`,
      overdue: `You're past due date, but that's normal! Many babies arrive late. Stay in touch with your doctor!`,
    }

    if (milestone in messages) {
      return messages[milestone as MilestoneKey]
    }

    return `Important milestone reached! Check with your healthcare provider for next steps.`
  }

  private getRegistrationMessage(): string {
    return `Welcome to Pregnancy Support! To get personalized tips & AI support, please register in our app & complete your pregnancy form. Then link your phone number in settings.`
  }
}

export const smsService = new SMSService()
