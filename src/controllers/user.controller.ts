import { Request, Response } from "express";
import { UserService } from "../services/user.service";

export class UserController {
  private userService = new UserService();

  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const user = await this.userService.getUserById(id);

      const { password_hash, ...safeUser } = user as any;
      res.status(200).json({
        message: "Profile retrieved successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(404).json({
        message: error.message,
      });
    }
  };

  linkProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { provider, provider_user_id } = req.body;

      if (!provider || !provider_user_id) {
        res.status(400).json({
          message: "Provider and provider_user_id are required",
        });
        return;
      }

      const link = await this.userService.linkProvider(
        id,
        provider,
        provider_user_id,
      );
      res.status(201).json({
        message: "Auth provider linked successfully",
        result: link,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { first_name, last_name, university, field_of_study, graduation_year } = req.body;

      if (!first_name || !last_name || !university || !field_of_study || !graduation_year) {
        res.status(400).json({
          message: "First name, last name, university, field of study, and graduation year are required",
        });
        return;
      }

      const user = await this.userService.updateProfile(id, {
        first_name,
        last_name,
        university,
        field_of_study,
        graduation_year: parseInt(graduation_year),
      });

      const { password_hash, ...safeUser } = user as any;
      res.status(200).json({
        message: "Profile updated successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updateGoal = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { achievement_goal } = req.body;

      if (!achievement_goal) {
        res.status(400).json({
          message: "Achievement goal is required",
        });
        return;
      }

      const user = await this.userService.updateGoal(id, { achievement_goal });
      const { password_hash, ...safeUser } = user as any;
      
      res.status(200).json({
        message: "Goal updated successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updateRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { target_role } = req.body;

      if (!target_role) {
        res.status(400).json({
          message: "Target role is required",
        });
        return;
      }

      const user = await this.userService.updateRole(id, { target_role });
      const { password_hash, ...safeUser } = user as any;
      
      res.status(200).json({
        message: "Role updated successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updateDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      const appUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
      
      let cvUrl = null;
      let transcriptUrl = null;

      if (files && files['cv'] && files['cv'][0]) {
        cvUrl = `${appUrl}/uploads/${files['cv'][0].filename}`;
      }
      
      if (files && files['transcript'] && files['transcript'][0]) {
        transcriptUrl = `${appUrl}/uploads/${files['transcript'][0].filename}`;
      }

      const user = await this.userService.updateDocuments(id, cvUrl, transcriptUrl);
      const { password_hash, ...safeUser } = user as any;
      
      res.status(200).json({
        message: "Documents uploaded successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updateCV = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const file = req.file as Express.Multer.File;

      if (!file) {
        res.status(400).json({
          message: "CV file is required",
        });
        return;
      }

      const appUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
      const cvUrl = `${appUrl}/uploads/${file.filename}`;

      const user = await this.userService.updateDocuments(id, cvUrl, null);
      const { password_hash, ...safeUser } = user as any;

      res.status(200).json({
        message: "CV uploaded successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updateTranscript = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const file = req.file as Express.Multer.File;

      if (!file) {
        res.status(400).json({
          message: "Transcript file is required",
        });
        return;
      }

      const appUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
      const transcriptUrl = `${appUrl}/uploads/${file.filename}`;

      const user = await this.userService.updateDocuments(id, null, transcriptUrl);
      const { password_hash, ...safeUser } = user as any;

      res.status(200).json({
        message: "Transcript uploaded successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  completeOnboarding = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { githubId, githubUsername } = req.body;

      if (githubId) {
        try {
          await this.userService.linkProvider(id, "github", githubId);
        } catch (linkError: any) {
          console.warn(`[completeOnboarding] Warning linking provider: ${linkError.message}`);
        }
      }

      if (githubUsername) {
        try {
          await this.userService.updateUsername(id, githubUsername);
          // Auto sync GitHub repositories during onboarding completion
          await this.userService.syncGitHub(id, githubUsername);
        } catch (usernameError: any) {
          console.warn(`[completeOnboarding] Warning updating/syncing GitHub username: ${usernameError.message}`);
        }
      }

      const user = await this.userService.completeOnboardingStatus(id);
      const { password_hash, ...safeUser } = user as any;
      
      res.status(200).json({
        message: "Onboarding completed successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updateAccountSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { first_name, last_name, email, university, field_of_study } = req.body;

      if (!first_name || !last_name || !email || !university) {
        res.status(400).json({
          message: "First name, last name, email, and university are required",
        });
        return;
      }

      const user = await this.userService.updateAccountSettings(id, {
        first_name,
        last_name,
        email,
        university,
        field_of_study,
      });

      const { password_hash, ...safeUser } = user as any;
      res.status(200).json({
        message: "Account settings updated successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  updatePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { current_password, new_password } = req.body;

      const user = await this.userService.updatePassword(id, {
        current_password,
        new_password,
      });

      const { password_hash, ...safeUser } = user as any;
      res.status(200).json({
        message: "Password updated successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  linkGitHub = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { code } = req.body;

      if (!code) {
        res.status(400).json({ message: "Code parameter is required" });
        return;
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        res.status(500).json({ message: "GitHub OAuth is not configured on the server." });
        return;
      }

      // 1. Exchange code for access token
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData = await tokenResponse.json() as any;

      if (tokenData.error) {
        res.status(400).json({ message: `GitHub OAuth error: ${tokenData.error_description || tokenData.error}` });
        return;
      }

      const accessToken = tokenData.access_token;
      if (!accessToken) {
        res.status(400).json({ message: "Failed to retrieve access token from GitHub." });
        return;
      }

      // 2. Fetch user profile from GitHub API
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "User-Agent": "Wirapath-OAuth-Integration",
        },
      });

      if (!userResponse.ok) {
        res.status(userResponse.status).json({ message: `Failed to fetch user profile from GitHub. Status: ${userResponse.status}` });
        return;
      }

      const githubProfile = await userResponse.json() as any;
      const githubId = String(githubProfile.id);
      const githubUsername = githubProfile.login;

      // 3. Link the provider using the UserService
      try {
        await this.userService.linkProvider(id, "github", githubId);
      } catch (linkError: any) {
        console.warn(`[linkGitHub] Link warning for user ${id}: ${linkError.message}`);
      }

       // 4. Update the user's username
      try {
        await this.userService.updateUsername(id, githubUsername);
      } catch (usernameError: any) {
        console.warn(`[linkGitHub] Warning updating username: ${usernameError.message}`);
      }

      // 5. Initial GitHub repositories sync
      let syncedUser = null;
      try {
        syncedUser = await this.userService.syncGitHub(id, githubUsername);
      } catch (syncError: any) {
        console.warn(`[linkGitHub] Warning performing initial sync: ${syncError.message}`);
      }

      const safeUser = syncedUser ? (() => {
        const { password_hash, ...safe } = syncedUser as any;
        return safe;
      })() : { githubId, username: githubUsername };

      res.status(200).json({
        message: "GitHub account linked and synchronized successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };

  syncGitHub = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { githubUsername } = req.body;

      const user = await this.userService.syncGitHub(id, githubUsername);
      const { password_hash, ...safeUser } = user as any;

      res.status(200).json({
        message: "GitHub data synced and readiness analyzed successfully",
        result: safeUser,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
      });
    }
  };
}
