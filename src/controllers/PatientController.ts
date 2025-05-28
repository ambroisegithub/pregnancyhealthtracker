import type { Response, NextFunction } from "express"
import { validationResult } from "express-validator"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import dbConnection from "../database"
import { User } from "../database/models/User"
import { Profile } from "../database/models/Profile"
import { PregnancyForm } from "../database/models/PregnancyForm"
import { PregnancyCalculator } from "../utils/pregnancyCalculator"

export class PatientController {
  private static userRepository = dbConnection.getRepository(User)
  private static profileRepository = dbConnection.getRepository(Profile)
  private static pregnancyRepository = dbConnection.getRepository(PregnancyForm)

  // Helper function to get translation with fallback
  private static getTranslation(req: any, key: string, fallback?: string): string {
    if (req.t && typeof req.t === "function") {
      return req.t(key)
    }

    // Fallback translations
    const fallbackTranslations: { [key: string]: string } = {
      "patients.fetched_successfully": "Patients fetched successfully",
      "patients.patient_not_found": "Patient not found",
      "patients.patient_updated": "Patient updated successfully",
      "errors.validation_error": "Validation error",
      "errors.server_error": "Internal server error",
      "common.success": "Success",
    }

    return fallbackTranslations[key] || fallback || key
  }

  // Calculate risk level based on pregnancy data
  private static calculateRiskLevel(pregnancyForm: PregnancyForm | null, profile: Profile | null): string {
    if (!pregnancyForm) return "low"

    let riskScore = 0

    // Age-based risk
    if (profile?.dateOfBirth) {
      const age = new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
      if (age < 18 || age > 35) riskScore += 2
      else if (age > 30) riskScore += 1
    }

    // Pregnancy history risk
    if (pregnancyForm.abortion && pregnancyForm.abortion > 2) riskScore += 2
    if (pregnancyForm.preterm && pregnancyForm.preterm > 0) riskScore += 1
    if (pregnancyForm.gravida && pregnancyForm.gravida > 4) riskScore += 1

    // Gestational age risk
    if (pregnancyForm.gestationalWeeks) {
      if (pregnancyForm.gestationalWeeks < 12 || pregnancyForm.gestationalWeeks > 37) riskScore += 1
    }

    // Return risk level
    if (riskScore >= 4) return "high"
    if (riskScore >= 2) return "medium"
    return "low"
  }

  // Format user data to match frontend Patient interface
  private static formatPatientData(user: User, pregnancyForm: PregnancyForm | null) {
    const profile = user.profile
    const age = profile?.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : null

    // Calculate current pregnancy details if LMP is available
    let currentPregnancyDetails = null
    if (pregnancyForm?.lastDateOfMenstruation) {
      const lmpDate = new Date(pregnancyForm.lastDateOfMenstruation)
      if (!isNaN(lmpDate.getTime())) {
        currentPregnancyDetails = PregnancyCalculator.calculatePregnancyDetails(lmpDate)
      }
    }

    const gestationalWeeks = currentPregnancyDetails?.gestationalAge.weeks || pregnancyForm?.gestationalWeeks || 0
    const gestationalDays = currentPregnancyDetails?.gestationalAge.days || pregnancyForm?.gestationalDays || 0
    const currentTrimester = currentPregnancyDetails?.trimester || pregnancyForm?.currentTrimester || 1
    const expectedDeliveryDate = currentPregnancyDetails?.expectedDeliveryDate || pregnancyForm?.expectedDeliveryDate

    return {
      id: user.id,
      name: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : "Unknown",
      email: user.email,
      phone: user.phoneNumber || null,
      age: age,
      gestationalAge: gestationalWeeks,
      gestationalDays: gestationalDays,
      trimester: currentTrimester,
      dueDate: expectedDeliveryDate,
      lastVisit: pregnancyForm?.updatedAt || user.updatedAt,
      riskLevel: PatientController.calculateRiskLevel(pregnancyForm, profile),
      pregnancyStatus: pregnancyForm?.pregnancyStatus || "Unknown",
      gravida: pregnancyForm?.gravida || 0,
      term: pregnancyForm?.term || 0,
      preterm: pregnancyForm?.preterm || 0,
      abortion: pregnancyForm?.abortion || 0,
      living: pregnancyForm?.living || 0,
      lastMenstrualPeriod: pregnancyForm?.lastDateOfMenstruation,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // Additional fields for compatibility
      profileImage: profile?.profileImage || null,
      country: profile?.country || null,
      city: profile?.city || null,
      language: user.language || "en",
      isVerified: user.isVerified,
      isActive: user.isActive,
    }
  }

  static async getPatients(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: PatientController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      // Extract query parameters
      const page = Number.parseInt(req.query.page as string) || 1
      const limit = Number.parseInt(req.query.limit as string) || 10
      const search = (req.query.search as string) || ""
      const riskLevel = req.query.riskLevel as string
      const trimester = req.query.trimester ? Number.parseInt(req.query.trimester as string) : undefined
      const pregnancyStatus = req.query.pregnancyStatus as string

      // Calculate offset
      const offset = (page - 1) * limit

      // Build query for users with role 'patient'
      const queryBuilder = PatientController.userRepository
        .createQueryBuilder("user")
        .leftJoinAndSelect("user.profile", "profile")
        .leftJoinAndSelect("user.pregnancyForms", "pregnancyForm")
        .where("user.role = :role", { role: "patient" })
        .andWhere("user.isActive = :isActive", { isActive: true })

      // Add search filter
      if (search) {
        queryBuilder.andWhere(
          "(profile.firstName ILIKE :search OR profile.lastName ILIKE :search OR user.email ILIKE :search OR user.phoneNumber ILIKE :search)",
          { search: `%${search}%` },
        )
      }

      // Add pregnancy status filter
      if (pregnancyStatus && pregnancyStatus !== "all") {
        queryBuilder.andWhere("pregnancyForm.pregnancyStatus = :pregnancyStatus", { pregnancyStatus })
      }

      // Add trimester filter
      if (trimester) {
        queryBuilder.andWhere("pregnancyForm.currentTrimester = :trimester", { trimester })
      }

      // Get total count for pagination
      const totalItems = await queryBuilder.getCount()

      // Get paginated results
      const users = await queryBuilder.orderBy("user.createdAt", "DESC").skip(offset).take(limit).getMany()

      // Format data to match frontend Patient interface
      const patients = users.map((user) => {
        // Get the most recent pregnancy form
        const latestPregnancyForm =
          user.pregnancyForms && user.pregnancyForms.length > 0
            ? user.pregnancyForms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
            : null

        return PatientController.formatPatientData(user, latestPregnancyForm)
      })

      // Apply risk level filter (post-processing since it's calculated)
      let filteredPatients = patients
      if (riskLevel && riskLevel !== "all") {
        filteredPatients = patients.filter((patient) => patient.riskLevel === riskLevel)
      }

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limit)

      res.json({
        success: true,
        message: PatientController.getTranslation(req, "patients.fetched_successfully"),
        data: filteredPatients,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      })
    } catch (error) {
      console.error("Get patients error:", error)
      res.status(500).json({
        success: false,
        message: PatientController.getTranslation(req, "errors.server_error"),
      })
    }
  }

  static async getPatientById(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { patientId } = req.params

      const user = await PatientController.userRepository.findOne({
        where: {
          id: Number.parseInt(patientId),
          role: "patient",
          isActive: true,
        },
        relations: ["profile", "pregnancyForms", "chatHistory", "notifications"],
      })

      if (!user) {
        res.status(404).json({
          success: false,
          message: PatientController.getTranslation(req, "patients.patient_not_found"),
        })
        return
      }

      // Get the most recent pregnancy form
      const latestPregnancyForm =
        user.pregnancyForms && user.pregnancyForms.length > 0
          ? user.pregnancyForms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null

      const patientData = PatientController.formatPatientData(user, latestPregnancyForm)

      // Add additional details for single patient view
      const detailedPatientData = {
        ...patientData,
        pregnancyHistory: user.pregnancyForms || [],
        totalChatMessages: user.chatHistory?.length || 0,
        totalNotifications: user.notifications?.length || 0,
        lastLoginDate: user.updatedAt, // Approximate last activity
      }

      res.json({
        success: true,
        message: PatientController.getTranslation(req, "common.success"),
        data: detailedPatientData,
      })
    } catch (error) {
      console.error("Get patient by ID error:", error)
      res.status(500).json({
        success: false,
        message: PatientController.getTranslation(req, "errors.server_error"),
      })
    }
  }

  static async updatePatient(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: PatientController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      const { patientId } = req.params
      const updateData = req.body

      const user = await PatientController.userRepository.findOne({
        where: {
          id: Number.parseInt(patientId),
          role: "patient",
          isActive: true,
        },
        relations: ["profile", "pregnancyForms"],
      })

      if (!user) {
        res.status(404).json({
          success: false,
          message: PatientController.getTranslation(req, "patients.patient_not_found"),
        })
        return
      }

      // Update user fields if provided
      if (updateData.email) user.email = updateData.email
      if (updateData.phone) user.phoneNumber = updateData.phone
      if (updateData.language) user.language = updateData.language

      // Update profile fields if provided
      if (user.profile) {
        if (updateData.firstName) user.profile.firstName = updateData.firstName
        if (updateData.lastName) user.profile.lastName = updateData.lastName
        if (updateData.dateOfBirth) user.profile.dateOfBirth = new Date(updateData.dateOfBirth)
        if (updateData.country) user.profile.country = updateData.country
        if (updateData.city) user.profile.city = updateData.city
        if (updateData.profileImage) user.profile.profileImage = updateData.profileImage

        await PatientController.profileRepository.save(user.profile)
      }

      // Save user updates
      await PatientController.userRepository.save(user)

      // Get updated patient data
      const latestPregnancyForm =
        user.pregnancyForms && user.pregnancyForms.length > 0
          ? user.pregnancyForms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null

      const updatedPatientData = PatientController.formatPatientData(user, latestPregnancyForm)

      res.json({
        success: true,
        message: PatientController.getTranslation(req, "patients.patient_updated"),
        data: updatedPatientData,
      })
    } catch (error) {
      console.error("Update patient error:", error)
      res.status(500).json({
        success: false,
        message: PatientController.getTranslation(req, "errors.server_error"),
      })
    }
  }

  static async getPatientStats(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Get total patients count
      const totalPatients = await PatientController.userRepository.count({
        where: { role: "patient", isActive: true },
      })

      // Get patients with pregnancy forms
      const patientsWithPregnancy = await PatientController.userRepository
        .createQueryBuilder("user")
        .leftJoin("user.pregnancyForms", "pregnancyForm")
        .where("user.role = :role", { role: "patient" })
        .andWhere("user.isActive = :isActive", { isActive: true })
        .andWhere("pregnancyForm.pregnancyStatus = :status", { status: "Pregnant" })
        .getCount()

      // Get trimester distribution
      const trimesterStats = await PatientController.pregnancyRepository
        .createQueryBuilder("pregnancyForm")
        .select("pregnancyForm.currentTrimester", "trimester")
        .addSelect("COUNT(*)", "count")
        .leftJoin("pregnancyForm.user", "user")
        .where("user.role = :role", { role: "patient" })
        .andWhere("user.isActive = :isActive", { isActive: true })
        .andWhere("pregnancyForm.pregnancyStatus = :status", { status: "Pregnant" })
        .groupBy("pregnancyForm.currentTrimester")
        .getRawMany()

      // Get recent patients (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentPatients = await PatientController.userRepository.count({
        where: {
          role: "patient",
          isActive: true,
          createdAt: {
            $gte: thirtyDaysAgo,
          } as any,
        },
      })

      res.json({
        success: true,
        message: PatientController.getTranslation(req, "common.success"),
        data: {
          totalPatients,
          activePregnancies: patientsWithPregnancy,
          recentPatients,
          trimesterDistribution: {
            first: trimesterStats.find((t) => t.trimester === 1)?.count || 0,
            second: trimesterStats.find((t) => t.trimester === 2)?.count || 0,
            third: trimesterStats.find((t) => t.trimester === 3)?.count || 0,
          },
        },
      })
    } catch (error) {
      console.error("Get patient stats error:", error)
      res.status(500).json({
        success: false,
        message: PatientController.getTranslation(req, "errors.server_error"),
      })
    }
  }
}
