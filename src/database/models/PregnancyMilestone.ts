
// @ts-nocheck
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./User"

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

  @Column("text", { nullable: true })
  notes: string

  @CreateDateColumn()
  createdAt: Date
}
