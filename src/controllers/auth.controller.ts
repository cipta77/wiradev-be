import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

export class AuthController {
  private authService = new AuthService();

  private setAuthCookies = (res: Response, tokens: { accessToken: string; refreshToken: string }): void => {
    const isProduction = process.env.NODE_ENV === "production";
    
    res.cookie("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refresh_token", tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  };

  private clearAuthCookies = (res: Response): void => {
    const isProduction = process.env.NODE_ENV === "production";
    
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    });

    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    });
  };

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({
          message: "Email and password are required",
        });
        return;
      }

      const result = await this.authService.register({ email, password });
      this.setAuthCookies(res, result.tokens);

      res.status(201).json({
        message: "Successfully registered and logged in",
        result: {
          user: result.user,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        res.status(400).json({
          message: "Identifier (email or username) and password are required",
        });
        return;
      }

      const result = await this.authService.login(identifier, password);
      this.setAuthCookies(res, result.tokens);

      res.status(200).json({
        message: "Successfully logged in",
        result: {
          user: result.user,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        message: error.message,
      });
    }
  };

  googleLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const { idToken, isSignUp } = req.body;
      if (!idToken) {
        res.status(400).json({
          message: "idToken is required",
        });
        return;
      }

      const result = await this.authService.googleLogin(idToken, Boolean(isSignUp));
      this.setAuthCookies(res, result.tokens);

      res.status(200).json({
        message: "Successfully authenticated with Google",
        result: {
          user: result.user,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    try {
      // Read from custom parsed cookies first, fallback to req.body
      const refreshToken = (req as any).cookies?.refresh_token || req.body?.refreshToken;
      if (!refreshToken) {
        res.status(400).json({
          message: "Refresh token is required",
        });
        return;
      }

      const tokens = await this.authService.refresh(refreshToken);
      this.setAuthCookies(res, tokens);

      res.status(200).json({
        message: "Tokens refreshed successfully",
      });
    } catch (error: any) {
      res.status(401).json({
        message: error.message,
      });
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = (req as any).cookies?.access_token;
      if (!token) {
        res.status(401).json({
          message: "Unauthorized",
        });
        return;
      }

      const user = await this.authService.getProfileByToken(token);
      if (!user) {
        res.status(401).json({
          message: "Invalid or expired access token",
        });
        return;
      }

      const { password_hash, ...safeUser } = user;
      res.status(200).json({
        message: "Profile retrieved successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(401).json({
        message: error.message || "Unauthorized",
      });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      this.clearAuthCookies(res);
      res.status(200).json({
        message: "Successfully logged out",
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to log out",
      });
    }
  };
}
