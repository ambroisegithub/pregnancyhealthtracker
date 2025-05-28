import cron from "node-cron"
import dbConnection from "../database"
import { PregnancyForm } from "../database/models/PregnancyForm"
import { User } from "../database/models/User"
import { ReminderTemplate, ReminderType, ReminderPriority } from "../database/models/ReminderTemplate"
import { UserReminder, ReminderStatus } from "../database/models/UserReminder"
import { whatsappService } from "./whatsapp.service"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"

interface MedicalReminderData {
  weekStart: number
  weekEnd: number
  type: ReminderType
  priority: ReminderPriority
  templates: {
    en: { title: string; message: string; actionRequired: string }
    fr: { title: string; message: string; actionRequired: string }
    rw: { title: string; message: string; actionRequired: string }
  }
}

class EnhancedReminderService {
  private pregnancyRepository = dbConnection.getRepository(PregnancyForm)
  private userRepository = dbConnection.getRepository(User)
  private reminderTemplateRepository = dbConnection.getRepository(ReminderTemplate)
  private userReminderRepository = dbConnection.getRepository(UserReminder)

  // Medical reminder schedules based on WHO and Rwanda MOH guidelines
  private medicalSchedule: MedicalReminderData[] = [
    // ANC VISITS
    {
      weekStart: 6,
      weekEnd: 8,
      type: ReminderType.ANC,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "ANC 1 Visit Due",
          message:
            "Hello {name}! You're in week {week} of pregnancy. It's time for your first ANC visit to confirm pregnancy and start essential care.",
          actionRequired:
            "Visit health center for pregnancy confirmation, HIV test, blood pressure check, and folic acid supplements",
        },
        fr: {
          title: "Visite ANC 1 Due",
          message:
            "Bonjour {name}! Vous êtes à la semaine {week} de grossesse. Il est temps pour votre première visite ANC pour confirmer la grossesse.",
          actionRequired:
            "Visitez le centre de santé pour confirmation de grossesse, test VIH, tension artérielle et suppléments d'acide folique",
        },
        rw: {
          title: "ANC 1 Yageze",
          message:
            "Mwaramutse {name}! Muri mu cyumweru {week} cy'inda. Ni igihe cyo kujya kwa muganga bwa mbere (ANC 1) kugira ngo hamenyekane uko mutwite.",
          actionRequired:
            "Jya ku kigo nderabuzima kugira ngo hamenyekane ko utwite, gupimwa HIV, umuvuduko w'amaraso no gufata folic acid",
        },
      },
    },
    {
      weekStart: 13,
      weekEnd: 16,
      type: ReminderType.ANC,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "ANC 2 Visit Due",
          message:
            "Hello {name}! Week {week} - Time for ANC 2. Let's check baby's growth and get your tetanus vaccination.",
          actionRequired: "Second ANC visit for baby growth monitoring, tetanus shot (TT1), and blood pressure check",
        },
        fr: {
          title: "Visite ANC 2 Due",
          message:
            "Bonjour {name}! Semaine {week} - Temps pour ANC 2. Vérifions la croissance du bébé et votre vaccination antitétanique.",
          actionRequired:
            "Deuxième visite ANC pour surveillance croissance bébé, vaccin tétanos (TT1), tension artérielle",
        },
        rw: {
          title: "ANC 2 Yageze",
          message:
            "Mwaramutse {name}! Icyumweru {week} - Ni igihe cya ANC 2. Dufate urukingo rwa tetanus tugasuzuma uko umwana akura.",
          actionRequired:
            "ANC ya 2 yo kureba imikurire y'umwana, inkingo za tetanus (TT1), gupimwa umuvuduko w'amaraso",
        },
      },
    },
    {
      weekStart: 20,
      weekEnd: 24,
      type: ReminderType.ANC,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "ANC 3 Visit Due",
          message:
            "Hello {name}! Week {week} - ANC 3 time! Important check for pre-eclampsia signs and continued monitoring.",
          actionRequired: "Third ANC visit for pre-eclampsia screening, continued supplements, and health monitoring",
        },
        fr: {
          title: "Visite ANC 3 Due",
          message: "Bonjour {name}! Semaine {week} - Temps ANC 3! Vérification importante des signes de pré-éclampsie.",
          actionRequired: "Troisième visite ANC pour dépistage pré-éclampsie, suppléments continus, surveillance santé",
        },
        rw: {
          title: "ANC 3 Yageze",
          message:
            "Mwaramutse {name}! Icyumweru {week} - Ni igihe cya ANC 3! Birashoboka kubona ibimenyetso by'eclampsia.",
          actionRequired: "ANC ya 3 yo kureba ibimenyetso by'indwara (eclampsia), gukomeza gufata imiti y'inyongera",
        },
      },
    },
    {
      weekStart: 28,
      weekEnd: 32,
      type: ReminderType.ANC,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "ANC 4 Visit Due",
          message:
            "Hello {name}! Week {week} - ANC 4 appointment. Let's check baby's position and discuss delivery plans.",
          actionRequired: "Fourth ANC visit to check baby's position and discuss birth planning",
        },
        fr: {
          title: "Visite ANC 4 Due",
          message:
            "Bonjour {name}! Semaine {week} - Rendez-vous ANC 4. Vérifions la position du bébé et discutons des plans d'accouchement.",
          actionRequired: "Quatrième visite ANC pour vérifier position bébé et discuter planification naissance",
        },
        rw: {
          title: "ANC 4 Yageze",
          message:
            "Mwaramutse {name}! Icyumweru {week} - Ni igihe cya ANC 4. Turebe icyerekezo cy'umwana tugateganye uko uzabyara.",
          actionRequired: "ANC ya 4 yo kugenzura icyerekezo cy'umwana, kuganira ku buryo bwo kubyara",
        },
      },
    },
    {
      weekStart: 33,
      weekEnd: 36,
      type: ReminderType.ANC,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "ANC 5 Visit Due",
          message:
            "Hello {name}! Week {week} - Almost there! ANC 5 to prepare for delivery and watch for warning signs.",
          actionRequired: "Fifth ANC visit for delivery preparation and warning signs education",
        },
        fr: {
          title: "Visite ANC 5 Due",
          message:
            "Bonjour {name}! Semaine {week} - Presque là! ANC 5 pour préparer l'accouchement et surveiller les signes d'alarme.",
          actionRequired: "Cinquième visite ANC pour préparation accouchement et éducation signes d'alarme",
        },
        rw: {
          title: "ANC 5 Yageze",
          message:
            "Mwaramutse {name}! Icyumweru {week} - Hafi kugerayo! ANC 5 yo kwitegura kubyara no kumenya ibimenyetso biburira.",
          actionRequired: "ANC ya 5 yo kwitegura kubyara, kureba ibimenyetso biburira",
        },
      },
    },
    {
      weekStart: 37,
      weekEnd: 40,
      type: ReminderType.ANC,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "Weekly ANC Visits Now",
          message:
            "Hello {name}! Week {week} - You're full term! Weekly visits now until delivery. Stay close to the hospital.",
          actionRequired: "Weekly ANC visits until delivery, monitor for labor signs, stay near hospital",
        },
        fr: {
          title: "Visites ANC Hebdomadaires",
          message: "Bonjour {name}! Semaine {week} - Vous êtes à terme! Visites hebdomadaires jusqu'à l'accouchement.",
          actionRequired:
            "Visites ANC hebdomadaires jusqu'accouchement, surveiller signes travail, rester près hôpital",
        },
        rw: {
          title: "ANC Buri Cyumweru",
          message:
            "Mwaramutse {name}! Icyumweru {week} - Mwageze mu gihe! Jya kwa muganga buri cyumweru kugeza abyaye.",
          actionRequired: "ANC buri cyumweru kugeza igihe cyo kubyara kigera, komatuza ibimenyetso byo kubyara",
        },
      },
    },
  ]

  // Child vaccination schedule (0-2 years)
  private vaccinationSchedule: MedicalReminderData[] = [
    {
      weekStart: 0,
      weekEnd: 0,
      type: ReminderType.VACCINATION,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "Birth Vaccinations Due",
          message: "Congratulations {name}! Your baby needs immediate vaccinations: BCG and Hepatitis B.",
          actionRequired: "Get BCG (tuberculosis) and Hepatitis B vaccinations immediately after birth",
        },
        fr: {
          title: "Vaccinations de Naissance",
          message: "Félicitations {name}! Votre bébé a besoin de vaccinations immédiates: BCG et Hépatite B.",
          actionRequired: "Faire vacciner BCG (tuberculose) et Hépatite B immédiatement après la naissance",
        },
        rw: {
          title: "Inkingo zo Kuvuka",
          message: "Murakaza neza {name}! Umwana wanyu akimara kuvuka agomba gukingirwa BCG na Hepatitis B.",
          actionRequired: "Umwana agomba gukingirwa BCG (Tuberculose) na Hepatitis B ako kanya",
        },
      },
    },
    {
      weekStart: 6,
      weekEnd: 6,
      type: ReminderType.VACCINATION,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "6 Weeks Vaccination Due",
          message: "Hello {name}! Your baby is 6 weeks old. Time for important vaccinations: DTP, Polio, and more.",
          actionRequired: "Get Pentavalent (DTP-HepB-Hib), PCV 13, OPV, and Rotavirus vaccinations",
        },
        fr: {
          title: "Vaccination 6 Semaines",
          message:
            "Bonjour {name}! Votre bébé a 6 semaines. Temps pour les vaccinations importantes: DTP, Polio, et plus.",
          actionRequired: "Faire vacciner Pentavalent (DTP-HepB-Hib), PCV 13, OPV, et Rotavirus",
        },
        rw: {
          title: "Inkingo 6 Byumweru",
          message:
            "Mwaramutse {name}! Umwana wanyu afite ibyumweru 6. Ni igihe cy'inkingo z'ingenzi: DTP, Polio, n'izindi.",
          actionRequired: "Inkingo za Pentavalent (DTP-HepB-Hib), PCV 13, OPV, na Rotavirus",
        },
      },
    },
    {
      weekStart: 10,
      weekEnd: 10,
      type: ReminderType.VACCINATION,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "10 Weeks Vaccination Due",
          message: "Hello {name}! Your baby is 10 weeks old. Second round of vaccinations needed today.",
          actionRequired: "Get second doses: Pentavalent 2, PCV 13 2, OPV 2, Rotavirus 2",
        },
        fr: {
          title: "Vaccination 10 Semaines",
          message: "Bonjour {name}! Votre bébé a 10 semaines. Deuxième série de vaccinations nécessaire aujourd'hui.",
          actionRequired: "Deuxièmes doses: Pentavalent 2, PCV 13 2, OPV 2, Rotavirus 2",
        },
        rw: {
          title: "Inkingo 10 Byumweru",
          message: "Mwaramutse {name}! Umwana wanyu afite ibyumweru 10. Inkingo zikurikiraho z'umwana zigeze.",
          actionRequired: "Doze ya 2: Pentavalent 2, PCV 13 2, OPV 2, Rotavirus 2",
        },
      },
    },
    {
      weekStart: 14,
      weekEnd: 14,
      type: ReminderType.VACCINATION,
      priority: ReminderPriority.HIGH,
      templates: {
        en: {
          title: "14 Weeks Vaccination Due",
          message: "Hello {name}! Your baby is 14 weeks old. Third and final primary series vaccinations due.",
          actionRequired: "Get third doses: Pentavalent 3, PCV 13 3, OPV 3",
        },
        fr: {
          title: "Vaccination 14 Semaines",
          message: "Bonjour {name}! Votre bébé a 14 semaines. Troisième et dernière série primaire de vaccinations.",
          actionRequired: "Troisièmes doses: Pentavalent 3, PCV 13 3, OPV 3",
        },
        rw: {
          title: "Inkingo 14 Byumweru",
          message: "Mwaramutse {name}! Umwana wanyu afite ibyumweru 14. Doze ya 3 y'inkingo igeze.",
          actionRequired: "Doze ya 3: Pentavalent 3, PCV 13 3, OPV 3",
        },
      },
    },
  ]

  // Initialize all cron jobs
  initializeAllSchedulers(): void {
    this.initializeANCReminders()
    this.initializeVaccinationReminders()
    this.initializeMilestoneReminders()
    this.initializeReminderProcessor()
    console.log("🔄 Enhanced reminder system initialized with medical schedules")
  }

  // ANC reminders - Daily at 8 AM
  private initializeANCReminders(): void {
    cron.schedule("0 8 * * *", async () => {
      console.log("🏥 Processing ANC reminders...")
      await this.processANCReminders()
    })
  }

  // Vaccination reminders - Daily at 9 AM
  private initializeVaccinationReminders(): void {
    cron.schedule("0 9 * * *", async () => {
      console.log("💉 Processing vaccination reminders...")
      await this.processVaccinationReminders()
    })
  }

  // Milestone reminders - Weekly on Mondays at 7 AM
  private initializeMilestoneReminders(): void {
    cron.schedule("0 7 * * 1", async () => {
      console.log("🌟 Processing milestone reminders...")
      await this.processMilestoneReminders()
    })
  }

  // Reminder processor - Every 15 minutes
  private initializeReminderProcessor(): void {
    cron.schedule("*/15 * * * *", async () => {
      await this.processPendingReminders()
    })
  }

  // Process ANC reminders for pregnant women
  private async processANCReminders(): Promise<void> {
    try {
      const pregnantUsers = await this.pregnancyRepository.find({
        where: { pregnancyStatus: "Pregnant" },
        relations: ["user", "user.profile"],
      })

      for (const pregnancyForm of pregnantUsers) {
        if (!pregnancyForm.user?.phoneNumber || !pregnancyForm.lastDateOfMenstruation) {
          continue
        }

        const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(
          new Date(pregnancyForm.lastDateOfMenstruation),
        )

        const currentWeek = pregnancyDetails.gestationalAge.weeks

        // Check if user needs any ANC reminders
        for (const schedule of this.medicalSchedule) {
          if (currentWeek >= schedule.weekStart && currentWeek <= schedule.weekEnd) {
            await this.createUserReminder(pregnancyForm.user, schedule, currentWeek)
          }
        }
      }
    } catch (error) {
      console.error("Error processing ANC reminders:", error)
    }
  }

  // Process vaccination reminders for children
  private async processVaccinationReminders(): Promise<void> {
    try {
      const deliveredUsers = await this.pregnancyRepository.find({
        where: { pregnancyStatus: "Delivered" },
        relations: ["user", "user.profile"],
      })

      for (const pregnancyForm of deliveredUsers) {
        if (!pregnancyForm.user?.phoneNumber || !pregnancyForm.expectedDeliveryDate) {
          continue
        }

        // Calculate child's age in weeks
        const deliveryDate = new Date(pregnancyForm.expectedDeliveryDate)
        const today = new Date()
        const ageInDays = Math.floor((today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24))
        const ageInWeeks = Math.floor(ageInDays / 7)

        // Check vaccination schedule
        for (const schedule of this.vaccinationSchedule) {
          if (ageInWeeks === schedule.weekStart) {
            await this.createUserReminder(pregnancyForm.user, schedule, ageInWeeks, ageInDays)
          }
        }
      }
    } catch (error) {
      console.error("Error processing vaccination reminders:", error)
    }
  }

  // Create user reminder
  private async createUserReminder(
    user: User,
    schedule: MedicalReminderData,
    currentWeek: number,
    currentDay?: number,
  ): Promise<void> {
    try {
      // Check if reminder already sent recently
      const existingReminder = await this.userReminderRepository.findOne({
        where: {
          user: { id: user.id },
          type: schedule.type,
          currentWeek: currentWeek,
          status: ReminderStatus.SENT,
        },
      })

      if (existingReminder) {
        return // Already sent
      }

      const language = user.language || "en"
      const template = schedule.templates[language] || schedule.templates.en

      // Personalize message
      const personalizedMessage = template.message
        .replace("{name}", user.profile?.firstName || "there")
        .replace("{week}", currentWeek.toString())

      // Create reminder
      const userReminder = this.userReminderRepository.create({
        user,
        type: schedule.type,
        priority: schedule.priority,
        scheduledFor: new Date(),
        currentWeek,
        currentDay,
        customMessage: personalizedMessage,
        status: ReminderStatus.PENDING,
      })

      await this.userReminderRepository.save(userReminder)

      console.log(`📅 Reminder created for ${user.profile?.firstName} - Week ${currentWeek} - ${schedule.type}`)
    } catch (error) {
      console.error("Error creating user reminder:", error)
    }
  }

  // Process pending reminders
  private async processPendingReminders(): Promise<void> {
    try {
      const pendingReminders = await this.userReminderRepository.find({
        where: { status: ReminderStatus.PENDING },
        relations: ["user", "user.profile"],
        order: { priority: "ASC", scheduledFor: "ASC" },
        take: 50, // Process max 50 at a time
      })

      for (const reminder of pendingReminders) {
        await this.sendReminder(reminder)
      }
    } catch (error) {
      console.error("Error processing pending reminders:", error)
    }
  }

  // Send individual reminder
  private async sendReminder(reminder: UserReminder): Promise<void> {
    try {
      if (!reminder.user.phoneNumber) {
        reminder.status = ReminderStatus.FAILED
        reminder.errorMessage = "No phone number"
        await this.userReminderRepository.save(reminder)
        return
      }

      // Send WhatsApp message
      const success = await whatsappService.sendMessage(
        reminder.user.phoneNumber,
        reminder.customMessage || "Health reminder",
      )

      if (success) {
        reminder.status = ReminderStatus.SENT
        reminder.sentAt = new Date()
        console.log(`✅ Reminder sent to ${reminder.user.profile?.firstName} - ${reminder.type}`)
      } else {
        reminder.status = ReminderStatus.FAILED
        reminder.retryCount += 1
        reminder.errorMessage = "WhatsApp delivery failed"

        // Retry up to 3 times
        if (reminder.retryCount < 3) {
          reminder.status = ReminderStatus.PENDING
          reminder.scheduledFor = new Date(Date.now() + 30 * 60 * 1000) // Retry in 30 minutes
        }
      }

      await this.userReminderRepository.save(reminder)
    } catch (error:any) {
      console.error("Error sending reminder:", error)
      reminder.status = ReminderStatus.FAILED
      reminder.errorMessage = error.message
      await this.userReminderRepository.save(reminder)
    }
  }

  // Process milestone reminders
  private async processMilestoneReminders(): Promise<void> {
    try {
      const pregnantUsers = await this.pregnancyRepository.find({
        where: { pregnancyStatus: "Pregnant" },
        relations: ["user", "user.profile"],
      })

      for (const pregnancyForm of pregnantUsers) {
        if (!pregnancyForm.user?.phoneNumber || !pregnancyForm.lastDateOfMenstruation) {
          continue
        }

        const pregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(
          new Date(pregnancyForm.lastDateOfMenstruation),
        )

        const currentWeek = pregnancyDetails.gestationalAge.weeks
        const milestone = this.checkForWeeklyMilestone(currentWeek)

        if (milestone) {
          await this.createMilestoneReminder(pregnancyForm.user, currentWeek, milestone)
        }
      }
    } catch (error) {
      console.error("Error processing milestone reminders:", error)
    }
  }

  // Check for weekly milestones
  private checkForWeeklyMilestone(week: number): string | null {
    const milestones: { [key: number]: string } = {
      4: "heartbeat_development",
      8: "brain_development",
      12: "first_trimester_complete",
      16: "gender_determination",
      20: "anatomy_scan_time",
      24: "viability_milestone",
      28: "third_trimester_start",
      32: "rapid_growth_phase",
      36: "lung_maturation",
      40: "full_term_ready",
    }

    return milestones[week] || null
  }

  // Create milestone reminder
  private async createMilestoneReminder(user: User, week: number, milestone: string): Promise<void> {
    try {
      const language = user.language || "en"

      const milestoneMessages = {
        en: `🌟 Week ${week} Milestone! Your baby's ${milestone.replace("_", " ")} is happening. Check the app for details!`,
        fr: `🌟 Étape Semaine ${week}! Le ${milestone.replace("_", " ")} de votre bébé se déroule. Consultez l'app pour les détails!`,
        rw: `🌟 Intambwe Icyumweru ${week}! ${milestone.replace("_", " ")} y'umwana wawe iragenda. Reba aplikasiyo kugira ngo ubone birambuye!`,
      }

      const message = milestoneMessages[language] || milestoneMessages.en

      const userReminder = this.userReminderRepository.create({
        user,
        type: ReminderType.MILESTONE,
        priority: ReminderPriority.MEDIUM,
        scheduledFor: new Date(),
        currentWeek: week,
        customMessage: message,
        status: ReminderStatus.PENDING,
      })

      await this.userReminderRepository.save(userReminder)
    } catch (error) {
      console.error("Error creating milestone reminder:", error)
    }
  }

  // Get upcoming reminders for user
  async getUpcomingReminders(userId: number): Promise<UserReminder[]> {
    return await this.userReminderRepository.find({
      where: {
        user: { id: userId },
        status: ReminderStatus.PENDING,
      },
      order: { scheduledFor: "ASC" },
      take: 10,
    })
  }

  // Get reminder history for user
  async getReminderHistory(userId: number, limit = 20): Promise<UserReminder[]> {
    return await this.userReminderRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
      take: limit,
    })
  }

  // Send test reminder
  async sendTestReminder(userId: number, type: ReminderType): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ["profile"],
      })

      if (!user || !user.phoneNumber) {
        return false
      }

      const language = user.language || "en"
      const testMessages = {
        en: `🧪 Test Reminder from Pregnancy Tracker! This is a sample ${type} reminder. Your notifications are working perfectly! 👍`,
        fr: `🧪 Rappel de Test du Suivi de Grossesse! Ceci est un rappel ${type} d'exemple. Vos notifications fonctionnent parfaitement! 👍`,
        rw: `🧪 Gerageza Kwibutsa kwa Pregnancy Tracker! Iki ni urugero rw'ibibutso bya ${type}. Amakuru yawe akora neza! 👍`,
      }

      const message = testMessages[language] || testMessages.en

      return await whatsappService.sendMessage(user.phoneNumber, message)
    } catch (error) {
      console.error("Error sending test reminder:", error)
      return false
    }
  }
}

export const enhancedReminderService = new EnhancedReminderService()
