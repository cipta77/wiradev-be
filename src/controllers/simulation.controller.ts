import { Request, Response } from "express";
import { SimulationService } from "../services/simulation.service";

export class SimulationController {
  private simulationService = new SimulationService();

  startSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { type, company_name } = req.body;
      if (!type || !["recruiter", "salary"].includes(type)) {
        res.status(400).json({ message: "Invalid or missing simulation type" });
        return;
      }

      const result = await this.simulationService.start(
        user.id,
        type,
        company_name
      );

      res.status(201).json({
        message: "Simulation session started successfully",
        result,
      });
    } catch (error: any) {
      console.error("Error starting simulation:", error);
      res.status(500).json({
        message: error.message || "Failed to start simulation session",
      });
    }
  };

  submitMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const { text } = req.body;

      if (!text || !text.trim()) {
        res.status(400).json({ message: "Message text is required" });
        return;
      }

      const result = await this.simulationService.submitMessage(
        user.id,
        id,
        text
      );

      res.status(200).json({
        message: "Message processed successfully",
        result,
      });
    } catch (error: any) {
      console.error("Error submitting message:", error);
      res.status(500).json({
        message: error.message || "Failed to process simulation message",
      });
    }
  };

  getDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const result = await this.simulationService.getDetails(user.id, id);

      res.status(200).json({
        message: "Simulation details retrieved successfully",
        result,
      });
    } catch (error: any) {
      console.error("Error retrieving simulation details:", error);
      res.status(500).json({
        message: error.message || "Failed to retrieve simulation details",
      });
    }
  };
}
