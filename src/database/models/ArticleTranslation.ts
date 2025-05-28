import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm"
import { Article } from "./Article"
import { Language } from "./User"

@Entity("article_translations")
export class ArticleTranslation {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => Article,
    (article) => article.translations,
  )
  @JoinColumn({ name: "article_id" })
  article: Article

  @Column({
    type: "enum",
    enum: Language,
  })
  language: Language

  @Column()
  title: string

  @Column("text")
  content: string

  @Column("text", { nullable: true })
  excerpt: string

  @Column("simple-array", { nullable: true })
  tags: string[]
}
