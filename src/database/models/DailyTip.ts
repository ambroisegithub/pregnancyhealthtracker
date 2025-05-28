import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from "typeorm"
import { User } from "./User"
import {Language} from "./Language"
@Entity("daily_tips")
@Index(["user", "tipDate", "language"], { unique: true })
export class DailyTip {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "user_id" })
  user: User

  @Column({ type: "date", name: "tip_date" })
  tipDate: string

  @Column({ type: "varchar", length: 255 })
  title: string

  @Column({ type: "text" })
  content: string

  @Column({ type: "varchar", length: 10, nullable: true })
  icon: string

  @Column({ type: "enum", enum: ["en", "fr", "rw"], default: "en" })
  language: Language

  @Column({ type: "int", nullable: true, name: "gestational_week" })
  gestationalWeek: number

  @Column({ type: "int", nullable: true })
  trimester: number

  @Column({
    type: "enum",
    enum: ["Pregnant", "Delivered", "Aborted", "Stillbirth", "Infertile", "Preconception", "Menopausal", "Nulligravid"],
    nullable: true,
    name: "pregnancy_status",
  })
  pregnancyStatus: string

  @Column({ type: "varchar", length: 50, nullable: true })
  category: string

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive: boolean

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date
}
