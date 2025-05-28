export class WhatsAppHelper {
  // Format phone number for WhatsApp
  static formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, "")

    // Add country code if not present
    if (!cleaned.startsWith("1") && cleaned.length === 10) {
      cleaned = "1" + cleaned // Assuming US numbers
    }

    return "+" + cleaned
  }

  // Validate phone number format
  static isValidPhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    return phoneRegex.test(phoneNumber.replace(/\s/g, ""))
  }

  // Create quick reply buttons for WhatsApp
  static createQuickReplies(options: string[]): string {
    let message = "Please choose an option:\n\n"
    options.forEach((option, index) => {
      message += `${index + 1}. ${option}\n`
    })
    message += "\nReply with the number of your choice."
    return message
  }

  // Format pregnancy week message
  static formatWeekMessage(weeks: number, days: number): string {
    return `You are currently ${weeks} weeks and ${days} days pregnant`
  }

  // Create milestone celebration message
  static createMilestoneMessage(milestone: string, weeks: number): string {
    const celebrations = {
      first_heartbeat: "💓 First heartbeat detected!",
      first_movement: "👶 First baby movements!",
      gender_reveal: "🎉 Gender reveal time!",
      viability: "🌟 Viability milestone reached!",
      third_trimester: "🎊 Welcome to third trimester!",
      full_term: "✨ Full term - baby ready to meet you!",
    }

    const celebration = celebrations[milestone] || "🎉 Milestone reached!"

    return `${celebration}

Week ${weeks}: This is such an exciting milestone in your pregnancy journey! 

Remember to celebrate these special moments and share them with your loved ones. 💕`
  }

  // Create emergency contact message
  static createEmergencyMessage(): string {
    return `🚨 EMERGENCY CONTACTS 🚨

If you're experiencing:
• Severe bleeding
• Severe abdominal pain  
• Persistent vomiting
• Signs of preeclampsia
• Decreased fetal movement

Contact immediately:
📞 Your OB/GYN
📞 Emergency Services: 911
🏥 Nearest Hospital

This is not a substitute for professional medical advice.`
  }

  // Truncate message for WhatsApp limits
  static truncateMessage(message: string, maxLength = 1600): string {
    if (message.length <= maxLength) {
      return message
    }

    return message.substring(0, maxLength - 3) + "..."
  }
}
