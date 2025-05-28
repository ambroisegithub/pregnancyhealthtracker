import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from "typeorm"
import { Profile } from "./Profile"
import { PregnancyForm } from "./PregnancyForm"
import { ChatHistory } from "./ChatHistory"
import { NotificationLog } from "./NotificationLog"
import { UserReminder } from "./UserReminder"

export enum Language {
  EN = "en",
  FR = "fr",
  RW = "rw",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  email: string

  @Column()
  password: string

  @Column({ nullable: true })
  phoneNumber: string

  @Column({
    type: "enum",
    enum: Language,
    default: Language.EN,
  })
  language: Language

  @Column({ default: "patient" })
  role: string

  @Column({ default: false })
  isVerified: boolean

  @Column({ default: true })
  isFirstLogin: boolean

  @Column({ default: true })
  isActive: boolean

  @Column({ nullable: true })
  resetPasswordToken: string

  @Column({ nullable: true })
  resetPasswordExpires: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToOne(
    () => Profile,
    (profile) => profile.user,
    { cascade: true },
  )
  profile: Profile

  @OneToMany(
    () => PregnancyForm,
    (pregnancyForm) => pregnancyForm.user,
  )
  pregnancyForms: PregnancyForm[]

  @OneToMany(
    () => ChatHistory,
    (chatHistory) => chatHistory.user,
  )
  chatHistory: ChatHistory[]

  @OneToMany(
    () => NotificationLog,
    (notificationLog) => notificationLog.user,
  )
  notifications: NotificationLog[]

    @OneToMany(
    () => UserReminder,
    (reminder) => reminder.user,
  )
  reminders: UserReminder[];
}
