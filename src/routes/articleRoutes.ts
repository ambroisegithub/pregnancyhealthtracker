// @ts-nocheck
import { Router } from "express"
import { body } from "express-validator"
import { ArticleController } from "../controllers/ArticleController"
import { isPatient, isAdmin } from "../middlewares/roleMiddleware"
import { authenticate } from "../middlewares/authMiddleware"
import { i18nMiddleware } from "../middlewares/i18nMiddleware"

const router = Router()

// Apply i18n middleware to all routes
router.use(i18nMiddleware)

const articleValidation = [
  body("title").notEmpty().trim().withMessage("Article title is required"),
  body("content").notEmpty().trim().withMessage("Article content is required"),
  body("week").optional().isInt({ min: 1, max: 42 }).withMessage("Week must be between 1 and 42"),
  body("target")
    .optional()
    .isIn(["Pregnant", "Delivered", "Aborted", "Stillbirth", "Infertile", "Preconception", "Menopausal", "Nulligravid"])
    .withMessage("Valid target status required"),
  body("articleImage").optional().isURL().withMessage("Valid image URL required"),
]

const updateArticleValidation = [
  body("title").optional().notEmpty().trim().withMessage("Article title cannot be empty"),
  body("content").optional().notEmpty().trim().withMessage("Article content cannot be empty"),
  body("week").optional().isInt({ min: 1, max: 42 }).withMessage("Week must be between 1 and 42"),
  body("target")
    .optional()
    .isIn(["Pregnant", "Delivered", "Aborted", "Stillbirth", "Infertile", "Preconception", "Menopausal", "Nulligravid"])
    .withMessage("Valid target status required"),
  body("articleImage").optional().isURL().withMessage("Valid image URL required"),
  body("isActive").optional().isBoolean().withMessage("isActive must be boolean"),
]

// Patient Routes
router.get("/articles/my-articles", authenticate, isPatient, ArticleController.getArticlesForUser)
router.get("/articles/daily", authenticate, isPatient, ArticleController.getDailyArticle)
router.get("/articles/weekly-articles", authenticate, isPatient, ArticleController.getWeeklyArticles)

router.get("/articles", authenticate, ArticleController.getAllArticles)
// Only match numeric IDs for this route:
router.get("/articles/:id(\\d+)", authenticate, ArticleController.getArticleById) 
// Admin Routes
router.post("/articles", authenticate, isAdmin, articleValidation, ArticleController.createArticle)
router.put("/:id(\\d+)", authenticate, isAdmin, updateArticleValidation, ArticleController.updateArticle)
router.delete("/:id(\\d+)", authenticate, isAdmin, ArticleController.deleteArticle)

export default router
