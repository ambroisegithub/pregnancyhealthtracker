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

    // Enhanced debugging for credentials
    console.log("🔍 WhatsApp Service Initialization Debug:")
    console.log(`- TWILIO_ACCOUNT_SID exists: ${!!accountSid}`)
    console.log(`- TWILIO_ACCOUNT_SID length: ${accountSid?.length || 0}`)
    console.log(`- TWILIO_ACCOUNT_SID starts with 'AC': ${accountSid?.startsWith("AC") || false}`)
    console.log(`- TWILIO_AUTH_TOKEN exists: ${!!authToken}`)
    console.log(`- TWILIO_AUTH_TOKEN length: ${authToken?.length || 0}`)
    console.log(`- WHATSAPP_BUSINESS_NUMBER: ${this.whatsappNumber}`)
    console.log(
      `- WHATSAPP_BUSINESS_NUMBER format valid: ${this.whatsappNumber.startsWith("+") || this.whatsappNumber.startsWith("whatsapp:")}`,
    )

    if (!accountSid || !authToken) {
      console.error("❌ Twilio credentials are missing!")
      console.error("Required environment variables:")
      console.error("- TWILIO_ACCOUNT_SID (should start with 'AC')")
      console.error("- TWILIO_AUTH_TOKEN")
      console.error("- WHATSAPP_BUSINESS_NUMBER (should start with '+' or 'whatsapp:')")
      throw new Error("Twilio credentials are not configured")
    }

    if (!accountSid.startsWith("AC")) {
      console.error("❌ Invalid TWILIO_ACCOUNT_SID format. Should start with 'AC'")
      throw new Error("Invalid Twilio Account SID format")
    }

    if (authToken.length < 32) {
      console.error("❌ TWILIO_AUTH_TOKEN appears to be too short")
      throw new Error("Invalid Twilio Auth Token format")
    }

    if (!this.whatsappNumber) {
      console.error("❌ WHATSAPP_BUSINESS_NUMBER is not configured")
      throw new Error("WhatsApp Business Number is not configured")
    }

    try {
      this.client = twilio(accountSid, authToken)
      console.log("✅ Twilio client initialized successfully")
    } catch (error) {
      console.error("❌ Failed to initialize Twilio client:", error)
      throw new Error(`Failed to initialize Twilio client: ${error}`)
    }
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      console.log("📱 WhatsApp Send Message Debug:")
      console.log(`- To: ${to}`)
      console.log(`- From: whatsapp:${this.whatsappNumber}`)
      console.log(`- Message length: ${message.length}`)
      console.log(`- Message preview: ${message.substring(0, 100)}...`)

      // Validate phone number format
      const cleanTo = to.replace(/\D/g, "") // Remove non-digits
      if (cleanTo.length < 10) {
        console.error("❌ Invalid phone number format:", to)
        return false
      }

      // Ensure proper WhatsApp format
      const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`
      const whatsappFrom = this.whatsappNumber.startsWith("whatsapp:")
        ? this.whatsappNumber
        : `whatsapp:${this.whatsappNumber}`

      console.log(`- Formatted To: ${whatsappTo}`)
      console.log(`- Formatted From: ${whatsappFrom}`)

      // Test Twilio client before sending
      try {
        const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID as string).fetch()
        console.log(`✅ Twilio account verified: ${account.friendlyName} (${account.status})`)
      } catch (accountError) {
        console.error("❌ Twilio account verification failed:", accountError)
        console.error("This suggests invalid credentials or account issues")
        return false
      }

      const result = await this.client.messages.create({
        from: whatsappFrom,
        to: whatsappTo,
        body: message,
      })

      console.log(`✅ WhatsApp message sent successfully: ${result.sid}`)
      console.log(`- Status: ${result.status}`)
      console.log(`- Direction: ${result.direction}`)
      console.log(`- Price: ${result.price} ${result.priceUnit}`)
      return true
    } catch (error: any) {
      console.error("❌ Error sending WhatsApp message:")
      console.error(`- Error type: ${error.constructor.name}`)
      console.error(`- Status: ${error.status}`)
      console.error(`- Code: ${error.code}`)
      console.error(`- Message: ${error.message}`)
      console.error(`- More info: ${error.moreInfo}`)
      console.error(`- Details:`, error.details)

      // Specific error handling
      if (error.code === 20003) {
        console.error("🔍 Authentication Error (20003) Troubleshooting:")
        console.error("1. Verify your TWILIO_ACCOUNT_SID starts with 'AC'")
        console.error("2. Verify your TWILIO_AUTH_TOKEN is correct")
        console.error("3. Check if your Twilio account is active")
        console.error("4. Ensure WhatsApp is enabled for your account")
        console.error("5. Verify your WhatsApp Business Number is approved")
      } else if (error.code === 21211) {
        console.error("🔍 Invalid Phone Number Error (21211)")
        console.error("- Check phone number format")
        console.error("- Ensure country code is included")
      } else if (error.code === 63016) {
        console.error("🔍 WhatsApp Template Error (63016)")
        console.error("- Your message may need to use an approved template")
        console.error("- Or the recipient needs to message you first")
      }

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
          user.language || "en",
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

      const message = this.getMilestoneMessage(milestone, pregnancyForm, user.language || "en")
      return await this.sendMessage(user.phoneNumber, message)
    } catch (error) {
      console.error("Error sending milestone alert:", error)
      return false
    }
  }

  async handleIncomingMessage(from: string, body: string, user?: User, language = "en"): Promise<string> {
    try {
      // Remove 'whatsapp:' prefix if present
      const phoneNumber = from.replace("whatsapp:", "")

      if (!user) {
        return this.getRegistrationMessage(language)
      }

      // Get user's complete pregnancy context from database
      const fullContext = await this.getFullUserContext(user)

      // Language instructions for AI
      const languageInstructions = {
        en: "Respond in English",
        fr: "Répondez en français",
        rw: "Subiza mu kinyarwanda",
      }

      // Generate AI response using Gemini with full context and language preference
      const aiResponse = await geminiService.generateText(`
        You are an AI pregnancy support assistant integrated with WhatsApp. You have access to the user's complete pregnancy information and should provide personalized, helpful responses.
        
        IMPORTANT: 
        - Keep responses under 1600 characters for WhatsApp compatibility
        - ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en}
        - The user's preferred language is ${language}
        
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
        7. Always respond in ${language} language
        
        Respond as a knowledgeable, caring pregnancy assistant who knows their specific situation.
      `)

      return aiResponse
    } catch (error) {
      console.error("Error handling incoming message:", error)

      const errorMessages = {
        en: "I'm sorry, I'm having trouble responding right now. Please try again later or contact your healthcare provider for urgent concerns. 🏥",
        fr: "Je suis désolé, j'ai des difficultés à répondre en ce moment. Veuillez réessayer plus tard ou contacter votre professionnel de santé pour les préoccupations urgentes. 🏥",
        rw: "Ihangane, mfite ikibazo cyo gusubiza ubu. Nyamuneka ongera ugerageze nyuma cyangwa uvugane n'umuganga wawe ku bibazo byihutirwa. 🏥",
      }

      return errorMessages[language as keyof typeof errorMessages] || errorMessages.en
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
Language: ${user.language}
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
- Language: ${user.language}
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
      return `User: ${user.profile?.firstName || "User"}, Phone: ${user.phoneNumber}, Language: ${user.language}
Error: Could not retrieve complete pregnancy information.`
    }
  }

  private getDailyTip(trimester: number, weeks: number, days: number, language = "en"): string {
    const tips = {
      en: {
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
      },
      fr: {
        1: [
          `🌱 Semaine ${weeks}: Votre bébé se développe rapidement! Prenez de l'acide folique quotidiennement et évitez l'alcool. Restez hydratée! 💧`,
          `🤱 Semaine ${weeks}: Les nausées matinales sont courantes. Essayez de manger de petits repas fréquents. Le thé au gingembre peut aider! 🫖`,
          `💊 Semaine ${weeks}: N'oubliez pas vos vitamines prénatales! Elles sont cruciales pour le développement de bébé. 👶`,
          `🚫 Semaine ${weeks}: Évitez le poisson cru, les produits laitiers non pasteurisés et la charcuterie. La sécurité de votre bébé avant tout! 🛡️`,
          `😴 Semaine ${weeks}: Le repos est important! Votre corps travaille dur. Écoutez-le et prenez des pauses. 💤`,
        ],
        2: [
          `✨ Semaine ${weeks}: Bienvenue au trimestre doré! Les niveaux d'énergie s'améliorent souvent maintenant. Profitez-en! 🌟`,
          `🤰 Semaine ${weeks}: Votre ventre se montre! Il est temps de faire du shopping de vêtements de maternité. Embrassez les changements! 👗`,
          `🏃‍♀️ Semaine ${weeks}: L'exercice doux comme la marche ou le yoga prénatal est excellent. Restez active en sécurité! 🧘‍♀️`,
          `🍎 Semaine ${weeks}: Concentrez-vous sur les aliments riches en calcium. Les os de votre bébé se développent rapidement! 🦴`,
          `📅 Semaine ${weeks}: Planifiez votre échographie anatomique si ce n'est pas déjà fait. Des moments excitants à venir! 🔍`,
        ],
        3: [
          `🎒 Semaine ${weeks}: Commencez à préparer votre sac d'hôpital. Incluez des vêtements confortables et les essentiels pour bébé! 👶`,
          `🫁 Semaine ${weeks}: Pratiquez des exercices de respiration pour l'accouchement. Les respirations profondes aident à la relaxation! 😮‍💨`,
          `🍼 Semaine ${weeks}: Considérez les cours d'allaitement. La connaissance est le pouvoir pour les nouvelles mamans! 📚`,
          `⚡ Semaine ${weeks}: Vous pourriez vous sentir plus fatiguée. Reposez-vous quand vous le pouvez - bébé sera bientôt là! 😴`,
          `🏥 Semaine ${weeks}: Discutez de votre plan de naissance avec votre médecin. La communication est la clé! 💬`,
        ],
      },
      rw: {
        1: [
          `🌱 Icyumweru ${weeks}: Uruhinja rwawe rukura vuba! Nywa acide folique buri munsi kandi wirinde inzoga. Komeza unywa amazi! 💧`,
          `🤱 Icyumweru ${weeks}: Kuraguza mu gitondo ni ibisanzwe. Gerageza kurya ibiryo bike kenshi. Icyayi cya ginger gishobora gufasha! 🫖`,
          `💊 Icyumweru ${weeks}: Ntiwibagirwe vitamini zawe za mbere y'inda! Ni ingenzi mu iterambere ry'uruhinja. 👶`,
          `🚫 Icyumweru ${weeks}: Wirinde amafi atatemba, amata adatemba, n'inyama z'ibikoresho. Umutekano w'uruhinja rwawe ni ingenzi! 🛡️`,
          `😴 Icyumweru ${weeks}: Kuruhuka ni ingenzi! Umubiri wawe ukora cyane. Wumve kandi ufate ikiruhuko. 💤`,
        ],
        2: [
          `✨ Icyumweru ${weeks}: Murakaza neza mu gihembwe cy'or! Imbaraga zirashobora kuzamuka ubu. Wishimire! 🌟`,
          `🤰 Icyumweru ${weeks}: Inda yawe iragaragara! Ni igihe cyo kugura imyenda y'abagore batwite. Kwakira impinduka! 👗`,
          `🏃‍♀️ Icyumweru ${weeks}: Imyitozo yoroshye nko kugenda cyangwa yoga ya mbere y'inda ni byiza. Komeza ukora mu mutekano! 🧘‍♀️`,
          `🍎 Icyumweru ${weeks}: Wibande ku biryo bifite calcium nyinshi. Amagufwa y'uruhinja rwawe akura vuba! 🦴`,
          `📅 Icyumweru ${weeks}: Tegura isuzuma ry'imiterere niba utarakibikora. Ibihe bishimishije bizaza! 🔍`,
        ],
        3: [
          `🎒 Icyumweru ${weeks}: Tangira gutegura umufuka w'ibitaro. Shyiramo imyenda yoroshye n'ibikenewe n'uruhinja! 👶`,
          `🫁 Icyumweru ${weeks}: Witoze imyitozo yo guhumeka ku kubyara. Guhumeka cyane bifasha mu kuruhuka! 😮‍💨`,
          `🍼 Icyumweru ${weeks}: Tekereza ku masomo yo konsa. Ubumenyi ni imbaraga ku ba nyina bashya! 📚`,
          `⚡ Icyumweru ${weeks}: Ushobora kwumva unanirwa cyane. Ruhuka igihe ushobora - uruhinja ruzaza vuba! 😴`,
          `🏥 Icyumweru ${weeks}: Ganira na muganga wawe ku gahunda yawe yo kubyara. Itumanaho ni urufunguzo! 💬`,
        ],
      },
    }

    const languageTips = tips[language as keyof typeof tips] || tips.en
    const trimesterTips = languageTips[trimester as 1 | 2 | 3] || languageTips[1]
    const randomTip = trimesterTips[Math.floor(Math.random() * trimesterTips.length)]

    return randomTip
  }

  private getMilestoneMessage(milestone: string, pregnancyForm: PregnancyForm, language = "en"): string {
    type MilestoneKey =
      | "first_trimester_end"
      | "anatomy_scan"
      | "glucose_screening"
      | "third_trimester"
      | "full_term"
      | "overdue"

    const messages = {
      en: {
        first_trimester_end: `🎉 Congratulations! You've completed your first trimester! The risk of miscarriage significantly decreases now. Time to share the good news? 💕`,
        anatomy_scan: `🔍 It's time for your anatomy scan (18-22 weeks)! This detailed ultrasound checks baby's development. So exciting! 👶📸`,
        glucose_screening: `🩸 Glucose screening time (24-28 weeks)! This test checks for gestational diabetes. Don't worry, it's routine! 🏥`,
        third_trimester: `🎊 Welcome to your third trimester! Baby is getting ready to meet you. Start preparing for delivery! 🤱`,
        full_term: `🌟 You're full term now! Baby could arrive any day. Watch for signs of labor and stay close to the hospital! 🏥`,
        overdue: `⏰ You're past your due date, but that's normal! Many babies arrive fashionably late. Stay in touch with your doctor! 👩‍⚕️`,
      },
      fr: {
        first_trimester_end: `🎉 Félicitations! Vous avez terminé votre premier trimestre! Le risque de fausse couche diminue considérablement maintenant. Il est temps de partager la bonne nouvelle? 💕`,
        anatomy_scan: `🔍 Il est temps pour votre échographie anatomique (18-22 semaines)! Cette échographie détaillée vérifie le développement de bébé. Si excitant! 👶📸`,
        glucose_screening: `🩸 Temps de dépistage du glucose (24-28 semaines)! Ce test vérifie le diabète gestationnel. Ne vous inquiétez pas, c'est de routine! 🏥`,
        third_trimester: `🎊 Bienvenue dans votre troisième trimestre! Bébé se prépare à vous rencontrer. Commencez à vous préparer pour l'accouchement! 🤱`,
        full_term: `🌟 Vous êtes à terme maintenant! Bébé pourrait arriver n'importe quel jour. Surveillez les signes de travail et restez près de l'hôpital! 🏥`,
        overdue: `⏰ Vous avez dépassé votre date d'accouchement, mais c'est normal! Beaucoup de bébés arrivent fashionablement en retard. Restez en contact avec votre médecin! 👩‍⚕️`,
      },
      rw: {
        first_trimester_end: `🎉 Amashimwe! Warangije igihembwe cyawe cya mbere! Ibyago byo gutakaza inda bigabanuka cyane ubu. Ni igihe cyo gutangaza amakuru meza? 💕`,
        anatomy_scan: `🔍 Ni igihe cyo gukora isuzuma ry'imiterere (ibyumweru 18-22)! Iri suzuma rirambuye rigenzura iterambere ry'uruhinja. Bishimishije cyane! 👶📸`,
        glucose_screening: `🩸 Igihe cyo gupima glucose (ibyumweru 24-28)! Iki kipimo gisuzuma diyabete y'inda. Ntugire ubwoba, ni ibisanzwe! 🏥`,
        third_trimester: `🎊 Murakaza neza mu gihembwe cyawe cya gatatu! Uruhinja rutegura guhura nawe. Tangira kwihugura kubyara! 🤱`,
        full_term: `🌟 Ubu uri mu gihe cyuzuye! Uruhinja rushobora kuza umunsi uwariwo wose. Reba ibimenyetso byo kubyara kandi ugume hafi y'ibitaro! 🏥`,
        overdue: `⏰ Warenga itariki yawe yo kubyara, ariko ni ibisanzwe! Abana benshi baza batinze neza. Komeza uvugana na muganga wawe! 👩‍⚕️`,
      },
    }

    const languageMessages = messages[language as keyof typeof messages] || messages.en

    if (milestone in languageMessages) {
      return languageMessages[milestone as MilestoneKey]
    }

    const defaultMessages = {
      en: `📅 Important milestone reached! Check with your healthcare provider for next steps. 👩‍⚕️`,
      fr: `📅 Étape importante atteinte! Vérifiez avec votre professionnel de santé pour les prochaines étapes. 👩‍⚕️`,
      rw: `📅 Intambwe y'ingenzi yagezweho! Reba na muganga wawe intambwe zikurikira. 👩‍⚕️`,
    }

    return defaultMessages[language as keyof typeof defaultMessages] || defaultMessages.en
  }

  private getRegistrationMessage(language = "en"): string {
    const messages = {
      en: `👋 Welcome to Pregnancy Support! 

To get personalized pregnancy tips and AI support, please:

1️⃣ Register in our app
2️⃣ Complete your pregnancy form  
3️⃣ Link your WhatsApp number

Then I can provide personalized advice based on your pregnancy journey! 🤱

Need help? Contact our support team.`,
      fr: `👋 Bienvenue dans Pregnancy Support! 

Pour obtenir des conseils de grossesse personnalisés et un support IA, veuillez:

1️⃣ Vous inscrire dans notre application
2️⃣ Compléter votre formulaire de grossesse  
3️⃣ Lier votre numéro WhatsApp

Ensuite, je peux fournir des conseils personnalisés basés sur votre parcours de grossesse! 🤱

Besoin d'aide? Contactez notre équipe de support.`,
      rw: `👋 Murakaza neza kuri Pregnancy Support! 

Kugira ngo ubone inama z'inda zihariye n'ubufasha bwa AI, nyamuneka:

1️⃣ Iyandikishe muri application yacu
2️⃣ Uzuza ifishi yawe y'inda  
3️⃣ Huza nimero yawe ya WhatsApp

Noneho nshobora gutanga inama zihariye zishingiye ku rugendo rwawe rw'inda! 🤱

Ukeneye ubufasha? Vugana n'itsinda ryacu ry'ubufasha.`,
    }

    return messages[language as keyof typeof messages] || messages.en
  }
}

export const whatsappService = new WhatsAppService()
