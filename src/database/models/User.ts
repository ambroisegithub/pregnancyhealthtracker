import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from "typeorm"
import { Profile } from "./Profile";
import { PregnancyForm } from "./PregnancyForm";
import {ChatHistory} from "./ChatHistory";
@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ default: 'patient' })
  role: 'patient' | 'doctor' | 'admin' | 'superadmin';

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isFirstLogin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  profile: Profile;
  
    @OneToMany(() => ChatHistory, (chatHistory) => chatHistory.user)
  chatHistories: ChatHistory[];

  @OneToMany(() => PregnancyForm, (form) => form.user)
  pregnancyForms: PregnancyForm[];
}
