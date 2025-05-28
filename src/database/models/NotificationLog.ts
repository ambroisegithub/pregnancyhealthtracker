import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./User"
export enum Language {
  EN = "en",
  FR = "fr",
  RW = "rw",
}
@Entity("notification_logs")
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => User,
    (user) => user.notifications,
  )
  @JoinColumn({ name: "user_id" })
  user: User

  @Column()
  type: string 

  @Column()
  title: string

  @Column("text")
  message: string

  @Column({
    type: "enum",
    enum: Language,
    default: Language.EN,
  })
  language: Language

  @Column({ default: false })
  isRead: boolean

  @Column({ default: true })
  isSent: boolean

  @CreateDateColumn()
  sentAt: Date

  @CreateDateColumn()
  createdAt: Date
}
