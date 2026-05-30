import { query } from "../db/connection";
import { ResultSetHeader, RowDataPacket } from "mysql2";

type GoalRow = RowDataPacket & {
  id: number;
  name: string;
};

type UserAccountRow = RowDataPacket & {
  id: number;
  email: string;
  name: string | null;
};

export class WebMvpRepository {
  async getTotalUsers(): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>("SELECT COUNT(*) AS totalUsers FROM user_accounts");
  }

  async getLatestOnboardingUser(): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT
        ua.id,
        ua.email,
        ua.name,
        p.first_name,
        p.last_name,
        p.university,
        p.field_of_study,
        p.graduation_year
       FROM user_accounts ua
       LEFT JOIN profiles p ON p.user_id = ua.id
       ORDER BY ua.id DESC
       LIMIT 1`
    );
  }

  async getUserGoals(userId: number): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT g.id, g.name
       FROM user_goals ug
       JOIN goals g ON g.id = ug.goal_id
       WHERE ug.user_id = ?
       ORDER BY g.id ASC`,
      [userId]
    );
  }

  async getUserDocuments(userId: number): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT document_type, file_name, file_url
       FROM user_documents
       WHERE user_id = ?`,
      [userId]
    );
  }

  async getOrCreateUserAccount(email: string, name: string): Promise<number> {
    const existing = await query<UserAccountRow[]>(
      "SELECT id, email, name FROM user_accounts WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length > 0) {
      await query<ResultSetHeader>("UPDATE user_accounts SET name = ? WHERE id = ?", [name, existing[0].id]);
      return existing[0].id;
    }

    const result = await query<ResultSetHeader>("INSERT INTO user_accounts (email, name) VALUES (?, ?)", [email, name]);
    return result.insertId;
  }

  async upsertProfile(payload: {
    userId: number;
    firstName: string;
    lastName: string;
    university: string;
    fieldOfStudy: string;
    graduationYearRaw: string;
  }): Promise<void> {
    await query<ResultSetHeader>(
      `INSERT INTO profiles (user_id, first_name, last_name, university, field_of_study, graduation_year)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        university = VALUES(university),
        field_of_study = VALUES(field_of_study),
        graduation_year = VALUES(graduation_year),
        updated_at = CURRENT_TIMESTAMP`,
      [
        payload.userId,
        payload.firstName,
        payload.lastName,
        payload.university,
        payload.fieldOfStudy,
        payload.graduationYearRaw,
      ]
    );
  }

  async replaceUserGoals(userId: number, goals: string[]): Promise<void> {
    await query<ResultSetHeader>("DELETE FROM user_goals WHERE user_id = ?", [userId]);

    if (goals.length === 0) return;

    const goalRows = await query<GoalRow[]>(
      `SELECT id, name FROM goals WHERE name IN (${goals.map(() => "?").join(",")})`,
      goals
    );

    for (const goal of goalRows) {
      await query<ResultSetHeader>("INSERT IGNORE INTO user_goals (user_id, goal_id) VALUES (?, ?)", [userId, goal.id]);
    }
  }

  async upsertUserDocument(userId: number, type: "cv" | "transcript", fileName: string, fileUrl: string): Promise<void> {
    await query<ResultSetHeader>(
      `INSERT INTO user_documents (user_id, document_type, file_name, file_url)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), file_url = VALUES(file_url)`,
      [userId, type, fileName, fileUrl]
    );
  }

  async syncUsersTable(payload: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    university: string;
    fieldOfStudy: string;
    graduationYear: number | null;
    achievementGoal: string;
    cvUrl: string;
    transcriptUrl: string;
  }): Promise<void> {
    await query<ResultSetHeader>(
      `INSERT INTO users
        (email, username, first_name, last_name, university, field_of_study, graduation_year, achievement_goal, cv_url, transcript_url, onboarding_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        university = VALUES(university),
        field_of_study = VALUES(field_of_study),
        graduation_year = VALUES(graduation_year),
        achievement_goal = VALUES(achievement_goal),
        cv_url = VALUES(cv_url),
        transcript_url = VALUES(transcript_url),
        onboarding_completed = 1,
        updated_at = CURRENT_TIMESTAMP`,
      [
        payload.email,
        payload.username,
        payload.firstName,
        payload.lastName,
        payload.university,
        payload.fieldOfStudy,
        payload.graduationYear,
        payload.achievementGoal,
        payload.cvUrl,
        payload.transcriptUrl,
      ]
    );
  }

  async getUserReadinessScore(userId: string): Promise<number | null> {
    const rows = await query<RowDataPacket[]>("SELECT readiness_score FROM users WHERE id = ? LIMIT 1", [userId]);
    if (rows.length === 0 || rows[0].readiness_score === null) return null;
    return Math.round(Number(rows[0].readiness_score));
  }

  async getLatestCompletedAssessmentId(userId: string): Promise<number | string | null> {
    const latest = await query<RowDataPacket[]>(
      `SELECT id FROM user_assessments 
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );
    return latest.length > 0 ? latest[0].id : null;
  }

  async getCategoryScoresByAssessmentId(assessmentId: number | string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT 
         c.slug,
         c.name,
         COUNT(uaa.id) as total,
         SUM(CASE WHEN uaa.is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM user_assessment_answers uaa
       JOIN assessment_questions q ON q.id = uaa.question_id
       JOIN assessment_categories c ON c.id = q.category_id
       WHERE uaa.assessment_id = ?
       GROUP BY c.id`,
      [assessmentId]
    );
  }
}
