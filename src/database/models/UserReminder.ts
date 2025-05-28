import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { User } from "./User"
import { ReminderTemplate, ReminderType, ReminderPriority } from "./ReminderTemplate"

export enum ReminderStatus {
  PENDING = "pending",
  SENT = "sent",
  FAILED = "failed",
  DISMISSED = "dismissed",
}

@Entity("user_reminders")
export class UserReminder {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => User,
    (user) => user.reminders,
  )
  @JoinColumn({ name: "user_id" })
  user: User

  @ManyToOne(() => ReminderTemplate)
  @JoinColumn({ name: "template_id" })
  template: ReminderTemplate

  @Column({ type: "enum", enum: ReminderType })
  type: ReminderType

  @Column({ type: "enum", enum: ReminderPriority })
  priority: ReminderPriority

  @Column()
  scheduledFor: Date // When to send this reminder

  @Column({ type: "enum", enum: ReminderStatus, default: ReminderStatus.PENDING })
  status: ReminderStatus

  @Column({ nullable: true })
  sentAt: Date

  @Column({ nullable: true })
  currentWeek: number // User's current pregnancy week when reminder was created

  @Column({ nullable: true })
  currentDay: number // For child vaccination reminders

  @Column("text", { nullable: true })
  customMessage: string // Personalized message

  @Column({ nullable: true })
  whatsappMessageId: string // Twilio message ID for tracking

  @Column({ default: 0 })
  retryCount: number

  @Column({ nullable: true })
  errorMessage: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
