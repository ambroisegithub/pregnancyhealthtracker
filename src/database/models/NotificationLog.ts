// @ts-nocheck
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./User"

@Entity("notification_logs")
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => User,
    (user) => user.id,
  )
  @JoinColumn({ name: "user_id" })
  user: User

  @Column()
  type: "daily_tip" | "daily_article" | "vaccination_reminder" | "milestone_alert"

  @Column()
  channel: "whatsapp" | "push" | "email"

  @Column("text")
  content: string

  @Column({ default: "sent" })
  status: "sent" | "failed" | "pending"

  @Column({ nullable: true })
  gestationalWeek: number

  @Column({ nullable: true })
  errorMessage: string

  @CreateDateColumn()
  sentAt: Date
}
