import { query } from "../db/connection";
import { 
  MiniProject, 
  UserMiniProjectSubmission, 
  MiniProjectWithSubmission,
  CreateSubmissionDTO,
  UpdateSubmissionReviewDTO
} from "../types/mini-project.types";
import crypto from "crypto";

export class MiniProjectRepository {
  private parseJsonField<T = any>(field: any): T | null {
    if (!field) return null;
    if (typeof field === "string") {
      try {
        return JSON.parse(field) as T;
      } catch (e) {
        return null;
      }
    }
    return field as T;
  }

  private mapProjectRow(row: any): MiniProject {
    return {
      ...row,
      related_skills: this.parseJsonField<string[]>(row.related_skills),
      evaluation_criteria: this.parseJsonField<string[]>(row.evaluation_criteria),
      is_active: !!row.is_active
    };
  }

  private mapSubmissionRow(row: any): UserMiniProjectSubmission {
    return {
      ...row,
      strengths: this.parseJsonField<string[]>(row.strengths),
      improvements: this.parseJsonField<string[]>(row.improvements),
      objectives_met: this.parseJsonField<any[]>(row.objectives_met)
    };
  }

  private mapProjectWithSubmissionRow(row: any): MiniProjectWithSubmission {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      brief: row.brief,
      level: row.level,
      duration: row.duration,
      tag: row.tag,
      related_skills: this.parseJsonField<string[]>(row.related_skills),
      evaluation_criteria: this.parseJsonField<string[]>(row.evaluation_criteria),
      sort_order: row.sort_order,
      is_active: !!row.is_active,
      created_at: row.created_at,
      submission_status: row.submission_status || 'not_started',
      submission_id: row.submission_id || undefined,
      overall_score: row.overall_score !== null ? row.overall_score : null,
      submitted_at: row.submitted_at || null,
      reviewed_at: row.reviewed_at || null
    };
  }

  async findProjectsByUserRole(userId: string, targetRole: string): Promise<MiniProjectWithSubmission[]> {
    // Join mini_projects, mini_project_role_mapping, and user_mini_project_submissions
    // targetRole may have some partial mapping or exact matching, we use target_role_pattern = ?
    // Let's also do LIKE search for safety, but since target_role matches our seeds exactly, exact match works beautifully.
    const sql = `
      SELECT 
        mp.*,
        mpr.priority,
        umps.status AS submission_status,
        umps.id AS submission_id,
        umps.overall_score,
        umps.submitted_at,
        umps.reviewed_at
      FROM mini_projects mp
      INNER JOIN mini_project_role_mapping mpr ON mp.id = mpr.mini_project_id
      LEFT JOIN user_mini_project_submissions umps ON mp.id = umps.mini_project_id AND umps.user_id = ?
      WHERE mpr.target_role_pattern = ? AND mp.is_active = TRUE
      ORDER BY mpr.priority ASC, mp.sort_order ASC
    `;

    const rows = await query<any[]>(sql, [userId, targetRole]);
    return rows.map(row => this.mapProjectWithSubmissionRow(row));
  }

  async findProjectById(projectId: string, userId: string): Promise<MiniProjectWithSubmission | null> {
    const sql = `
      SELECT 
        mp.*,
        umps.status AS submission_status,
        umps.id AS submission_id,
        umps.overall_score,
        umps.submitted_at,
        umps.reviewed_at
      FROM mini_projects mp
      LEFT JOIN user_mini_project_submissions umps ON mp.id = umps.mini_project_id AND umps.user_id = ?
      WHERE mp.id = ? AND mp.is_active = TRUE
    `;

    const rows = await query<any[]>(sql, [userId, projectId]);
    if (rows.length === 0) {
      return null;
    }
    return this.mapProjectWithSubmissionRow(rows[0]);
  }

  async findSubmission(projectId: string, userId: string): Promise<UserMiniProjectSubmission | null> {
    const sql = "SELECT * FROM user_mini_project_submissions WHERE mini_project_id = ? AND user_id = ?";
    const rows = await query<any[]>(sql, [projectId, userId]);
    if (rows.length === 0) {
      return null;
    }
    return this.mapSubmissionRow(rows[0]);
  }

  async createSubmission(data: CreateSubmissionDTO): Promise<UserMiniProjectSubmission> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO user_mini_project_submissions (
        id, user_id, mini_project_id, status, file_name, file_url, file_type, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(sql, [
      id,
      data.user_id,
      data.mini_project_id,
      data.status,
      data.file_name ?? null,
      data.file_url ?? null,
      data.file_type ?? null,
      data.submitted_at ?? null
    ]);

    const created = await this.findSubmissionById(id);
    if (!created) {
      throw new Error("Failed to retrieve created submission");
    }
    return created;
  }

  async updateSubmission(id: string, data: Partial<UserMiniProjectSubmission>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.file_name !== undefined) {
      fields.push("file_name = ?");
      values.push(data.file_name);
    }
    if (data.file_url !== undefined) {
      fields.push("file_url = ?");
      values.push(data.file_url);
    }
    if (data.file_type !== undefined) {
      fields.push("file_type = ?");
      values.push(data.file_type);
    }
    if (data.submitted_at !== undefined) {
      fields.push("submitted_at = ?");
      values.push(data.submitted_at);
    }

    if (fields.length === 0) return;

    values.push(id);
    const sql = `UPDATE user_mini_project_submissions SET ${fields.join(", ")} WHERE id = ?`;
    await query(sql, values);
  }

  async updateSubmissionReview(id: string, data: UpdateSubmissionReviewDTO): Promise<UserMiniProjectSubmission> {
    const sql = `
      UPDATE user_mini_project_submissions 
      SET 
        status = ?, 
        overall_score = ?, 
        strengths = ?, 
        improvements = ?, 
        objectives_met = ?, 
        ai_summary = ?, 
        reviewed_at = ?
      WHERE id = ?
    `;

    await query(sql, [
      data.status,
      data.overall_score,
      JSON.stringify(data.strengths),
      JSON.stringify(data.improvements),
      JSON.stringify(data.objectives_met),
      data.ai_summary,
      data.reviewed_at,
      id
    ]);

    const updated = await this.findSubmissionById(id);
    if (!updated) {
      throw new Error("Failed to retrieve updated submission");
    }
    return updated;
  }

  async findSubmissionById(id: string): Promise<UserMiniProjectSubmission | null> {
    const sql = "SELECT * FROM user_mini_project_submissions WHERE id = ?";
    const rows = await query<any[]>(sql, [id]);
    if (rows.length === 0) {
      return null;
    }
    return this.mapSubmissionRow(rows[0]);
  }
}
