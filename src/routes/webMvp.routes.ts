import { Router } from "express";
import {
  getDashboardSummary,
  getMarketDemand,
  getOnboarding,
  getSkillGap,
  submitOnboarding,
  testDb,
} from "../controllers/webMvp.controller";
import {
  getAssessmentCategories,
  getAssessmentQuestions,
  startAssessment,
  submitAssessment,
  getAssessmentResult,
  getLatestAssessment,
  getAssessmentAnalytics,
} from "../controllers/assessment.controller";
import { CvScreeningController } from "../controllers/cv-screening.controller";
import { SimulationController } from "../controllers/simulation.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";
import { JobdeskAnalyzerController } from "../controllers/jobdesk-analyzer.controller";

const router = Router();
const cvScreeningController = new CvScreeningController();
const simulationController = new SimulationController();
const jobdeskAnalyzerController = new JobdeskAnalyzerController();

router.get("/test-db", testDb);
router.get("/onboarding", getOnboarding);
router.post("/onboarding", submitOnboarding);
router.get("/dashboard/summary", requireAuth, getDashboardSummary);
router.get("/readiness/skill-gap", requireAuth, getSkillGap);
router.get("/readiness/market-demand", requireAuth, getMarketDemand);

// Assessment routes
router.get("/assessment/categories", requireAuth, getAssessmentCategories);
router.get("/assessment/questions", requireAuth, getAssessmentQuestions);
router.post("/assessment/start", requireAuth, startAssessment);
router.post("/assessment/submit", requireAuth, submitAssessment);
router.get("/assessment/result/:id", requireAuth, getAssessmentResult);
router.get("/assessment/latest", requireAuth, getLatestAssessment);
router.get("/assessment/analytics", requireAuth, getAssessmentAnalytics);

// CV Screening routes
router.post(
  "/cv-screening/upload",
  requireAuth,
  upload.single("cv"),
  cvScreeningController.upload,
);
router.get(
  "/cv-screening/history",
  requireAuth,
  cvScreeningController.getHistory,
);
router.get("/cv-screening/:id", requireAuth, cvScreeningController.getById);
router.delete(
  "/cv-screening/:id",
  requireAuth,
  cvScreeningController.deleteById,
);

// Career Simulation routes
router.post(
  "/simulations/start",
  requireAuth,
  simulationController.startSimulation,
);
router.post(
  "/simulations/:id/message",
  requireAuth,
  simulationController.submitMessage,
);
router.get("/simulations/:id", requireAuth, simulationController.getDetails);

// Jobdesk Analyzer routes
router.post(
  "/jobdesk/analyze",
  requireAuth,
  jobdeskAnalyzerController.analyze,
);

export default router;
