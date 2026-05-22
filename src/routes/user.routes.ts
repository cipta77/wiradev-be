import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const controller = new UserController();

router.get("/:id", controller.getProfile);
router.post("/:id/providers", controller.linkProvider);
router.patch("/:id/onboarding/profile", controller.updateProfile);
router.patch("/:id/onboarding/goal", controller.updateGoal);
router.patch("/:id/onboarding/documents", upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'transcript', maxCount: 1 }]), controller.updateDocuments);
router.post("/:id/onboarding/complete", controller.completeOnboarding);
router.patch("/:id/profile", controller.updateAccountSettings);
router.put("/:id/password", controller.updatePassword);

export default router;
