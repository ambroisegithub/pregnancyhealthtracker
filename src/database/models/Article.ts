import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm"

@Entity("articles")
export class Article {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ nullable: true })
  week: number; 

  @Column({ nullable: true })
  target: string; // e.g., "Pregnant", "Delivered", "Preconception"

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ nullable: true })
  articleImage: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}