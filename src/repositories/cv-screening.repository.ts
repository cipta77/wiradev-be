import { query } from "../db/connection";
import { CvScreening, CreateCvScreeningDTO } from "../types/cv-screening.types";
import crypto from "crypto";

export class CvScreeningRepository {
  private parseJsonField(field: any): any {
    if (!field) return null;
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch (e) {
        return [];
      }
    }
    return field;
  }

  private mapRow(row: any): CvScreening {
    return {
      ...row,
      keywords_found: this.parseJsonField(row.keywords_found),
      keywords_missing: this.parseJsonField(row.keywords_missing),
      recommendations: this.parseJsonField(row.recommendations),
    };
  }

  async create(data: CreateCvScreeningDTO): Promise<CvScreening> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO cv_screenings (
        id, user_id, file_name, file_url, overall_score,
        contact_score, summary_score, skills_score, experience_score,
        projects_score, education_score, ats_score,
        keywords_found, keywords_missing, ai_summary, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(sql, [
      id,
      data.user_id,
      data.file_name,
      data.file_url,
      data.overall_score,
      data.contact_score ?? null,
      data.summary_score ?? null,
      data.skills_score ?? null,
      data.experience_score ?? null,
      data.projects_score ?? null,
      data.education_score ?? null,
      data.ats_score ?? null,
      data.keywords_found ? JSON.stringify(data.keywords_found) : null,
      data.keywords_missing ? JSON.stringify(data.keywords_missing) : null,
      data.ai_summary ?? null,
      data.recommendations ? JSON.stringify(data.recommendations) : null,
    ]);

    const created = await this.findById(id, data.user_id);
    if (!created) {
      throw new Error("Failed to retrieve created CV screening");
    }
    return created;
  }

  async findById(id: string, userId: string): Promise<CvScreening | null> {
    const sql = "SELECT * FROM cv_screenings WHERE id = ? AND user_id = ?";
    const rows = await query<any[]>(sql, [id, userId]);
    if (rows.length === 0) {
      return null;
    }
    return this.mapRow(rows[0]);
  }

  async findAllByUserId(userId: string): Promise<CvScreening[]> {
    const sql = "SELECT * FROM cv_screenings WHERE user_id = ? ORDER BY created_at DESC";
    const rows = await query<any[]>(sql, [userId]);
    return rows.map((row) => this.mapRow(row));
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const sql = "DELETE FROM cv_screenings WHERE id = ? AND user_id = ?";
    const result = await query<any>(sql, [id, userId]);
    return result.affectedRows > 0;
  }
}
