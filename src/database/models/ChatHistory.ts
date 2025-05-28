import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User"; 

@Entity("chat_histories")
export class ChatHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.id) 
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column()
  role: 'user' | 'model'; 

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}