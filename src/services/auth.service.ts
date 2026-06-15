import { UserRepository } from "../repositories/user.repository";
import { AuthProviderRepository } from "../repositories/auth-provider.repository";
import { UserService } from "./user.service";
import { EmailService } from "./email.service";
import { User } from "../types/user.types";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: Omit<User, "password_hash">;
}

export class AuthService {
  private userRepository = new UserRepository();
  private authProviderRepository = new AuthProviderRepository();
  private userService = new UserService();
  private emailService = new EmailService();

  private accessSecret = process.env.JWT_ACCESS_SECRET || "access_secret";
  private refreshSecret = process.env.JWT_REFRESH_SECRET || "refresh_secret";
  private resetSecret = process.env.JWT_RESET_SECRET || "reset_secret";

  /** Link lifetime in minutes. Kept in sync with the email template copy. */
  private static readonly RESET_TOKEN_TTL_MINUTES = 30;

  private generateTokens(userId: string): AuthTokens {
    const accessToken = jwt.sign({ sub: userId }, this.accessSecret, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ sub: userId }, this.refreshSecret, { expiresIn: "7d" });
    return { accessToken, refreshToken };
  }

  /**
   * Per-user signing secret for reset tokens. By folding the current password
   * hash into the secret, a reset token is implicitly single-use: once the
   * password changes the hash changes, so any previously issued token (or a
   * reused one) no longer verifies.
   */
  private resetSigningSecret(passwordHash: string): string {
    return `${this.resetSecret}.${passwordHash}`;
  }

  /**
   * Request a password reset. Looks up the account and, if it exists and has a
   * password set, emails a time-limited reset link. Always resolves without
   * revealing whether the address is registered (anti-enumeration); only
   * unexpected failures (e.g. email transport) propagate.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email.trim());

    // Silently no-op for unknown accounts and OAuth-only accounts (no password
    // to reset), so the caller can return an identical response in all cases.
    if (!user || !user.password_hash) {
      return;
    }

    const ttl = AuthService.RESET_TOKEN_TTL_MINUTES;
    const token = jwt.sign(
      { sub: user.id, purpose: "password_reset" },
      this.resetSigningSecret(user.password_hash),
      { expiresIn: `${ttl}m` }
    );

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await this.emailService.sendPasswordResetEmail(user.email, {
      userName: user.first_name || "there",
      resetUrl,
      expiryMinutes: ttl,
    });
  }

  /**
   * Complete a password reset: verify the token against the user's current
   * password hash and, if valid, store the new password. Throws on an invalid,
   * expired or already-used token.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    // Read the subject without verifying so we can fetch the user's current
    // hash (which is part of the signing secret).
    const decoded = jwt.decode(token) as { sub?: string } | null;
    const userId = decoded?.sub;
    if (!userId) {
      throw new Error("Invalid or expired reset link.");
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.password_hash) {
      throw new Error("Invalid or expired reset link.");
    }

    try {
      jwt.verify(token, this.resetSigningSecret(user.password_hash), {
        ignoreExpiration: false,
      });
    } catch {
      throw new Error("Invalid or expired reset link.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePasswordHash(user.id, passwordHash);
  }

  async register(data: { email: string; password?: string }): Promise<AuthResponse> {
    if (!data.password) {
      throw new Error("Password is required");
    }

    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error("Email already registered");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.userRepository.create({
      email: data.email,
      password_hash: passwordHash,
    });

    const tokens = this.generateTokens(user.id);
    const { password_hash, ...safeUser } = user;

    return { tokens, user: safeUser };
  }

  async login(identifier: string, password?: string): Promise<AuthResponse> {
    if (!password) {
      throw new Error("Password is required");
    }

    const user = await this.userRepository.findByEmailOrUsername(identifier);
    if (!user || !user.password_hash) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    const tokens = this.generateTokens(user.id);
    const { password_hash, ...safeUser } = user;

    return { tokens, user: safeUser };
  }

  async googleLogin(idToken: string, isSignUp: boolean = false): Promise<AuthResponse> {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!response.ok) {
      throw new Error("Invalid Google token");
    }

    const payload = await response.json() as {
      sub: string;
      email: string;
      email_verified?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      aud: string;
    };

    if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new Error("Invalid Google client ID audience");
    }

    const googleId = payload.sub;
    const email = payload.email;
    const firstName = payload.given_name;
    const lastName = payload.family_name;
    const avatarUrl = payload.picture;

    let linkedProvider = await this.authProviderRepository.findByProvider("google", googleId);
    let user: User | null = null;

    if (linkedProvider) {
      user = await this.userRepository.findById(linkedProvider.user_id);
    } else {
      user = await this.userRepository.findByEmail(email);

      if (!user) {
        if (!isSignUp) {
          throw new Error("Account not found. Please register first.");
        }
        user = await this.userRepository.create({
          email,
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatarUrl,
        });
      }

      await this.authProviderRepository.create({
        user_id: user.id,
        provider: "google",
        provider_user_id: googleId,
      });
    }

    if (!user) {
      throw new Error("Authentication failed");
    }

    const tokens = this.generateTokens(user.id);
    const { password_hash, ...safeUser } = user;

    return { tokens, user: safeUser };
  }

  async githubLogin(code: string, isSignUp: boolean = false): Promise<AuthResponse> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("GitHub OAuth is not configured on the server.");
    }

    // 1. Exchange the authorization code for an access token
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

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error("Failed to retrieve access token from GitHub.");
    }

    const ghHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Wirapath-OAuth-Integration",
    };

    // 2. Fetch the GitHub user profile
    const profileResponse = await fetch("https://api.github.com/user", { headers: ghHeaders });
    if (!profileResponse.ok) {
      throw new Error(`Failed to fetch user profile from GitHub. Status: ${profileResponse.status}`);
    }

    const profile = await profileResponse.json() as {
      id: number;
      login: string;
      name?: string | null;
      email?: string | null;
      avatar_url?: string | null;
    };

    const githubId = String(profile.id);
    const githubUsername = profile.login;
    const avatarUrl = profile.avatar_url || undefined;

    // GitHub may not expose the email on the profile (when set to private),
    // so resolve the primary verified email via the dedicated endpoint.
    let email = profile.email || undefined;
    if (!email) {
      try {
        const emailResponse = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
        if (emailResponse.ok) {
          const emails = await emailResponse.json() as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primary = emails.find((e) => e.primary && e.verified)
            || emails.find((e) => e.verified)
            || emails[0];
          email = primary?.email;
        }
      } catch {
        // ignore — handled by the guard below
      }
    }

    // Derive first/last name from the GitHub display name (single field).
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (profile.name) {
      const parts = profile.name.trim().split(/\s+/);
      firstName = parts.shift();
      lastName = parts.length > 0 ? parts.join(" ") : undefined;
    }

    // 3. Resolve the account: linked provider -> email -> create (sign-up only)
    let linkedProvider = await this.authProviderRepository.findByProvider("github", githubId);
    let user: User | null = null;

    if (linkedProvider) {
      user = await this.userRepository.findById(linkedProvider.user_id);
    } else {
      if (email) {
        user = await this.userRepository.findByEmail(email);
      }

      if (!user) {
        if (!isSignUp) {
          throw new Error("Account not found. Please register first.");
        }
        if (!email) {
          throw new Error("Could not retrieve a verified email from GitHub. Please make your email public or add a verified email on GitHub.");
        }
        user = await this.userRepository.create({
          email,
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatarUrl,
        });
      }

      await this.authProviderRepository.create({
        user_id: user.id,
        provider: "github",
        provider_user_id: githubId,
      });
    }

    if (!user) {
      throw new Error("Authentication failed");
    }

    const tokens = this.generateTokens(user.id);
    const { password_hash, ...safeUser } = user;

    return { tokens, user: safeUser };
  }

  async getProfileByToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, this.accessSecret) as { sub: string };
      // Use userService.getUserById
      return await this.userService.getUserById(payload.sub);
    } catch {
      return null;
    }
  }

  async refresh(token: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(token, this.refreshSecret) as { sub: string };
      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new Error("User not found");
      }
      return this.generateTokens(user.id);
    } catch {
      throw new Error("Invalid refresh token");
    }
  }
}
