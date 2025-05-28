import type { Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { validationResult } from "express-validator"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import dbConnection from "../database"
import { User, Language } from "../database/models/User"
import { Profile } from "../database/models/Profile"
import { NotificationService } from "../services/notification.service"

export class AuthController {
  private static userRepository = dbConnection.getRepository(User)
  private static profileRepository = dbConnection.getRepository(Profile)

  // Helper function to get translation with fallback
  private static getTranslation(req: any, key: string, fallback?: string): string {
    if (req.t && typeof req.t === "function") {
      return req.t(key)
    }

    // Fallback translations
    const fallbackTranslations: { [key: string]: string } = {
      "errors.validation_error": "Validation error",
      "auth.user_exists": "User already exists",
      "auth.registration_success": "Registration successful",
      "auth.invalid_credentials": "Invalid credentials",
      "auth.login_success": "Login successful",
      "auth.user_not_found": "User not found",
      "common.success": "Success",
      "errors.invalid_language": "Invalid language",
      "common.language_updated": "Language updated successfully",
      "errors.server_error": "Internal server error",
      "auth.password_reset_sent": "Password reset link sent",
    }

    return fallbackTranslations[key] || fallback || key
  }

  static async register(req: LocalizedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: AuthController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      const { email, password, phoneNumber, firstName, lastName, dateOfBirth, country, city, language } = req.body

      // Check if user already exists
      const existingUser = await AuthController.userRepository.findOne({ where: { email } })
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: AuthController.getTranslation(req, "auth.user_exists"),
        })
        return
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Create user with language preference
      const user = AuthController.userRepository.create({
        email,
        password: hashedPassword,
        phoneNumber,
        role: "patient",
        isVerified: false,
        isFirstLogin: true,
        language: language || req.language || "en",
      })
      await AuthController.userRepository.save(user)

      // Create profile
      const profile = AuthController.profileRepository.create({
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        country,
        city,
        user,
      })
      await AuthController.profileRepository.save(profile)

      // Update user with profile relation
      user.profile = profile

      // Send WhatsApp welcome message if phone number provided
      if (phoneNumber) {
        try {
          await NotificationService.sendWelcomeMessage(user)
        } catch (error) {
          console.error("Failed to send WhatsApp welcome message:", error)
          // Don't fail registration if WhatsApp message fails
        }
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "24h" },
      )

      // Remove password from response
      const { password: _, ...userResponse } = user

      res.status(201).json({
        success: true,
        message: AuthController.getTranslation(req, "auth.registration_success"),
        data: {
          user: userResponse,
          profile,
          token,
        },
      })
    } catch (error) {
      console.error("Registration error:", error)
      next(error)
    }
  }

  static async login(req: LocalizedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: AuthController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      const { email, password } = req.body

      // Find user with profile
      const user = await AuthController.userRepository.findOne({
        where: { email },
        relations: ["profile"],
      })

      if (!user) {
        res.status(401).json({
          success: false,
          message: AuthController.getTranslation(req, "auth.invalid_credentials"),
        })
        return
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          message: AuthController.getTranslation(req, "auth.invalid_credentials"),
        })
        return
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "24h" },
      )

      // Remove password from response
      const { password: _, ...userResponse } = user

      res.json({
        success: true,
        message: AuthController.getTranslation(req, "auth.login_success"),
        data: {
          user: userResponse,
          token,
        },
      })
    } catch (error) {
      console.error("Login error:", error)
      next(error)
    }
  }

  static async getProfile(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await AuthController.userRepository.findOne({
        where: { id: req.user.id },
        relations: ["profile", "pregnancyForms"],
      })

      if (!user) {
        res.status(404).json({
          success: false,
          message: AuthController.getTranslation(req, "auth.user_not_found"),
        })
        return
      }

      const { password: _, ...userResponse } = user

      res.json({
        success: true,
        message: AuthController.getTranslation(req, "common.success"),
        data: userResponse,
      })
    } catch (error) {
      console.error("Get profile error:", error)
      next(error)
    }
  }

  static async updateLanguage(req: LocalizedRequest & AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id
      const { language } = req.body

      // Validate language
      const supportedLanguages = Object.values(Language)
      if (!supportedLanguages.includes(language)) {
        return res.status(400).json({
          success: false,
          message: AuthController.getTranslation(req, "errors.invalid_language"),
        })
      }

      // Update user language
      await AuthController.userRepository.update(userId, { language })

      res.json({
        success: true,
        message: AuthController.getTranslation(req, "common.language_updated"),
        data: { language },
      })
    } catch (error) {
      console.error("Update language error:", error)
      res.status(500).json({
        success: false,
        message: AuthController.getTranslation(req, "errors.server_error"),
      })
    }
  }

  static async forgotPassword(req: LocalizedRequest, res: Response) {
    try {
      const { email } = req.body

      const user = await AuthController.userRepository.findOne({ where: { email } })
      if (!user) {
        return res.status(404).json({
          success: false,
          message: AuthController.getTranslation(req, "auth.user_not_found"),
        })
      }

      const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "1h" })

      // Save reset token to user
      user.resetPasswordToken = resetToken
      user.resetPasswordExpires = new Date(Date.now() + 3600000) // 1 hour
      await AuthController.userRepository.save(user)

      // TODO: Send email with reset link

      res.json({
        success: true,
        message: AuthController.getTranslation(req, "auth.password_reset_sent"),
      })
    } catch (error) {
      console.error("Forgot password error:", error)
      res.status(500).json({
        success: false,
        message: AuthController.getTranslation(req, "errors.server_error"),
      })
    }
  }
}
