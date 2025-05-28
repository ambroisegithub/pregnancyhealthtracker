import { Router } from "express"
import { PatientController } from "../controllers/PatientController"
import { authenticate } from "../middlewares/authMiddleware"
import { i18nMiddleware } from "../middlewares/i18nMiddleware"

const router = Router()

// Apply middleware to all routes
router.use(i18nMiddleware)
router.use(authenticate)

// Routes
router.get("/", PatientController.getPatients)
router.get("/stats", PatientController.getPatientStats)
router.get("/:patientId", PatientController.getPatientById)
router.put("/:patientId", PatientController.updatePatient)

export default router
