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
          tokens: result.tokens,
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
          tokens: result.tokens,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        message: error.message,
      });
    }
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    try {
      await this.authService.requestPasswordReset(email);
    } catch (error: any) {
      // Genuine failure (e.g. email transport). Surface a 500 so the client can
      // offer a retry — but never leak whether the address exists.
      console.error("forgotPassword error:", error);
      res.status(500).json({
        message: "Could not send the reset email. Please try again.",
      });
      return;
    }

    // Identical response whether or not the account exists (anti-enumeration).
    res.status(200).json({
      message: "If an account exists for that email, a reset link has been sent.",
    });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        res.status(400).json({ message: "Token and new password are required" });
        return;
      }

      await this.authService.resetPassword(String(token), String(password));
      res.status(200).json({
        message: "Your password has been reset. You can now sign in.",
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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
          tokens: result.tokens,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  googleMobileLogin = async (req: Request, res: Response): Promise<void> => {
    const frontendUrl = process.env.APP_URL || "http://localhost:3000";
    const redirectUri = req.query.redirect_uri ? String(req.query.redirect_uri) : "";
    const query = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : "";
    res.redirect(`${frontendUrl}/google-login${query}`);
  };

  githubLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, isSignUp } = req.body;
      if (!code) {
        res.status(400).json({
          message: "code is required",
        });
        return;
      }

      const result = await this.authService.githubLogin(code, Boolean(isSignUp));
      this.setAuthCookies(res, result.tokens);

      res.status(200).json({
        message: "Successfully authenticated with GitHub",
        result: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  githubMobileLogin = async (req: Request, res: Response): Promise<void> => {
    const frontendUrl = process.env.APP_URL || "http://localhost:3000";
    const redirectUri = req.query.redirect_uri ? String(req.query.redirect_uri) : "";
    const isSignUp = req.query.is_signup ? String(req.query.is_signup) : "";
    const params = new URLSearchParams();
    if (redirectUri) params.set("redirect_uri", redirectUri);
    if (isSignUp) params.set("is_signup", isSignUp);
    const query = params.toString() ? `?${params.toString()}` : "";
    res.redirect(`${frontendUrl}/github-login${query}`);
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
        result: {
          tokens,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        message: error.message,
      });
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    try {
      let token = (req as any).cookies?.access_token;
      if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      }
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
