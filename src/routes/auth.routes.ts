import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();
const controller = new AuthController();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.post("/forgot-password", controller.forgotPassword);
router.post("/reset-password", controller.resetPassword);
router.post("/google", controller.googleLogin);
router.get("/google/mobile-login", controller.googleMobileLogin);
router.post("/github", controller.githubLogin);
router.get("/github/mobile-login", controller.githubMobileLogin);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", controller.me);

export default router;
