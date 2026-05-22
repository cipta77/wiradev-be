import { query } from "../db/connection";
import { User, CreateUserDTO, OnboardingProfileDTO, OnboardingGoalDTO, AccountSettingsDTO } from "../types/user.types";
import crypto from "crypto";

export class UserRepository {
  async create(data: CreateUserDTO): Promise<User> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO users (
        id, email, username, password_hash, first_name, last_name, 
        university, field_of_study, graduation_year, avatar_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await query(sql, [
      id,
      data.email,
      data.username || null,
      data.password_hash || null,
      data.first_name || null,
      data.last_name || null,
      data.university || null,
      data.field_of_study || null,
      data.graduation_year || null,
      data.avatar_url || null,
    ]);

    const createdUser = await this.findById(id);
    if (!createdUser) {
      throw new Error("Failed to retrieve created user");
    }
    return createdUser;
  }

  async findById(id: string): Promise<User | null> {
    const sql = "SELECT * FROM users WHERE id = ?";
    const users = await query<any[]>(sql, [id]);
    if (users.length === 0) {
      return null;
    }
    
    const user = users[0];
    return {
      ...user,
      onboarding_completed: Boolean(user.onboarding_completed),
      is_email_verified: Boolean(user.is_email_verified),
    } as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = "SELECT * FROM users WHERE email = ?";
    const users = await query<any[]>(sql, [email]);
    if (users.length === 0) {
      return null;
    }
    
    const user = users[0];
    return {
      ...user,
      onboarding_completed: Boolean(user.onboarding_completed),
      is_email_verified: Boolean(user.is_email_verified),
    } as User;
  }

  async findByUsername(username: string): Promise<User | null> {
    const sql = "SELECT * FROM users WHERE username = ?";
    const users = await query<any[]>(sql, [username]);
    if (users.length === 0) {
      return null;
    }
    
    const user = users[0];
    return {
      ...user,
      onboarding_completed: Boolean(user.onboarding_completed),
      is_email_verified: Boolean(user.is_email_verified),
    } as User;
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    const sql = "SELECT * FROM users WHERE email = ? OR username = ?";
    const users = await query<any[]>(sql, [identifier, identifier]);
    if (users.length === 0) {
      return null;
    }
    
    const user = users[0];
    return {
      ...user,
      onboarding_completed: Boolean(user.onboarding_completed),
      is_email_verified: Boolean(user.is_email_verified),
    } as User;
  }

  async updateProfile(id: string, data: OnboardingProfileDTO): Promise<void> {
    const sql = `
      UPDATE users 
      SET first_name = ?, last_name = ?, university = ?, field_of_study = ?, graduation_year = ?
      WHERE id = ?
    `;
    await query(sql, [
      data.first_name,
      data.last_name,
      data.university,
      data.field_of_study,
      data.graduation_year,
      id,
    ]);
  }

  async updateGoal(id: string, data: OnboardingGoalDTO): Promise<void> {
    const sql = "UPDATE users SET achievement_goal = ? WHERE id = ?";
    await query(sql, [data.achievement_goal, id]);
  }

  async updateDocuments(id: string, cvUrl: string | null, transcriptUrl: string | null): Promise<void> {
    const sql = "UPDATE users SET cv_url = ?, transcript_url = ? WHERE id = ?";
    await query(sql, [cvUrl, transcriptUrl, id]);
  }

  async completeOnboardingStatus(id: string): Promise<void> {
    const sql = "UPDATE users SET onboarding_completed = true WHERE id = ?";
    await query(sql, [id]);
  }

  async updateAccountSettings(id: string, data: AccountSettingsDTO): Promise<void> {
    const sql = `
      UPDATE users 
      SET first_name = ?, last_name = ?, email = ?, university = ?
      WHERE id = ?
    `;
    await query(sql, [
      data.first_name,
      data.last_name,
      data.email,
      data.university,
      id,
    ]);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const sql = "UPDATE users SET password_hash = ? WHERE id = ?";
    await query(sql, [passwordHash, id]);
  }
}
