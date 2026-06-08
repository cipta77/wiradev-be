import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = req.cookies?.access_token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const user = await authService.getProfileByToken(token);
    if (!user) {
      res.status(401).json({ message: "Invalid or expired access token" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    const err = error as Error;
    res.status(401).json({ message: err.message });
  }
};
