import { query } from "../db/connection";
import {
  Simulation,
  SimulationMessage,
  SimulationResult,
  CreateSimulationDTO,
  CreateSimulationMessageDTO,
  CreateSimulationResultDTO,
} from "../types/simulation.types";
import crypto from "crypto";

export class SimulationRepository {
  async createSimulation(data: CreateSimulationDTO): Promise<Simulation> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO simulations (id, user_id, type, company_name, status, current_question_index)
      VALUES (?, ?, ?, ?, 'ongoing', 0)
    `;

    await query(sql, [
      id,
      data.user_id,
      data.type,
      data.company_name ?? null,
    ]);

    const created = await this.findSimulationById(id, data.user_id);
    if (!created) {
      throw new Error("Failed to retrieve created simulation session");
    }
    return created;
  }

  async findSimulationById(id: string, userId: string): Promise<Simulation | null> {
    const sql = "SELECT * FROM simulations WHERE id = ? AND user_id = ?";
    const rows = await query<any[]>(sql, [id, userId]);
    if (rows.length === 0) {
      return null;
    }
    return rows[0] as Simulation;
  }

  async updateSimulationProgress(
    id: string,
    userId: string,
    index: number,
    status: "ongoing" | "completed"
  ): Promise<void> {
    const sql = "UPDATE simulations SET current_question_index = ?, status = ? WHERE id = ? AND user_id = ?";
    await query(sql, [index, status, id, userId]);
  }

  async saveMessage(data: CreateSimulationMessageDTO): Promise<SimulationMessage> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO simulation_messages (id, simulation_id, sender, text)
      VALUES (?, ?, ?, ?)
    `;

    await query(sql, [
      id,
      data.simulation_id,
      data.sender,
      data.text,
    ]);

    const messages = await query<any[]>("SELECT * FROM simulation_messages WHERE id = ?", [id]);
    if (messages.length === 0) {
      throw new Error("Failed to retrieve saved message");
    }
    return messages[0] as SimulationMessage;
  }

  async getSimulationMessages(simulationId: string): Promise<SimulationMessage[]> {
    const sql = "SELECT * FROM simulation_messages WHERE simulation_id = ? ORDER BY created_at ASC";
    const rows = await query<any[]>(sql, [simulationId]);
    return rows as SimulationMessage[];
  }

  async saveResult(data: CreateSimulationResultDTO): Promise<SimulationResult> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO simulation_results (id, simulation_id, is_passed, score, feedback, negotiated_salary)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await query(sql, [
      id,
      data.simulation_id,
      data.is_passed,
      data.score,
      data.feedback,
      data.negotiated_salary ?? null,
    ]);

    const results = await query<any[]>("SELECT * FROM simulation_results WHERE id = ?", [id]);
    if (results.length === 0) {
      throw new Error("Failed to retrieve saved evaluation result");
    }
    return results[0] as SimulationResult;
  }

  async findResultBySimulationId(simulationId: string): Promise<SimulationResult | null> {
    const sql = "SELECT * FROM simulation_results WHERE simulation_id = ?";
    const rows = await query<any[]>(sql, [simulationId]);
    if (rows.length === 0) {
      return null;
    }
    return rows[0] as SimulationResult;
  }
}
