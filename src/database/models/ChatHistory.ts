import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./User"
export enum Language {
  EN = "en",
  FR = "fr",
  RW = "rw",
}
@Entity("chat_history")
export class ChatHistory {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => User,
    (user) => user.chatHistory,
  )
  @JoinColumn({ name: "user_id" })
  user: User

  @Column()
  role: "user" | "model"

  @Column("text")
  content: string

  @Column({
    type: "enum",
    enum: Language,
    default: Language.EN,
  })
  language: Language

  @CreateDateColumn()
  createdAt: Date
}
