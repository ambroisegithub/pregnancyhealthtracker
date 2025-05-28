
// @ts-nocheck
import type { Request } from "express"
import type { User, Language } from "../database/models/User"

export interface AuthenticatedRequest extends Request {
  user: User
}

export interface LocalizedRequest extends Request {
  language: Language
  t: (key: string, options?: any) => string
}

export interface AuthenticatedLocalizedRequest extends AuthenticatedRequest, LocalizedRequest {}

export interface PregnancyDetails {
  gestationalAge: {
    weeks: number
    days: number
    totalDays: number
  }
  trimester: number
  expectedDeliveryDate: Date
  daysUntilDelivery: number
  isOverdue: boolean
}

export interface NotificationPreferences {
  dailyTips: boolean
  milestoneReminders: boolean
  appointmentReminders: boolean
  whatsappEnabled: boolean
  emailEnabled: boolean
  language: Language
}

export interface ChatMessage {
  id: number
  content: string
  role: "user" | "model"
  language: Language
  createdAt: Date
}

export interface ArticleData {
  id: number
  title: string
  content: string
  excerpt?: string
  week?: number
  target?: string
  articleImage?: string
  tags?: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MilestoneData {
  id: number
  week: number
  trimester: number
  title: string
  babyDevelopment: string
  motherChanges: string
  tips: string
  warnings?: string
  imageUrl?: string
}

export interface WhatsAppMessage {
  from: string
  to: string
  body: string
  messageId: string
  timestamp: Date
}

export interface NotificationData {
  id: number
  type: string
  title: string
  message: string
  language: Language
  sentAt: Date
  isRead: boolean
}
