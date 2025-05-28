import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Language } from "./Language"

export enum ReminderType {
  ANC = "anc",
  VACCINATION = "vaccination",
  MILESTONE = "milestone",
  EMERGENCY = "emergency",
}

export enum ReminderPriority {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

@Entity("reminder_templates")
export class ReminderTemplate {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: "enum", enum: ReminderType })
  type: ReminderType

  @Column({ type: "enum", enum: ReminderPriority, default: ReminderPriority.MEDIUM })
  priority: ReminderPriority

  @Column()
  weekStart: number // Start of week range

  @Column()
  weekEnd: number // End of week range

  @Column({ nullable: true })
  specificDay: number // Specific day for vaccination reminders

@Column({
  type: "enum",
  enum: Language,
  default: Language.EN,
})
language: Language 

  @Column()
  title: string

  @Column("text")
  message: string

  @Column("text", { nullable: true })
  actionRequired: string // What user needs to do

  @Column({ default: true })
  isActive: boolean

  @Column({ default: false })
  isRepeating: boolean // For weekly/daily reminders

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
