import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = (req as any).cookies?.access_token;
    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const user = await authService.getProfileByToken(token);
    if (!user) {
      res.status(401).json({ message: "Invalid or expired access token" });
      return;
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};
