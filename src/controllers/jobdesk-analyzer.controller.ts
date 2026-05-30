import { Request, Response } from "express";
import { JobdeskAnalyzerService } from "../services/jobdesk-analyzer.service";

export class JobdeskAnalyzerController {
  private jobdeskAnalyzerService = new JobdeskAnalyzerService();

  analyze = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { job_description } = req.body;
      if (!job_description || typeof job_description !== "string" || !job_description.trim()) {
        res.status(400).json({ message: "Job description is required and must be a non-empty string" });
        return;
      }

      const result = await this.jobdeskAnalyzerService.analyze(user.id, job_description);

      res.status(200).json({
        message: "Job description analyzed successfully",
        result,
      });
    } catch (error: any) {
      console.error("Error analyzing job description:", error);
      res.status(500).json({
        message: error.message || "Failed to analyze job description",
      });
    }
  };
}
