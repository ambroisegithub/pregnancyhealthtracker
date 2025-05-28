import type { Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { validationResult } from "express-validator"
import type { AuthenticatedRequest } from "../types"
import dbConnection from "../database"
import { User } from "../database/models/User"
import { Profile } from "../database/models/Profile"
import { NotificationService } from "../services/notification.service"

export class AuthController {
  static async register(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        })
        return
      }

      const { email, password, phoneNumber, firstName, lastName, dateOfBirth, country, city } = req.body

      // Check if user already exists
      const userRepository = dbConnection.getRepository(User)
      const existingUser = await userRepository.findOne({ where: { email } })
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: "User with this email already exists",
        })
        return
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Create user
      const user = userRepository.create({
        email,
        password: hashedPassword,
        phoneNumber,
        role: "patient",
        isVerified: false,
        isFirstLogin: true,
      })
      await userRepository.save(user)

      // Create profile
      const profileRepository = dbConnection.getRepository(Profile)
      const profile = profileRepository.create({
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        country,
        city,
        user,
      })
      await profileRepository.save(profile)

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
        message: "User registered successfully",
        data: {
          user: userResponse,
          profile,
          token,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        })
        return
      }

      const { email, password } = req.body

      // Find user with profile
      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({
        where: { email },
        relations: ["profile"],
      })

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        })
        return
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
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
        message: "Login successful",
        data: {
          user: userResponse,
          token,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userRepository = dbConnection.getRepository(User)
      const user = await userRepository.findOne({
        where: { id: req.user.id },
        relations: ["profile", "pregnancyForms"],
      })

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        })
        return
      }

      const { password: _, ...userResponse } = user

      res.json({
        success: true,
        data: userResponse,
      })
    } catch (error) {
      next(error)
    }
  }
}
