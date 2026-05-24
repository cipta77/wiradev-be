import { Router } from "express";
import {
  getDashboardSummary,
  getMarketDemand,
  getOnboarding,
  getSkillGap,
  submitOnboarding,
  testDb,
} from "../controllers/webMvp.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/test-db", testDb);
router.get("/onboarding", getOnboarding);
router.post("/onboarding", submitOnboarding);
router.get("/dashboard/summary", requireAuth, getDashboardSummary);
router.get("/readiness/skill-gap", requireAuth, getSkillGap);
router.get("/readiness/market-demand", requireAuth, getMarketDemand);

export default router;
