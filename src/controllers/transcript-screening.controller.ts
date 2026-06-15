import { Request, Response } from "express";
import { TranscriptScreeningService } from "../services/transcript-screening.service";

/**
 * Read access to academic transcript screening results. Uploading + analysis
 * happens via the user onboarding endpoints (PATCH /users/:id/onboarding/...);
 * these endpoints expose the stored results, mirroring the CV screening API.
 */
export class TranscriptScreeningController {
  private transcriptScreeningService = new TranscriptScreeningService();

  getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const history = await this.transcriptScreeningService.getHistory(user.id);
      res.status(200).json({
        message: "Transcript screening history retrieved successfully",
        result: history,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to retrieve transcript screening history",
      });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const screening = await this.transcriptScreeningService.getById(user.id, id);

      if (!screening) {
        res.status(404).json({ message: "Transcript screening report not found" });
        return;
      }

      res.status(200).json({
        message: "Transcript screening report retrieved successfully",
        result: screening,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to retrieve transcript screening report",
      });
    }
  };

  deleteById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const deleted = await this.transcriptScreeningService.deleteScreening(user.id, id);

      if (!deleted) {
        res.status(404).json({ message: "Transcript screening report not found or could not be deleted" });
        return;
      }

      res.status(200).json({
        message: "Transcript screening report deleted successfully",
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to delete transcript screening report",
      });
    }
  };
}
