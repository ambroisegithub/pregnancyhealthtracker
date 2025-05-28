// @ts-nocheck
import type { Response, NextFunction } from "express"
import { validationResult } from "express-validator"
import type { AuthenticatedRequest, LocalizedRequest } from "../types"
import dbConnection from "../database"
import { Article } from "../database/models/Article"
import { ArticleTranslation } from "../database/models/ArticleTranslation"
import { PregnancyForm } from "../database/models/PregnancyForm"
import type { Language } from "../database/models/User"
import { geminiService } from "../services/geminiService"
import { User } from "../database/models/User"

export class ArticleController {
  private static articleRepository = dbConnection.getRepository(Article)
  private static translationRepository = dbConnection.getRepository(ArticleTranslation)
  private static pregnancyRepository = dbConnection.getRepository(PregnancyForm)
  private static userRepository = dbConnection.getRepository(User)

  // Helper method to validate and parse ID parameters
  private static validateId(id: string): number | null {
    const numId = Number.parseInt(id, 10)
    return !isNaN(numId) && numId > 0 ? numId : null
  }

  // Add AI generation methods after the existing validateId method
  private static async generatePersonalizedPrompt(
    user: User,
    pregnancyForm: PregnancyForm,
    articleType: "daily" | "weekly" | "general",
    language: Language,
    week?: number,
  ): Promise<string> {
    const languageInstructions = {
      en: "Please respond in English.",
      fr: "Veuillez répondre en français.",
      rw: "Nyamuneka subiza mu kinyarwanda.",
    }

    const basePrompt = `You are a professional pregnancy health advisor. Create a personalized ${articleType} article for a pregnant woman.

User Profile:
- Name: ${user.profile?.firstName || "Dear Mom"}
- Pregnancy Status: ${pregnancyForm.pregnancyStatus}
- Current Week: ${pregnancyForm.gestationalWeeks || "Unknown"}
- Trimester: ${pregnancyForm.currentTrimester || 1}
- Expected Delivery: ${pregnancyForm.expectedDeliveryDate ? new Date(pregnancyForm.expectedDeliveryDate).toLocaleDateString() : "Not set"}
- Language: ${language}

${languageInstructions[language] || languageInstructions.en}

Requirements:
1. Address the user personally using their name
2. Focus on week ${week || pregnancyForm.gestationalWeeks || 1} of pregnancy
3. Include relevant health tips, baby development, and maternal changes
4. Keep the tone supportive, informative, and encouraging
5. Include 3-5 practical tips or advice points
6. Mention any important milestones or checkups for this week
7. Response should be 300-500 words
8. Format with clear sections: Introduction, Baby Development, Maternal Changes, Tips, Conclusion

Article Type: ${articleType === "daily" ? "Daily tip and encouragement" : articleType === "weekly" ? "Weekly comprehensive guide" : "General pregnancy guidance"}`

    return basePrompt
  }

  private static async generateAndSaveArticle(
    user: User,
    pregnancyForm: PregnancyForm,
    articleType: "daily" | "weekly" | "general",
    language: Language,
    week?: number,
    target?: string,
  ): Promise<Article> {
    try {
      // Generate AI content
      const prompt = await this.generatePersonalizedPrompt(user, pregnancyForm, articleType, language, week)
      const aiContent = await geminiService.generateResponse(prompt, language)

      // Extract title from content (first line or create one)
      const lines = aiContent.split("\n").filter((line) => line.trim())
      const title =
        lines[0]?.replace(/^#+\s*/, "") ||
        `${articleType === "daily" ? "Daily" : articleType === "weekly" ? "Weekly" : "Pregnancy"} Guide - Week ${week || pregnancyForm.gestationalWeeks || 1}`

      // Create article
      const article = this.articleRepository.create({
        week: week || pregnancyForm.gestationalWeeks || null,
        target: target || pregnancyForm.pregnancyStatus,
        title: title.substring(0, 255), // Ensure title fits in database
        content: aiContent,
        articleImage: null,
        isActive: true,
        user: user, // Associate with user
      })

      const savedArticle = await this.articleRepository.save(article)

      // Create translation for the generated content
      const translation = this.translationRepository.create({
        article: savedArticle,
        language: language,
        title: title.substring(0, 255),
        content: aiContent,
        excerpt: aiContent.substring(0, 200) + "...",
        tags: [
          articleType,
          `week-${week || pregnancyForm.gestationalWeeks}`,
          pregnancyForm.pregnancyStatus.toLowerCase(),
        ],
      })

      await this.translationRepository.save(translation)

      return savedArticle
    } catch (error) {
      console.error("Error generating AI article:", error)
      throw new Error("Failed to generate personalized article")
    }
  }

  private static async checkAndGenerateArticles(
    user: User,
    pregnancyForm: PregnancyForm,
    language: Language,
    articleType: "daily" | "weekly" | "general",
    week?: number,
    target?: string,
  ): Promise<Article[]> {
    // Check if articles already exist for this user/context/language
    const queryBuilder = this.articleRepository
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
      .where("article.user = :userId", { userId: user.id })
      .andWhere("article.isActive = :isActive", { isActive: true })

    if (week) {
      queryBuilder.andWhere("article.week = :week", { week })
    }

    if (target) {
      queryBuilder.andWhere("article.target = :target", { target })
    }

    const existingArticles = await queryBuilder.getMany()

    // If articles exist, return them
    if (existingArticles.length > 0) {
      return existingArticles
    }

    // If no articles exist, generate new ones
    const newArticle = await this.generateAndSaveArticle(user, pregnancyForm, articleType, language, week, target)

    // Fetch the newly created article with translations
    const articleWithTranslations = await this.articleRepository
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
      .where("article.id = :id", { id: newArticle.id })
      .getOne()

    return articleWithTranslations ? [articleWithTranslations] : []
  }

  // Fallback translation function
  private static getTranslation(req: any, key: string): string {
    if (req.t && typeof req.t === "function") {
      return req.t(key)
    }

    // Fallback translations
    const fallbackTranslations: Record<string, string> = {
      "pregnancy.form_required": "Pregnancy form is required",
      "articles.title": "Articles",
      "articles.daily_article": "Daily Article",
      "articles.weekly_articles": "Weekly Articles",
      "articles.no_articles": "No articles found",
      "articles.created_success": "Article created successfully",
      "articles.updated_success": "Article updated successfully",
      "articles.deleted_success": "Article deleted successfully",
      "articles.not_found": "Article not found",
      "articles.invalid_id": "Invalid article ID provided",
      "articles.generating": "Generating personalized article for you...",
      "articles.ai_generated": "Personalized article generated successfully",
      "articles.generation_failed": "Failed to generate personalized article",
      "errors.validation_error": "Validation error",
      "errors.server_error": "Internal server error",
      "errors.invalid_parameter": "Invalid parameter provided",
      "common.success": "Success",
    }

    return fallbackTranslations[key] || key
  }

  static async getArticlesForUser(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const language = req.language as Language

      // Get user's latest pregnancy status
      const pregnancyForm = await ArticleController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: ArticleController.getTranslation(req, "pregnancy.form_required"),
        })
        return
      }

      let articles: Article[] = []

      if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.gestationalWeeks !== null) {
        // First try to get existing user-specific articles
        articles = await ArticleController.articleRepository
          .createQueryBuilder("article")
          .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
          .where("article.user = :userId", { userId: req.user.id })
          .andWhere("article.week = :week", { week: pregnancyForm.gestationalWeeks })
          .andWhere("article.isActive = :isActive", { isActive: true })
          .orderBy("article.createdAt", "DESC")
          .getMany()

        // If no user-specific articles, check and generate
        if (articles.length === 0) {
          articles = await ArticleController.checkAndGenerateArticles(
            req.user,
            pregnancyForm,
            language,
            "general",
            pregnancyForm.gestationalWeeks,
            pregnancyForm.pregnancyStatus,
          )
        }

        // If still no articles for exact week, try trimester-based generation
        if (articles.length === 0) {
          const trimesterStart =
            pregnancyForm.currentTrimester === 1 ? 1 : pregnancyForm.currentTrimester === 2 ? 13 : 29
          const trimesterEnd =
            pregnancyForm.currentTrimester === 1 ? 12 : pregnancyForm.currentTrimester === 2 ? 28 : 40

          // Try to get existing trimester articles for user
          articles = await ArticleController.articleRepository
            .createQueryBuilder("article")
            .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
            .where("article.user = :userId", { userId: req.user.id })
            .andWhere("article.week BETWEEN :start AND :end", {
              start: trimesterStart,
              end: trimesterEnd,
            })
            .andWhere("article.isActive = :isActive", { isActive: true })
            .orderBy("article.createdAt", "DESC")
            .limit(10)
            .getMany()

          // If no trimester articles, generate one for current week
          if (articles.length === 0) {
            articles = await ArticleController.checkAndGenerateArticles(
              req.user,
              pregnancyForm,
              language,
              "general",
              pregnancyForm.gestationalWeeks,
              pregnancyForm.pregnancyStatus,
            )
          }
        }
      } else {
        // For non-pregnant status, check and generate articles
        articles = await ArticleController.checkAndGenerateArticles(
          req.user,
          pregnancyForm,
          language,
          "general",
          undefined,
          pregnancyForm.pregnancyStatus,
        )
      }

      // Format response with localized content
      const localizedArticles = articles.map((article) => ({
        id: article.id,
        week: article.week,
        target: article.target,
        articleImage: article.articleImage,
        isActive: article.isActive,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        title: article.translations[0]?.title || article.title,
        content: article.translations[0]?.content || article.content,
        excerpt: article.translations[0]?.excerpt || "",
        tags: article.translations[0]?.tags || [],
      }))

      res.json({
        success: true,
        message: ArticleController.getTranslation(req, "articles.title"),
        data: {
          articles: localizedArticles,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
            expectedDeliveryDate: pregnancyForm.expectedDeliveryDate,
          },
        },
      })
    } catch (error) {
      console.error("Get articles for user error:", error)
      next(error)
    }
  }

  static async getDailyArticle(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const language = req.language as Language

      // Get user's current pregnancy status
      const pregnancyForm = await ArticleController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: ArticleController.getTranslation(req, "pregnancy.form_required"),
        })
        return
      }

      let dailyArticle: Article | null = null

      if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.gestationalWeeks !== null) {
        // First try to get existing user-specific daily article
        dailyArticle = await ArticleController.articleRepository
          .createQueryBuilder("article")
          .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
          .where("article.user = :userId", { userId: req.user.id })
          .andWhere("article.week = :week", { week: pregnancyForm.gestationalWeeks })
          .andWhere("article.isActive = :isActive", { isActive: true })
          .orderBy("article.createdAt", "DESC")
          .getOne()

        // If no user-specific article, generate one
        if (!dailyArticle) {
          const articles = await ArticleController.checkAndGenerateArticles(
            req.user,
            pregnancyForm,
            language,
            "daily",
            pregnancyForm.gestationalWeeks,
            pregnancyForm.pregnancyStatus,
          )
          dailyArticle = articles[0] || null
        }

        // Fallback to trimester-based generation if still no article
        if (!dailyArticle) {
          const articles = await ArticleController.checkAndGenerateArticles(
            req.user,
            pregnancyForm,
            language,
            "daily",
            pregnancyForm.currentTrimester,
            pregnancyForm.pregnancyStatus,
          )
          dailyArticle = articles[0] || null
        }
      } else {
        // For non-pregnant status, check and generate articles
        const articles = await ArticleController.checkAndGenerateArticles(
          req.user,
          pregnancyForm,
          language,
          "daily",
          undefined,
          pregnancyForm.pregnancyStatus,
        )
        dailyArticle = articles[0] || null
      }

      if (!dailyArticle) {
        res.status(404).json({
          success: false,
          message: ArticleController.getTranslation(req, "articles.no_articles"),
        })
        return
      }

      const localizedArticle = {
        id: dailyArticle.id,
        week: dailyArticle.week,
        target: dailyArticle.target,
        articleImage: dailyArticle.articleImage,
        isActive: dailyArticle.isActive,
        createdAt: dailyArticle.createdAt,
        updatedAt: dailyArticle.updatedAt,
        title: dailyArticle.translations[0]?.title || dailyArticle.title,
        content: dailyArticle.translations[0]?.content || dailyArticle.content,
        excerpt: dailyArticle.translations[0]?.excerpt || "",
        tags: dailyArticle.translations[0]?.tags || [],
      }

      res.json({
        success: true,
        message: ArticleController.getTranslation(req, "articles.daily_article"),
        data: {
          article: localizedArticle,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
          },
        },
      })
    } catch (error) {
      console.error("Get daily article error:", error)
      next(error)
    }
  }

  static async getWeeklyArticles(
    req: AuthenticatedRequest & LocalizedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const language = req.language as Language
      const { week } = req.query

      // Get user's current pregnancy status
      const pregnancyForm = await ArticleController.pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: "DESC" },
      })

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: ArticleController.getTranslation(req, "pregnancy.form_required"),
        })
        return
      }

      // Determine which week to get articles for
      let targetWeek: number
      if (week && !isNaN(Number(week))) {
        targetWeek = Number(week)
      } else if (pregnancyForm.pregnancyStatus === "Pregnant" && pregnancyForm.gestationalWeeks !== null) {
        targetWeek = pregnancyForm.gestationalWeeks
      } else {
        targetWeek = 1 // Default to week 1 if no specific week
      }

      // First try to get existing user-specific weekly articles
      let weeklyArticles = await ArticleController.articleRepository
        .createQueryBuilder("article")
        .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
        .where("article.user = :userId", { userId: req.user.id })
        .andWhere("article.week = :week", { week: targetWeek })
        .andWhere("article.isActive = :isActive", { isActive: true })
        .orderBy("article.createdAt", "DESC")
        .getMany()

      // If no user-specific articles, generate them
      if (weeklyArticles.length === 0) {
        weeklyArticles = await ArticleController.checkAndGenerateArticles(
          req.user,
          pregnancyForm,
          language,
          "weekly",
          targetWeek,
          pregnancyForm.pregnancyStatus,
        )
      }

      // If no articles for specific week and user is pregnant, try trimester-based generation
      if (weeklyArticles.length === 0 && pregnancyForm.pregnancyStatus === "Pregnant") {
        const trimesterStart = pregnancyForm.currentTrimester === 1 ? 1 : pregnancyForm.currentTrimester === 2 ? 13 : 29
        const trimesterEnd = pregnancyForm.currentTrimester === 1 ? 12 : pregnancyForm.currentTrimester === 2 ? 28 : 40

        // Try existing trimester articles for user
        const trimesterArticles = await ArticleController.articleRepository
          .createQueryBuilder("article")
          .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
          .where("article.user = :userId", { userId: req.user.id })
          .andWhere("article.week BETWEEN :start AND :end", {
            start: trimesterStart,
            end: trimesterEnd,
          })
          .andWhere("article.isActive = :isActive", { isActive: true })
          .orderBy("article.week", "ASC")
          .addOrderBy("article.createdAt", "DESC")
          .getMany()

        if (trimesterArticles.length > 0) {
          weeklyArticles = trimesterArticles
        } else {
          // Generate article for the requested week
          weeklyArticles = await ArticleController.checkAndGenerateArticles(
            req.user,
            pregnancyForm,
            language,
            "weekly",
            targetWeek,
            pregnancyForm.pregnancyStatus,
          )
        }
      }

      // Format response with localized content
      const localizedArticles = weeklyArticles.map((article) => ({
        id: article.id,
        week: article.week,
        target: article.target,
        articleImage: article.articleImage,
        isActive: article.isActive,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        title: article.translations[0]?.title || article.title,
        content: article.translations[0]?.content || article.content,
        excerpt: article.translations[0]?.excerpt || "",
        tags: article.translations[0]?.tags || [],
      }))

      res.json({
        success: true,
        message: ArticleController.getTranslation(req, "articles.weekly_articles"),
        data: {
          articles: localizedArticles,
          week: targetWeek,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
          },
        },
      })
    } catch (error) {
      console.error("Get weekly articles error:", error)
      next(error)
    }
  }

  // Admin functions
  static async createArticle(req: LocalizedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: ArticleController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      const { week, target, title, content, articleImage, translations } = req.body

      const article = ArticleController.articleRepository.create({
        week: week || null,
        target: target || null,
        title,
        content,
        articleImage: articleImage || null,
        isActive: true,
      })

      const savedArticle = await ArticleController.articleRepository.save(article)

      // Create translations if provided
      if (translations && Array.isArray(translations)) {
        const articleTranslations = translations.map((translation) =>
          ArticleController.translationRepository.create({
            article: savedArticle,
            language: translation.language,
            title: translation.title,
            content: translation.content,
            excerpt: translation.excerpt,
            tags: translation.tags,
          }),
        )

        await ArticleController.translationRepository.save(articleTranslations)
      }

      res.status(201).json({
        success: true,
        message: ArticleController.getTranslation(req, "articles.created_success"),
        data: savedArticle,
      })
    } catch (error) {
      console.error("Create article error:", error)
      next(error)
    }
  }

  static async getAllArticles(req: LocalizedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const language = req.language as Language
      const { page = 1, limit = 10, week, target } = req.query

      const queryBuilder = ArticleController.articleRepository
        .createQueryBuilder("article")
        .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
        .where("article.isActive = :isActive", { isActive: true })

      if (week) {
        queryBuilder.andWhere("article.week = :week", { week: Number(week) })
      }

      if (target) {
        queryBuilder.andWhere("article.target = :target", { target })
      }

      const articles = await queryBuilder
        .orderBy("article.createdAt", "DESC")
        .skip((Number(page) - 1) * Number(limit))
        .take(Number(limit))
        .getMany()

      const localizedArticles = articles.map((article) => ({
        id: article.id,
        week: article.week,
        target: article.target,
        articleImage: article.articleImage,
        isActive: article.isActive,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        title: article.translations[0]?.title || article.title,
        content: article.translations[0]?.content || article.content,
        excerpt: article.translations[0]?.excerpt || "",
        tags: article.translations[0]?.tags || [],
      }))

      res.json({
        success: true,
        message: ArticleController.getTranslation(req, "common.success"),
        data: {
          articles: localizedArticles,
          pagination: {
            page: Number(page),
            limit: Number(limit),
          },
        },
      })
    } catch (error) {
      console.error("Get all articles error:", error)
      next(error)
    }
  }

  static async getArticleById(req: LocalizedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const language = req.language as Language

      // Validate ID parameter
      const articleId = ArticleController.validateId(id)
      if (!articleId) {
        res.status(400).json({
          success: false,
          message: ArticleController.getTranslation(req, "articles.invalid_id"),
        })
        return
      }

      const article = await ArticleController.articleRepository
        .createQueryBuilder("article")
        .leftJoinAndSelect("article.translations", "translation", "translation.language = :language", { language })
        .where("article.id = :id", { id: articleId })
        .andWhere("article.isActive = :isActive", { isActive: true })
        .getOne()

      if (!article) {
        res.status(404).json({
          success: false,
          message: ArticleController.getTranslation(req, "articles.not_found"),
        })
        return
      }

      const localizedArticle = {
        id: article.id,
        week: article.week,
        target: article.target,
        articleImage: article.articleImage,
        isActive: article.isActive,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        title: article.translations[0]?.title || article.title,
        content: article.translations[0]?.content || article.content,
        excerpt: article.translations[0]?.excerpt || "",
        tags: article.translations[0]?.tags || [],
      }

      res.json({
        success: true,
        message: ArticleController.getTranslation(req, "common.success"),
        data: localizedArticle,
      })
    } catch (error) {
      console.error("Get article by ID error:", error)
      next(error)
    }
  }

  static async updateArticle(req: LocalizedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const articleId = ArticleController.validateId(id)

      if (!articleId) {
        res.status(400).json({
          success: false,
          message: ArticleController.getTranslation(req, "articles.invalid_id"),
        })
        return
      }

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: ArticleController.getTranslation(req, "errors.validation_error"),
          errors: errors.array(),
        })
        return
      }

      const article = await ArticleController.articleRepository.findOne({
        where: { id: articleId },
      })

      if (!article) {
        res.status(404).json({
          success: false,
          message: ArticleController.getTranslation(req, "articles.not_found"),
        })
        return
      }

      const { week, target, title, content, articleImage, isActive, translations } = req.body

      // Update article fields
      if (week !== undefined) article.week = week
      if (target !== undefined) article.target = target
      if (title !== undefined) article.title = title
      if (content !== undefined) article.content = content
      if (articleImage !== undefined) article.articleImage = articleImage
      if (isActive !== undefined) article.isActive = isActive

      const updatedArticle = await ArticleController.articleRepository.save(article)

      // Update translations if provided
      if (translations && Array.isArray(translations)) {
        // Remove existing translations
        await ArticleController.translationRepository.delete({ article: { id: articleId } })

        // Create new translations
        const articleTranslations = translations.map((translation) =>
          ArticleController.translationRepository.create({
            article: updatedArticle,
            language: translation.language,
            title: translation.title,
            content: translation.content,
            excerpt: translation.excerpt,
            tags: translation.tags,
          }),
        )

        await ArticleController.translationRepository.save(articleTranslations)
      }

      res.json({
        success: true,
        message: ArticleController.getTranslation(req, "articles.updated_success"),
        data: updatedArticle,
      })
    } catch (error) {
      console.error("Update article error:", error)
      next(error)
    }
  }

  static async deleteArticle(req: LocalizedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const articleId = ArticleController.validateId(id)

      if (!articleId) {
        res.status(400).json({
          success: false,
          message: ArticleController.getTranslation(req, "articles.invalid_id"),
        })
        return
      }

      const article = await ArticleController.articleRepository.findOne({
        where: { id: articleId },
      })

      if (!article) {
        res.status(404).json({
          success: false,
          message: ArticleController.getTranslation(req, "articles.not_found"),
        })
        return
      }

      // Soft delete by setting isActive to false
      article.isActive = false
      await ArticleController.articleRepository.save(article)

      res.json({
        success: true,
        message: ArticleController.getTranslation(req, "articles.deleted_success"),
      })
    } catch (error) {
      console.error("Delete article error:", error)
      next(error)
    }
  }
}
