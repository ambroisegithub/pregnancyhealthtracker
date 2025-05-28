// @ts-nocheck
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm"
import { User } from "./User"
import { MilestoneTranslation } from "./MilestoneTranslation"

@Entity("pregnancy_milestones")
export class PregnancyMilestone {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => User,
    (user) => user.id,
  )
  @JoinColumn({ name: "user_id" })
  user: User

  @Column()
  milestoneType:
    | "first_ultrasound"
    | "anatomy_scan"
    | "glucose_test"
    | "tdap_vaccine"
    | "group_b_strep"
    | "weekly_checkups"

  @Column()
  gestationalWeek: number

  @Column({ type: "date" })
  scheduledDate: Date

  @Column({ default: false })
  completed: boolean

  @Column({ default: false })
  reminderSent: boolean
  @Column({ type: "int", nullable: true })
  trimester: number

  @Column({ nullable: true })
  imageUrl: string

  @Column({ type: "int", nullable: true })
  week: number
  @Column("text", { nullable: true })
  notes: string

  @CreateDateColumn()
  createdAt: Date

  @OneToMany(
    () => MilestoneTranslation,
    (translation) => translation.milestone,
    { cascade: true },
  )
  translations: MilestoneTranslation[]
}
