import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();
const controller = new AuthController();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.post("/google", controller.googleLogin);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", controller.me);

export default router;
