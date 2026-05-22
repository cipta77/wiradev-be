import { UserRepository } from "../repositories/user.repository";
import { AuthProviderRepository } from "../repositories/auth-provider.repository";
import { User, CreateUserDTO, AuthProvider, OnboardingProfileDTO, OnboardingGoalDTO, AccountSettingsDTO, UpdatePasswordDTO } from "../types/user.types";
import bcrypt from "bcryptjs";

export class UserService {
  private userRepository = new UserRepository();
  private authProviderRepository = new AuthProviderRepository();

  async register(data: CreateUserDTO): Promise<User> {
    const existingEmail = await this.userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new Error("Email already registered");
    }

    if (data.username) {
      const existingUsername = await this.userRepository.findByUsername(data.username);
      if (existingUsername) {
        throw new Error("Username already taken");
      }
    }

    return await this.userRepository.create(data);
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async linkProvider(userId: string, provider: string, providerUserId: string): Promise<AuthProvider> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const existingLink = await this.authProviderRepository.findByProvider(provider, providerUserId);
    if (existingLink) {
      throw new Error("Auth provider already linked to another account");
    }

    return await this.authProviderRepository.create({
      user_id: userId,
      provider,
      provider_user_id: providerUserId,
    });
  }

  async updateProfile(userId: string, data: OnboardingProfileDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.updateProfile(userId, data);
    
    return this.getUserById(userId);
  }

  async updateGoal(userId: string, data: OnboardingGoalDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.updateGoal(userId, data);
    
    return this.getUserById(userId);
  }

  async updateDocuments(userId: string, cvUrl: string | null, transcriptUrl: string | null): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.updateDocuments(userId, cvUrl, transcriptUrl);
    
    return this.getUserById(userId);
  }

  async completeOnboardingStatus(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.completeOnboardingStatus(userId);
    
    return this.getUserById(userId);
  }

  async updateAccountSettings(userId: string, data: AccountSettingsDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (data.email.toLowerCase() !== user.email.toLowerCase()) {
      const existingEmail = await this.userRepository.findByEmail(data.email);
      if (existingEmail) {
        throw new Error("Email already registered by another account");
      }
    }

    await this.userRepository.updateAccountSettings(userId, data);
    
    return this.getUserById(userId);
  }

  async updatePassword(userId: string, data: UpdatePasswordDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!data.new_password || data.new_password.length < 6) {
      throw new Error("New password must be at least 6 characters long");
    }

    if (user.password_hash) {
      if (!data.current_password) {
        throw new Error("Current password is required");
      }
      const isPasswordValid = await bcrypt.compare(data.current_password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error("Incorrect current password");
      }
    }

    const newPasswordHash = await bcrypt.hash(data.new_password, 10);
    await this.userRepository.updatePasswordHash(userId, newPasswordHash);

    return this.getUserById(userId);
  }
}
