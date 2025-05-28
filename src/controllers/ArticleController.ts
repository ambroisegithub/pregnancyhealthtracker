import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types';
import dbConnection from '../database';
import { Article } from '../database/models/Article';
import { PregnancyForm } from '../database/models/PregnancyForm';

export class ArticleController {
  static async getArticlesForUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const articleRepository = dbConnection.getRepository(Article);
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm);

      // Get user's latest pregnancy status
      const pregnancyForm = await pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: 'DESC' }
      });

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: 'Please submit pregnancy form first to get personalized articles'
        });
        return;
      }

      let articles: Article[] = [];

      if (pregnancyForm.pregnancyStatus === 'Pregnant' && pregnancyForm.gestationalWeeks !== null) {
        // Get trimester-based articles for pregnant users
        articles = await articleRepository.find({
          where: { 
            week: pregnancyForm.gestationalWeeks,
            isActive: true
          },
          order: { createdAt: 'DESC' }
        });

        // If no articles for exact week, get general trimester articles
        if (articles.length === 0) {
          const trimesterStart = pregnancyForm.currentTrimester === 1 ? 1 : 
                               pregnancyForm.currentTrimester === 2 ? 13 : 29;
          const trimesterEnd = pregnancyForm.currentTrimester === 1 ? 12 : 
                              pregnancyForm.currentTrimester === 2 ? 28 : 40;

          articles = await articleRepository.createQueryBuilder('article')
            .where('article.week BETWEEN :start AND :end', { 
              start: trimesterStart, 
              end: trimesterEnd 
            })
            .andWhere('article.isActive = :isActive', { isActive: true })
            .orderBy('article.createdAt', 'DESC')
            .limit(10)
            .getMany();
        }
      } else {
        // Get articles based on pregnancy status (non-pregnant users)
        articles = await articleRepository.find({
          where: { 
            target: pregnancyForm.pregnancyStatus,
            isActive: true
          },
          order: { createdAt: 'DESC' },
          take: 10
        });
      }

      res.json({
        success: true,
        data: {
          articles,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays,
            expectedDeliveryDate: pregnancyForm.expectedDeliveryDate
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDailyArticle(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const articleRepository = dbConnection.getRepository(Article);
      const pregnancyRepository = dbConnection.getRepository(PregnancyForm);

      // Get user's current pregnancy status
      const pregnancyForm = await pregnancyRepository.findOne({
        where: { user: { id: req.user.id } },
        order: { createdAt: 'DESC' }
      });

      if (!pregnancyForm) {
        res.status(404).json({
          success: false,
          message: 'Please submit pregnancy form first'
        });
        return;
      }

      let dailyArticle: Article | null = null;

      if (pregnancyForm.pregnancyStatus === 'Pregnant' && pregnancyForm.gestationalWeeks !== null) {
        // Get today's article based on gestational week
        dailyArticle = await articleRepository.findOne({
          where: { 
            week: pregnancyForm.gestationalWeeks,
            isActive: true
          },
          order: { createdAt: 'DESC' }
        });

        // Fallback to trimester-based article
        if (!dailyArticle) {
          const trimesterArticles = await articleRepository.find({
            where: { 
              week: pregnancyForm.currentTrimester,
              isActive: true
            },
            order: { createdAt: 'DESC' },
            take: 1
          });
          dailyArticle = trimesterArticles[0] || null;
        }
      } else {
        // Get article for non-pregnant status
        dailyArticle = await articleRepository.findOne({
          where: { 
            target: pregnancyForm.pregnancyStatus,
            isActive: true
          },
          order: { createdAt: 'DESC' }
        });
      }

      if (!dailyArticle) {
        res.status(404).json({
          success: false,
          message: 'No article available for your current status'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          article: dailyArticle,
          pregnancyInfo: {
            status: pregnancyForm.pregnancyStatus,
            trimester: pregnancyForm.currentTrimester,
            gestationalWeeks: pregnancyForm.gestationalWeeks,
            gestationalDays: pregnancyForm.gestationalDays
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin functions
  static async createArticle(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
        return;
      }

      const { week, target, title, content, articleImage } = req.body;

      const articleRepository = dbConnection.getRepository(Article);
      
      const article = articleRepository.create({
        week: week || null,
        target: target || null,
        title,
        content,
        articleImage: articleImage || null,
        isActive: true
      });

      await articleRepository.save(article);

      res.status(201).json({
        success: true,
        message: 'Article created successfully',
        data: article
      });
    } catch (error) {
      next(error);
    }
  }
}