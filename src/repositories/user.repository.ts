import { query } from "../db/connection";
import { User, CreateUserDTO, OnboardingProfileDTO, OnboardingGoalDTO, AccountSettingsDTO, OnboardingRoleDTO } from "../types/user.types";
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

  async updateRole(id: string, data: OnboardingRoleDTO): Promise<void> {
    const sql = "UPDATE users SET target_role = ? WHERE id = ?";
    await query(sql, [data.target_role, id]);
  }

  async updateDocuments(id: string, cvUrl: string | null, transcriptUrl: string | null): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (cvUrl !== null) {
      updates.push("cv_url = ?");
      params.push(cvUrl);
    }
    if (transcriptUrl !== null) {
      updates.push("transcript_url = ?");
      params.push(transcriptUrl);
    }

    if (updates.length === 0) {
      return;
    }

    params.push(id);
    const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    await query(sql, params);
  }

  async completeOnboardingStatus(id: string): Promise<void> {
    const sql = "UPDATE users SET onboarding_completed = true WHERE id = ?";
    await query(sql, [id]);
  }

  async updateAccountSettings(id: string, data: AccountSettingsDTO): Promise<void> {
    const sql = `
      UPDATE users
      SET first_name = ?, last_name = ?, email = ?, university = ?, field_of_study = COALESCE(?, field_of_study)
      WHERE id = ?
    `;
    await query(sql, [
      data.first_name,
      data.last_name,
      data.email,
      data.university,
      data.field_of_study ?? null,
      id,
    ]);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const sql = "UPDATE users SET password_hash = ? WHERE id = ?";
    await query(sql, [passwordHash, id]);
  }

  async updateUsername(id: string, username: string): Promise<void> {
    const sql = "UPDATE users SET username = ? WHERE id = ?";
    await query(sql, [username, id]);
  }

  async updateGithubIntegration(
    id: string,
    githubUsername: string,
    githubLanguages: any,
    githubReadinessScore: number,
    overallReadinessScore: number
  ): Promise<void> {
    const sql = `
      UPDATE users 
      SET github_username = ?, github_languages = ?, github_readiness_score = ?, readiness_score = ?, github_last_synced_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await query(sql, [
      githubUsername,
      githubLanguages ? JSON.stringify(githubLanguages) : null,
      githubReadinessScore,
      overallReadinessScore,
      id,
    ]);
  }

  /**
   * Recompute and persist the user's overall readiness score as a weighted
   * blend of every available signal: the latest skill assessment, the work the
   * user has shipped in the Development Hub (reviewed mini-project scores), the
   * latest CV analysis (CV screening), and the GitHub readiness score. Weights
   * are renormalized over whichever signals are present, so a user with only a
   * CV analysis still gets a meaningful score. Returns the composite score.
   */
  async recomputeReadinessScore(id: string): Promise<number> {
    const assessmentRows = await query<any[]>(
      `SELECT score_percentage FROM user_assessments
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [id],
    );
    // Development Hub: average AI-reviewed score across the user's reviewed
    // mini-project submissions — reflects what they have actually built.
    const projectRows = await query<any[]>(
      `SELECT AVG(overall_score) AS avg_score
       FROM user_mini_project_submissions
       WHERE user_id = ? AND status = 'reviewed' AND overall_score IS NOT NULL`,
      [id],
    );
    const cvRows = await query<any[]>(
      `SELECT overall_score FROM cv_screenings
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    const transcriptRows = await query<any[]>(
      `SELECT overall_score FROM transcript_screenings
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    const userRows = await query<any[]>(
      `SELECT github_readiness_score FROM users WHERE id = ? LIMIT 1`,
      [id],
    );

    const signals: { value: number; weight: number }[] = [];
    if (assessmentRows.length > 0 && assessmentRows[0].score_percentage !== null) {
      signals.push({ value: Number(assessmentRows[0].score_percentage), weight: 0.40 });
    }
    if (projectRows.length > 0 && projectRows[0].avg_score !== null) {
      signals.push({ value: Number(projectRows[0].avg_score), weight: 0.20 });
    }
    if (cvRows.length > 0 && cvRows[0].overall_score !== null) {
      signals.push({ value: Number(cvRows[0].overall_score), weight: 0.15 });
    }
    if (transcriptRows.length > 0 && transcriptRows[0].overall_score !== null) {
      signals.push({ value: Number(transcriptRows[0].overall_score), weight: 0.15 });
    }
    if (userRows.length > 0 && userRows[0].github_readiness_score !== null) {
      signals.push({ value: Number(userRows[0].github_readiness_score), weight: 0.10 });
    }

    if (signals.length === 0) return 0;

    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const composite = Math.round(
      signals.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight,
    );

    await query(`UPDATE users SET readiness_score = ? WHERE id = ?`, [composite, id]);
    return composite;
  }
}
