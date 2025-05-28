import twilio from "twilio"
import { PregnancyForm } from "../database/models/PregnancyForm"
import type { User } from "../database/models/User"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"
import { geminiService } from "./geminiService"
import dbConnection from "../database"

class WhatsAppService {
  private client: twilio.Twilio
  private whatsappNumber: string

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    this.whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER || ""

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials are not configured")
    }

    this.client = twilio(accountSid, authToken)
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      const result = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: message,
      })

      console.log(`WhatsApp message sent successfully: ${result.sid}`)
      return true
    } catch (error) {
      console.error("Error sending WhatsApp message:", error)
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

        return await this.sendMessage(user.phoneNumber, tip)
      }

      return false
    } catch (error) {
      console.error("Error sending daily tip:", error)
      return false
    }
  }

  async sendMilestoneAlert(user: User, pregnancyForm: PregnancyForm, milestone: string): Promise<boolean> {
    try {
      if (!user.phoneNumber) return false

      const message = this.getMilestoneMessage(milestone, pregnancyForm)
      return await this.sendMessage(user.phoneNumber, message)
    } catch (error) {
      console.error("Error sending milestone alert:", error)
      return false
    }
  }

  async handleIncomingMessage(from: string, body: string, user?: User): Promise<string> {
    try {
      // Remove 'whatsapp:' prefix if present
      const phoneNumber = from.replace("whatsapp:", "")

      if (!user) {
        return this.getRegistrationMessage()
      }

      // Get user's complete pregnancy context from database
      const fullContext = await this.getFullUserContext(user)

      // Generate AI response using Gemini with full context
      const aiResponse = await geminiService.generateText(`
        You are an AI pregnancy support assistant integrated with WhatsApp. You have access to the user's complete pregnancy information and should provide personalized, helpful responses.
        
        IMPORTANT: Keep responses under 1600 characters for WhatsApp compatibility.
        
        User Information:
        ${fullContext}
        
        User's WhatsApp Message: "${body}"
        
        Instructions:
        1. Provide personalized advice based on their current pregnancy status and gestational age
        2. Be supportive, encouraging, and medically accurate
        3. If they ask about their status, provide their current pregnancy details
        4. For medical concerns, always advise consulting healthcare providers
        5. Use emojis to make responses friendly and engaging
        6. If they ask about their journey, provide a comprehensive overview of their current status
        
        Respond as a knowledgeable, caring pregnancy assistant who knows their specific situation.
      `)

      return aiResponse
    } catch (error) {
      console.error("Error handling incoming message:", error)
      return "I'm sorry, I'm having trouble responding right now. Please try again later or contact your healthcare provider for urgent concerns. 🏥"
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

  private getDailyTip(trimester: number, weeks: number, days: number): string {
    const tips: Record<1 | 2 | 3, string[]> = {
      1: [
        `🌱 Week ${weeks}: Your baby is developing rapidly! Take folic acid daily and avoid alcohol. Stay hydrated! 💧`,
        `🤱 Week ${weeks}: Morning sickness is common. Try eating small, frequent meals. Ginger tea can help! 🫖`,
        `💊 Week ${weeks}: Don't forget your prenatal vitamins! They're crucial for baby's development. 👶`,
        `🚫 Week ${weeks}: Avoid raw fish, unpasteurized dairy, and deli meats. Your baby's safety comes first! 🛡️`,
        `😴 Week ${weeks}: Rest is important! Your body is working hard. Listen to it and take breaks. 💤`,
      ],
      2: [
        `✨ Week ${weeks}: Welcome to the golden trimester! Energy levels often improve now. Enjoy! 🌟`,
        `🤰 Week ${weeks}: Your bump is showing! Time for maternity clothes shopping. Embrace the changes! 👗`,
        `🏃‍♀️ Week ${weeks}: Gentle exercise like walking or prenatal yoga is great. Stay active safely! 🧘‍♀️`,
        `🍎 Week ${weeks}: Focus on calcium-rich foods. Your baby's bones are developing rapidly! 🦴`,
        `📅 Week ${weeks}: Schedule your anatomy scan if you haven't already. Exciting times ahead! 🔍`,
      ],
      3: [
        `🎒 Week ${weeks}: Start preparing your hospital bag. Include comfortable clothes and baby essentials! 👶`,
        `🫁 Week ${weeks}: Practice breathing exercises for labor. Deep breaths help with relaxation! 😮‍💨`,
        `🍼 Week ${weeks}: Consider breastfeeding classes. Knowledge is power for new moms! 📚`,
        `⚡ Week ${weeks}: You might feel more tired. Rest when you can - baby will be here soon! 😴`,
        `🏥 Week ${weeks}: Discuss your birth plan with your doctor. Communication is key! 💬`,
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
      first_trimester_end: `🎉 Congratulations! You've completed your first trimester! The risk of miscarriage significantly decreases now. Time to share the good news? 💕`,
      anatomy_scan: `🔍 It's time for your anatomy scan (18-22 weeks)! This detailed ultrasound checks baby's development. So exciting! 👶📸`,
      glucose_screening: `🩸 Glucose screening time (24-28 weeks)! This test checks for gestational diabetes. Don't worry, it's routine! 🏥`,
      third_trimester: `🎊 Welcome to your third trimester! Baby is getting ready to meet you. Start preparing for delivery! 🤱`,
      full_term: `🌟 You're full term now! Baby could arrive any day. Watch for signs of labor and stay close to the hospital! 🏥`,
      overdue: `⏰ You're past your due date, but that's normal! Many babies arrive fashionably late. Stay in touch with your doctor! 👩‍⚕️`,
    }

    if (milestone in messages) {
      return messages[milestone as MilestoneKey]
    }

    return `📅 Important milestone reached! Check with your healthcare provider for next steps. 👩‍⚕️`
  }

  private getRegistrationMessage(): string {
    return `👋 Welcome to Pregnancy Support! 

To get personalized pregnancy tips and AI support, please:

1️⃣ Register in our app
2️⃣ Complete your pregnancy form  
3️⃣ Link your WhatsApp number

Then I can provide personalized advice based on your pregnancy journey! 🤱

Need help? Contact our support team.`
  }
}

export const whatsappService = new WhatsAppService()
