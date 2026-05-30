export interface AnalyzeJobdeskDTO {
  job_description: string;
}

export interface JobdeskAnalysisResult {
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
  recommendations: string[];
  summary: string;
}
