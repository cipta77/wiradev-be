import { UserRepository } from "../repositories/user.repository";
import { AuthProviderRepository } from "../repositories/auth-provider.repository";
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
  
  private accessSecret = process.env.JWT_ACCESS_SECRET || "access_secret";
  private refreshSecret = process.env.JWT_REFRESH_SECRET || "refresh_secret";

  private generateTokens(userId: string): AuthTokens {
    const accessToken = jwt.sign({ sub: userId }, this.accessSecret, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ sub: userId }, this.refreshSecret, { expiresIn: "7d" });
    return { accessToken, refreshToken };
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

  async getProfileByToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, this.accessSecret) as { sub: string };
      return await this.userRepository.findById(payload.sub);
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
