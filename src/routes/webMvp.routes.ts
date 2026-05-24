import { Router } from "express";
import {
  getDashboardSummary,
  getMarketDemand,
  getOnboarding,
  getSkillGap,
  submitOnboarding,
  testDb,
} from "../controllers/webMvp.controller";

const router = Router();

router.get("/test-db", testDb);
router.get("/onboarding", getOnboarding);
router.post("/onboarding", submitOnboarding);
router.get("/dashboard/summary", getDashboardSummary);
router.get("/readiness/skill-gap", getSkillGap);
router.get("/readiness/market-demand", getMarketDemand);

export default router;
