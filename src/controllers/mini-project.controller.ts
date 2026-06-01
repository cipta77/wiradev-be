import { Request, Response } from "express";
import { MiniProjectService } from "../services/mini-project.service";

export class MiniProjectController {
  private miniProjectService = new MiniProjectService();

  getProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const projects = await this.miniProjectService.getProjectsByRole(user.id);
      res.status(200).json({
        message: "Mini projects retrieved successfully",
        result: projects
      });
    } catch (error: any) {
      console.error("[MiniProjectController] getProjects error:", error);
      res.status(500).json({
        message: error.message || "Failed to retrieve mini projects"
      });
    }
  };

  getProjectDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const { project, submission } = await this.miniProjectService.getProjectDetail(user.id, id);

      if (!project) {
        res.status(404).json({ message: "Mini project not found" });
        return;
      }

      res.status(200).json({
        message: "Mini project detail retrieved successfully",
        result: {
          project,
          submission
        }
      });
    } catch (error: any) {
      console.error("[MiniProjectController] getProjectDetail error:", error);
      res.status(500).json({
        message: error.message || "Failed to retrieve mini project detail"
      });
    }
  };

  startProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const submission = await this.miniProjectService.startProject(user.id, id);

      res.status(200).json({
        message: "Mini project started successfully",
        result: submission
      });
    } catch (error: any) {
      console.error("[MiniProjectController] startProject error:", error);
      res.status(500).json({
        message: error.message || "Failed to start mini project"
      });
    }
  };

  submitProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const file = req.file;
      const githubUrl = req.body.github_url;

      if (!file && !githubUrl) {
        res.status(400).json({ message: "No file uploaded or GitHub URL provided" });
        return;
      }

      let submission;
      if (file) {
        console.log(`[MiniProjectController] Starting review for project ${id}, user ${user.id} with file ${file.originalname}`);
        submission = await this.miniProjectService.submitAndReview(user.id, id, file);
      } else {
        console.log(`[MiniProjectController] Starting review for project ${id}, user ${user.id} with GitHub repository ${githubUrl}`);
        submission = await this.miniProjectService.submitGitHubAndReview(user.id, id, githubUrl);
      }

      res.status(200).json({
        message: "Mini project submitted and reviewed successfully by AI",
        result: submission
      });
    } catch (error: any) {
      console.error("[MiniProjectController] submitProject error:", error);
      res.status(500).json({
        message: error.message || "Failed to submit and review mini project"
      });
    }
  };
}
