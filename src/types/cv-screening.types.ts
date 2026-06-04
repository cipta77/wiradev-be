export interface CvScreening {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  overall_score: number;
  strengths: string[] | null;
  weaknesses: string[] | null;
  ai_summary: string | null;
  recommendations: string[] | null;
  created_at: Date;
}

export interface CreateCvScreeningDTO {
  user_id: string;
  file_name: string;
  file_url: string;
  overall_score: number;
  strengths?: string[];
  weaknesses?: string[];
  ai_summary?: string;
  recommendations?: string[];
}
