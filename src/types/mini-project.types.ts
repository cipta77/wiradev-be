export interface MiniProject {
  id: string;
  title: string;
  description: string;
  brief: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string | null;
  tag: string | null;
  related_skills: string[] | string | null; // parsed or raw JSON string depending on repo/query
  evaluation_criteria: string[] | string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface UserMiniProjectSubmission {
  id: string;
  user_id: string;
  mini_project_id: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'reviewed';
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  overall_score: number | null;
  strengths: string[] | string | null;
  improvements: string[] | string | null;
  objectives_met: { title: string; status: 'success' | 'warning' }[] | string | null;
  ai_summary: string | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  created_at: Date;
}

export interface MiniProjectWithSubmission extends MiniProject {
  submission_status: 'not_started' | 'in_progress' | 'submitted' | 'reviewed';
  submission_id?: string;
  overall_score?: number | null;
  submitted_at?: Date | null;
  reviewed_at?: Date | null;
}

export interface CreateSubmissionDTO {
  user_id: string;
  mini_project_id: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'reviewed';
  file_name?: string;
  file_url?: string;
  file_type?: string;
  submitted_at?: Date;
}

export interface UpdateSubmissionReviewDTO {
  status: 'reviewed';
  overall_score: number;
  strengths: string[];
  improvements: string[];
  objectives_met: { title: string; status: 'success' | 'warning' }[];
  ai_summary: string;
  reviewed_at: Date;
}
