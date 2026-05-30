export interface CvScreening {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  overall_score: number;
  contact_score: number | null;
  summary_score: number | null;
  skills_score: number | null;
  experience_score: number | null;
  projects_score: number | null;
  education_score: number | null;
  ats_score: number | null;
  keywords_found: string[] | null;
  keywords_missing: string[] | null;
  ai_summary: string | null;
  recommendations: string[] | null;
  created_at: Date;
}

export interface CreateCvScreeningDTO {
  user_id: string;
  file_name: string;
  file_url: string;
  overall_score: number;
  contact_score?: number;
  summary_score?: number;
  skills_score?: number;
  experience_score?: number;
  projects_score?: number;
  education_score?: number;
  ats_score?: number;
  keywords_found?: string[];
  keywords_missing?: string[];
  ai_summary?: string;
  recommendations?: string[];
}
