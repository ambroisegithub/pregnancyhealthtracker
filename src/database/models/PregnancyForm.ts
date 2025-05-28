import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { User } from "./User";

@Entity("pregnancy_forms")
export class PregnancyForm {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'date' })
  dateOfBirth: Date;

// Ibisobanuro ry'ibyo bintu mu Kinyarwanda
//   | **Status**        | **Ibisobanuro mu Kinyarwanda**                   | **Ibisobanuro byimbitse**                                                             |
// | ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
// | **Pregnant**      | **Atwite**                                       | Umugore uri mu gihe cy’inda (ari mu mezi y’uburumbuke).                               |
// | **Delivered**     | **Yarabyaye**                                    | Umugore wigeze kubyara, yaba yarabyaye ku gihe cyangwa imburagihe.                    |
// | **Aborted**       | **Yatakaje inda** / **Inda y’avuyemo**           | Umugore wigeze gutakaza inda, yaba ku bushake cyangwa impanuka.                       |
// | **Stillbirth**    | **Umwana wapfuye avuka**                         | Umugore wigeze kubyara umwana wapfuye igihe avuka (nta buzima bwigeze bugaragara).    |
// | **Infertile**     | **Ntabushobozi bwo gutwita** / **Ntarabyara**    | Umugore udashobora gusama inda cyangwa utarigeze atwita.                              |
// | **Preconception** | **Mbere yo gusama inda**                         | Umugore utaragera ku gusama inda ariko wateganya gutwita (ibanze ku gutegura gusama). |
// | **Menopausal**    | **Yinjiye mu gihe cya Menopause** / **Yaracuze** | Umugore wageze mu gihe cyo kudasama inda ukundi kubera impinduka z’imyaka.            |
// | **Nulligravid**   | **Ntiyigeze atwita na rimwe**                    | Umugore utarigeze atwita na rimwe mu buzima bwe.                                      |


  @Column()
  pregnancyStatus: 'Pregnant' | 'Delivered' | 'Aborted' | 'Stillbirth' | 'Infertile' | 'Preconception' | 'Menopausal' | 'Nulligravid';
  @Column({ type: 'date', nullable: true })
  lastDateOfMenstruation: Date;
// Gravida refers to the number of times a woman has been pregnant, regardless of whether these pregnancies were carried to term or not.
  @Column({ nullable: true })
  gravida: number;
// Umubare w’abana bavutse nyuma y’ibyumweru 37 kugeza ku byumweru 42 by’inda, bivuze ko bavutse ku gihe.
  @Column({ nullable: true })
  term: number;
// Umubare w’abana bavutse mbere y’icyumweru cya 37 cy’inda.
  @Column({ nullable: true })
  preterm: number;
// Umubare w’inda zavuyemo mbere y’igihe, yaba ari ku bushake (abortion) cyangwa ku buryo bw’impanuka (miscarriage).
  @Column({ nullable: true })
  abortion: number;
// Umubare w’abana bavukiye igihe, bavutse ari bazima kandi bagihumeka.
  @Column({ nullable: true })
  living: number;

  // Calculated fields
  @Column({ type: 'date', nullable: true })
  expectedDeliveryDate: Date;

  @Column({ nullable: true })
  currentTrimester: number;

  @Column({ nullable: true })
  gestationalWeeks: number;

  @Column({ nullable: true })
  gestationalDays: number;

  @ManyToOne(() => User, (user) => user.pregnancyForms)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}