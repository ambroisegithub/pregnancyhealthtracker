import { whatsappService } from "./whatsapp.service"
import { smsService } from "./sms.service"
import type { User } from "../database/models/User"
import type { PregnancyForm } from "../database/models/PregnancyForm"

export class NotificationService {
  // Send welcome message when user registers
  static async sendWelcomeMessage(user: User): Promise<boolean> {
    if (!user.phoneNumber) return false

    const message = `🎉 Welcome to Pregnancy Support, ${user.profile?.firstName || "there"}!

Your account has been created successfully. Here's what you can expect:

📅 Daily pregnancy tips and advice
🔔 Important milestone reminders  
💬 24/7 AI support for your questions
📚 Personalized articles based on your pregnancy stage

Complete your pregnancy form in the app to get personalized content!

Feel free to message me anytime with questions! 🤱`

    // Try to send via WhatsApp first, then fall back to SMS if WhatsApp fails
    try {
      const whatsappSuccess = await whatsappService.sendMessage(user.phoneNumber, message)
      if (whatsappSuccess) {
        console.log(`Welcome message sent via WhatsApp to ${user.phoneNumber}`)
        return true
      }
    } catch (error) {
      console.error(`Failed to send welcome message via WhatsApp: ${error}`)
    }

    // Fall back to SMS
    try {
      const smsSuccess = await smsService.sendSMS(user.phoneNumber, message)
      if (smsSuccess) {
        console.log(`Welcome message sent via SMS to ${user.phoneNumber}`)
        return true
      }
    } catch (error) {
      console.error(`Failed to send welcome message via SMS: ${error}`)
    }

    return false
  }

  // Send pregnancy form completion confirmation
  static async sendPregnancyFormConfirmation(user: User, pregnancyForm: PregnancyForm): Promise<boolean> {
    if (!user.phoneNumber) return false

    let message = `✅ Pregnancy form completed successfully!

Status: ${pregnancyForm.pregnancyStatus}`

    if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.gestationalWeeks) {
      message += `
Current: ${pregnancyForm.gestationalWeeks} weeks, ${pregnancyForm.gestationalDays} days
Trimester: ${pregnancyForm.currentTrimester}`

      if (pregnancyForm.expectedDeliveryDate) {
        message += `
Expected delivery: ${new Date(pregnancyForm.expectedDeliveryDate).toDateString()}`
      }
    }

    message += `

You'll now receive personalized daily tips and milestone reminders! 🌟`

    // Try to send via WhatsApp first, then fall back to SMS if WhatsApp fails
    try {
      const whatsappSuccess = await whatsappService.sendMessage(user.phoneNumber, message)
      if (whatsappSuccess) {
        console.log(`Pregnancy form confirmation sent via WhatsApp to ${user.phoneNumber}`)
        return true
      }
    } catch (error) {
      console.error(`Failed to send pregnancy form confirmation via WhatsApp: ${error}`)
    }

    // Fall back to SMS
    try {
      const smsSuccess = await smsService.sendSMS(user.phoneNumber, message)
      if (smsSuccess) {
        console.log(`Pregnancy form confirmation sent via SMS to ${user.phoneNumber}`)
        return true
      }
    } catch (error) {
      console.error(`Failed to send pregnancy form confirmation via SMS: ${error}`)
    }

    return false
  }

  // Send appointment reminders
  static async sendAppointmentReminder(
    user: User,
    appointmentType: "prenatal_checkup" | "ultrasound" | "glucose_test" | "vaccination" | string,
    weeks: number,
  ): Promise<boolean> {
    if (!user.phoneNumber) return false

    const reminders: Record<"prenatal_checkup" | "ultrasound" | "glucose_test" | "vaccination", string> = {
      prenatal_checkup: `🏥 Reminder: Time for your prenatal checkup at ${weeks} weeks! 

Schedule your appointment if you haven't already. Regular checkups are important for you and baby's health.`,

      ultrasound: `🔍 Ultrasound reminder at ${weeks} weeks! 

This scan will check baby's development and growth. So exciting to see your little one! 👶`,

      glucose_test: `🩸 Glucose screening reminder (${weeks} weeks)!

This routine test checks for gestational diabetes. Don't forget to fast if required by your doctor.`,

      vaccination: `💉 Vaccination reminder at ${weeks} weeks!

Time for important vaccines like Tdap to protect you and baby. Consult your healthcare provider.`,
    }

    const message =
      (reminders as Record<string, string>)[appointmentType] || `📅 Important appointment reminder at ${weeks} weeks!`

    // Try to send via WhatsApp first, then fall back to SMS if WhatsApp fails
    try {
      const whatsappSuccess = await whatsappService.sendMessage(user.phoneNumber, message)
      if (whatsappSuccess) {
        console.log(`Appointment reminder sent via WhatsApp to ${user.phoneNumber}`)
        return true
      }
    } catch (error) {
      console.error(`Failed to send appointment reminder via WhatsApp: ${error}`)
    }

    // Fall back to SMS
    try {
      const smsSuccess = await smsService.sendSMS(user.phoneNumber, message)
      if (smsSuccess) {
        console.log(`Appointment reminder sent via SMS to ${user.phoneNumber}`)
        return true
      }
    } catch (error) {
      console.error(`Failed to send appointment reminder via SMS: ${error}`)
    }

    return false
  }

  // Send emergency or urgent notifications
  static async sendUrgentNotification(user: User, message: string): Promise<boolean> {
    if (!user.phoneNumber) return false

    const urgentMessage = `🚨 IMPORTANT NOTIFICATION 🚨

${message}

If this is a medical emergency, contact your healthcare provider immediately or call emergency services.`

    // For urgent notifications, try both channels to maximize chances of delivery
    let whatsappSuccess = false
    let smsSuccess = false

    try {
      whatsappSuccess = await whatsappService.sendMessage(user.phoneNumber, urgentMessage)
      if (whatsappSuccess) {
        console.log(`Urgent notification sent via WhatsApp to ${user.phoneNumber}`)
      }
    } catch (error) {
      console.error(`Failed to send urgent notification via WhatsApp: ${error}`)
    }

    try {
      smsSuccess = await smsService.sendSMS(user.phoneNumber, urgentMessage)
      if (smsSuccess) {
        console.log(`Urgent notification sent via SMS to ${user.phoneNumber}`)
      }
    } catch (error) {
      console.error(`Failed to send urgent notification via SMS: ${error}`)
    }

    return whatsappSuccess || smsSuccess
  }

  // Determine user's preferred notification channel
  static async determinePreferredChannel(user: User): Promise<"whatsapp" | "sms" | "both"> {
    // This is a placeholder - in a real implementation, you would check user preferences
    // For now, we'll default to WhatsApp with SMS as fallback
    return "both"
  }
}

// Export functions for backward compatibility
export const sendWhatsAppMessage = (phoneNumber: string, message: string): Promise<boolean> => {
  return whatsappService.sendMessage(phoneNumber, message)
}

export const sendSMSMessage = (phoneNumber: string, message: string): Promise<boolean> => {
  return smsService.sendSMS(phoneNumber, message)
}
