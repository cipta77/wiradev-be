import { Request, Response } from "express";
import { CvScreeningService } from "../services/cv-screening.service";

export class CvScreeningController {
  private cvScreeningService = new CvScreeningService();

  upload = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file uploaded or invalid file format" });
        return;
      }

      // Multer stores the relative/absolute file path
      // We will make it consistent (e.g. process.env.UPLOAD_DIR or similar)
      const fileUrl = `uploads/${file.filename}`;

      console.log(`Starting CV analysis for user ${user.id} with file ${file.originalname}`);
      const result = await this.cvScreeningService.uploadAndAnalyze(
        user.id,
        file.originalname,
        fileUrl
      );

      res.status(201).json({
        message: "CV screened and analyzed successfully",
        result,
      });
    } catch (error: any) {
      console.error("Error during CV upload & screening:", error);
      res.status(500).json({
        message: error.message || "Failed to upload and analyze CV",
      });
    }
  };

  getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const history = await this.cvScreeningService.getHistory(user.id);
      res.status(200).json({
        message: "CV screening history retrieved successfully",
        result: history,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to retrieve CV screening history",
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
      const screening = await this.cvScreeningService.getById(user.id, id);

      if (!screening) {
        res.status(404).json({ message: "CV screening report not found" });
        return;
      }

      res.status(200).json({
        message: "CV screening report retrieved successfully",
        result: screening,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to retrieve CV screening report",
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
      const deleted = await this.cvScreeningService.deleteScreening(user.id, id);

      if (!deleted) {
        res.status(404).json({ message: "CV screening report not found or could not be deleted" });
        return;
      }

      res.status(200).json({
        message: "CV screening report deleted successfully",
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to delete CV screening report",
      });
    }
  };
}
