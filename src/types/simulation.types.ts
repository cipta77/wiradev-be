export interface Simulation {
  id: string;
  user_id: string;
  type: "recruiter" | "salary";
  company_name: string | null;
  status: "ongoing" | "completed";
  current_question_index: number;
  created_at: Date;
}

export interface SimulationMessage {
  id: string;
  simulation_id: string;
  sender: "bot" | "user";
  text: string;
  created_at: Date;
}

export interface SimulationResult {
  id: string;
  simulation_id: string;
  is_passed: boolean;
  score: number;
  feedback: string;
  negotiated_salary: string | null;
  created_at: Date;
}

export interface CreateSimulationDTO {
  user_id: string;
  type: "recruiter" | "salary";
  company_name?: string;
}

export interface CreateSimulationMessageDTO {
  simulation_id: string;
  sender: "bot" | "user";
  text: string;
}

export interface CreateSimulationResultDTO {
  simulation_id: string;
  is_passed: boolean;
  score: number;
  feedback: string;
  negotiated_salary?: string;
}
