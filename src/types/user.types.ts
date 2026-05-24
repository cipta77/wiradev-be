export interface User {
  id: string;
  email: string;
  username: string | null;
  password_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  university: string | null;
  field_of_study: string | null;
  graduation_year: number | null;
  avatar_url: string | null;
  achievement_goal: AchievementGoal | null;
  target_role: string | null;
  cv_url: string | null;
  transcript_url: string | null;
  onboarding_completed: boolean;
  is_email_verified: boolean;
  github_connected: boolean;
  created_at: Date;
  updated_at: Date;
}

export enum AchievementGoal {
  GET_FIRST_JOB = 'GET_FIRST_JOB',
  SWITCH_DEVELOPER_ROLE = 'SWITCH_DEVELOPER_ROLE',
  IMPROVE_CODING_SKILLS = 'IMPROVE_CODING_SKILLS',
  PREPARE_INTERVIEWS = 'PREPARE_INTERVIEWS',
  BUILD_PORTFOLIO = 'BUILD_PORTFOLIO',
  UNDERSTAND_MARKET = 'UNDERSTAND_MARKET'
}

export interface CreateUserDTO {
  email: string;
  username?: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  university?: string;
  field_of_study?: string;
  graduation_year?: number;
  avatar_url?: string;
}

export interface AuthProvider {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  created_at: Date;
}

export interface CreateAuthProviderDTO {
  user_id: string;
  provider: string;
  provider_user_id: string;
}

export interface OnboardingProfileDTO {
  first_name: string;
  last_name: string;
  university: string;
  field_of_study: string;
  graduation_year: number;
}

export interface OnboardingGoalDTO {
  achievement_goal: AchievementGoal;
}

export interface AccountSettingsDTO {
  first_name: string;
  last_name: string;
  email: string;
  university: string;
}

export interface UpdatePasswordDTO {
  current_password?: string;
  new_password?: string;
}

export interface OnboardingRoleDTO {
  target_role: string;
}

