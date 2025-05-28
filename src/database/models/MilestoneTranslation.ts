import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm"
import { PregnancyMilestone } from "./PregnancyMilestone"
import { Language } from "./User"

@Entity("milestone_translations")
export class MilestoneTranslation {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => PregnancyMilestone,
    (milestone) => milestone.translations,
  )
  @JoinColumn({ name: "milestone_id" })
  milestone: PregnancyMilestone

  @Column({
    type: "enum",
    enum: Language,
  })
  language: Language

  @Column()
  title: string

  @Column("text")
  babyDevelopment: string

  @Column("text")
  motherChanges: string

  @Column("text")
  tips: string

  @Column("text", { nullable: true })
  warnings: string
}
