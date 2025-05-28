// @ts-nocheck
import { Router } from "express"
import { body } from "express-validator"
import { MilestoneController } from "../controllers/MilestoneController"
import { isPatient } from "../middlewares/roleMiddleware"
import { authenticate } from "../middlewares/authMiddleware"
import { i18nMiddleware } from "../middlewares/i18nMiddleware"

const router = Router()

// Apply i18n middleware to all routes
router.use(i18nMiddleware)

const updateMilestoneValidation = [
  body("completed").optional().isBoolean().withMessage("Completed must be boolean"),
  body("notes").optional().isString().withMessage("Notes must be string"),
  body("scheduledDate").optional().isISO8601().withMessage("Valid scheduled date required"),
]

// Routes
router.get("/", authenticate, isPatient, MilestoneController.getMilestones)
router.get("/:id", authenticate, isPatient, MilestoneController.getMilestoneById)
router.put("/:id", authenticate, isPatient, updateMilestoneValidation, MilestoneController.updateMilestone)

export default router
