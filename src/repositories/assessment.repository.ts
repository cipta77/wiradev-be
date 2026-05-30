import { query } from "../db/connection";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export class AssessmentRepository {
  async getMappedCategoriesByRole(role: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT c.id, c.slug, c.name, c.description, c.icon, c.color 
       FROM role_category_mapping m
       JOIN assessment_categories c ON c.slug = m.category_slug
       WHERE m.target_role_pattern = ?
       ORDER BY m.priority ASC`,
      [role]
    );
  }

  async getDefaultCategories(): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT id, slug, name, description, icon, color 
       FROM assessment_categories 
       WHERE slug IN ('general_cs', 'soft_skills', 'other')
       ORDER BY FIELD(slug, 'general_cs', 'soft_skills', 'other')`
    );
  }

  async getMappedCategorySlugsByRole(role: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT category_slug FROM role_category_mapping WHERE target_role_pattern = ? ORDER BY priority ASC`,
      [role]
    );
  }

  async getCategoriesBySlugs(slugs: string[]): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT id, slug, name, description, icon, color 
       FROM assessment_categories 
       WHERE slug IN (${slugs.map(() => "?").join(",")})`,
      slugs
    );
  }

  async getActiveQuestionsByCategoryId(categoryId: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT id, category_id, question_type, question_text, options, correct_answer, explanation 
       FROM assessment_questions 
       WHERE category_id = ? AND is_active = TRUE
       ORDER BY sort_order ASC, created_at ASC`,
      [categoryId]
    );
  }

  async createAssessmentStart(userId: string): Promise<ResultSetHeader> {
    return query<ResultSetHeader>(`INSERT INTO user_assessments (user_id) VALUES (?)`, [userId]);
  }

  async generateUuid(): Promise<string> {
    const rows = await query<RowDataPacket[]>("SELECT UUID() as uuid");
    return rows[0].uuid as string;
  }

  async createAssessmentWithId(assessmentId: string, userId: string, timeTakenSeconds: number): Promise<void> {
    await query<ResultSetHeader>(
      `INSERT INTO user_assessments (id, user_id, time_taken_seconds) VALUES (?, ?, ?)`,
      [assessmentId, userId, timeTakenSeconds]
    );
  }

  async getQuestionCorrectAnswer(questionId: string): Promise<string | null> {
    const qResult = await query<RowDataPacket[]>(`SELECT correct_answer FROM assessment_questions WHERE id = ? LIMIT 1`, [questionId]);
    return qResult.length > 0 ? (qResult[0].correct_answer as string) : null;
  }

  async insertAssessmentAnswer(assessmentId: string, questionId: string, userAnswer: string, isCorrect: boolean): Promise<void> {
    await query<ResultSetHeader>(
      `INSERT INTO user_assessment_answers (assessment_id, question_id, user_answer, is_correct)
       VALUES (?, ?, ?, ?)`,
      [assessmentId, questionId, userAnswer, isCorrect]
    );
  }

  async completeAssessment(assessmentId: string, total: number, correct: number, scorePercentage: number): Promise<void> {
    await query<ResultSetHeader>(
      `UPDATE user_assessments 
       SET completed_at = CURRENT_TIMESTAMP, total_questions = ?, correct_answers = ?, score_percentage = ?
       WHERE id = ?`,
      [total, correct, scorePercentage, assessmentId]
    );
  }

  async updateUserReadinessScore(userId: string, scorePercentage: number): Promise<void> {
    await query<ResultSetHeader>(`UPDATE users SET readiness_score = ? WHERE id = ?`, [scorePercentage, userId]);
  }

  async getAssessmentResultById(id: string, userId: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT id, started_at, completed_at, time_taken_seconds, total_questions, correct_answers, score_percentage
       FROM user_assessments 
       WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
  }

  async getAssessmentAnswers(assessmentId: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT uaa.question_id, uaa.user_answer, uaa.is_correct, aq.question_type, aq.correct_answer, aq.explanation
       FROM user_assessment_answers uaa
       JOIN assessment_questions aq ON aq.id = uaa.question_id
       WHERE uaa.assessment_id = ?`,
      [assessmentId]
    );
  }

  async getLatestCompletedAssessment(userId: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT id, completed_at, score_percentage 
       FROM user_assessments 
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );
  }

  async getLatestCompletedAssessmentAnalytics(userId: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT id, completed_at, total_questions, correct_answers, score_percentage 
       FROM user_assessments 
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );
  }

  async getCategoryResultsForAssessment(assessmentId: string): Promise<RowDataPacket[]> {
    return query<RowDataPacket[]>(
      `SELECT 
         c.slug,
         c.name,
         c.icon,
         c.color,
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
