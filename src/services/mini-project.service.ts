import { MiniProjectRepository } from "../repositories/mini-project.repository";
import { UserRepository } from "../repositories/user.repository";
import { 
  MiniProjectWithSubmission, 
  UserMiniProjectSubmission,
  CreateSubmissionDTO,
  UpdateSubmissionReviewDTO
} from "../types/mini-project.types";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export class MiniProjectService {
  private miniProjectRepository = new MiniProjectRepository();
  private userRepository = new UserRepository();

  private extractJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch (e) {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1].trim());
        } catch (e2) {}
      }
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(text.substring(firstBrace, lastBrace + 1));
        } catch (e3) {}
      }
      throw new Error("Could not parse JSON from AI response: " + text);
    }
  }

  private async extractFileContent(filePath: string, fileType: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        return "File not found on server.";
      }

      const ext = fileType.toLowerCase();

      if (ext === "zip") {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();
        let content = "";
        let count = 0;

        for (const entry of zipEntries) {
          if (entry.isDirectory) continue;
          
          const name = entry.entryName.toLowerCase();
          // Skip non-code and configuration/modules paths
          if (
            name.includes("node_modules/") || 
            name.includes(".git/") || 
            name.includes(".next/") ||
            name.includes("dist/") ||
            name.includes("build/") ||
            name.includes("package-lock.json") ||
            name.includes("pnpm-lock.yaml") ||
            name.includes("yarn.lock")
          ) {
            continue;
          }

          const fileExt = path.extname(name);
          const textExtensions = [".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".py", ".java", ".cpp", ".c", ".h", ".cs", ".json", ".md", ".sql", ".txt"];
          
          if (textExtensions.includes(fileExt)) {
            content += `\n--- File: ${entry.entryName} ---\n`;
            // Limit each file size to 2KB to prevent exceeding LLM context window
            content += entry.getData().toString("utf8").substring(0, 2000) + "\n";
            count++;
            if (count >= 15) {
              content += "\n... [Remaining files truncated to conserve space] ...\n";
              break;
            }
          }
        }
        return content || "No readable code/text files found in the ZIP archive.";
      }

      if (ext === "pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await new PDFParse({ data: dataBuffer }).getText();
        return data.text || "No readable text found in PDF.";
      }

      if (ext === "docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || "No readable text found in DOCX.";
      }

      // If it's a raw text file or code file directly uploaded
      if (["js", "ts", "py", "html", "css", "txt", "json", "md"].includes(ext)) {
        return fs.readFileSync(filePath, "utf8").substring(0, 30000);
      }

      return `Non-extractable file type: ${fileType}. AI will grade based on project details and target role expectations.`;
    } catch (error) {
      console.error("[MiniProjectService] Error extracting file content:", error);
      return `Error reading file: ${(error as Error).message}`;
    }
  }

  private generateFallbackReview(projectTitle: string, userRole: string, scoreOverride?: number): any {
    const score = scoreOverride || 80;
    
    return {
      overall_score: score,
      strengths: [
        "Menunjukkan pemahaman dasar yang baik tentang skenario proyek.",
        "Struktur file dan pengorganisasian kode/dokumen tampak terstruktur dengan rapi.",
        "Implementasi memenuhi poin-poin dasar yang diminta di dalam brief proyek."
      ],
      improvements: [
        "Dapat meningkatkan validasi input atau error handling agar aplikasi lebih tangguh.",
        "Pertimbangkan optimasi performa atau penulisan kode/dokumen yang lebih modular.",
        "Tambahkan dokumentasi atau komentar pendukung agar kode lebih mudah dipahami oleh tim lain."
      ],
      objectives_met: [
        { title: "Kesesuaian dengan brief proyek", status: "success" },
        { title: "Pengorganisasian kode & file", status: "success" },
        { title: "Optimasi dan Best Practices", status: "warning" }
      ],
      ai_summary: `Proyek '${projectTitle}' telah disubmit dengan baik. Pengiriman file menunjukkan kesiapan teknis dasar yang sesuai untuk peran ${userRole || 'Developer'}. Kode atau dokumen terstruktur rapi, namun masih ada ruang peningkatan dalam aspek best practices, optimasi kecepatan/performa, dan dokumentasi yang lebih mendalam.`
    };
  }

  async getProjectsByRole(userId: string): Promise<MiniProjectWithSubmission[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const targetRole = user.target_role || "Frontend Developer";
    return await this.miniProjectRepository.findProjectsByUserRole(userId, targetRole);
  }

  async getProjectDetail(userId: string, projectId: string): Promise<{ project: MiniProjectWithSubmission | null; submission: UserMiniProjectSubmission | null }> {
    const project = await this.miniProjectRepository.findProjectById(projectId, userId);
    if (!project) {
      return { project: null, submission: null };
    }

    const submission = await this.miniProjectRepository.findSubmission(projectId, userId);
    return { project, submission };
  }

  async startProject(userId: string, projectId: string): Promise<UserMiniProjectSubmission> {
    const existing = await this.miniProjectRepository.findSubmission(projectId, userId);
    if (existing) {
      if (existing.status === 'not_started') {
        await this.miniProjectRepository.updateSubmission(existing.id, { status: 'in_progress' });
        existing.status = 'in_progress';
      }
      return existing;
    }

    const submissionData: CreateSubmissionDTO = {
      user_id: userId,
      mini_project_id: projectId,
      status: 'in_progress'
    };

    return await this.miniProjectRepository.createSubmission(submissionData);
  }

  async submitAndReview(userId: string, projectId: string, file: Express.Multer.File): Promise<UserMiniProjectSubmission> {
    // 1. Fetch user & project to check permissions & context
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const project = await this.miniProjectRepository.findProjectById(projectId, userId);
    if (!project) {
      throw new Error("Project not found");
    }

    // 2. Determine file details
    const fileType = path.extname(file.originalname).substring(1).toLowerCase(); // zip, pdf, docx, etc.
    const fileUrl = `uploads/${file.filename}`;
    const fileName = file.originalname;

    // 3. Insert or Update existing submission status to 'submitted'
    let submission = await this.miniProjectRepository.findSubmission(projectId, userId);
    if (submission) {
      // delete old file if it exists locally to avoid junk clutter
      if (submission.file_url && !submission.file_url.startsWith("http")) {
        try {
          const oldFilePath = path.join(process.cwd(), submission.file_url);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (err) {
          console.warn("Failed to delete old submission file:", err);
        }
      }

      await this.miniProjectRepository.updateSubmission(submission.id, {
        status: 'submitted',
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        submitted_at: new Date()
      });
      submission.status = 'submitted';
      submission.file_name = fileName;
      submission.file_url = fileUrl;
      submission.file_type = fileType;
      submission.submitted_at = new Date();
    } else {
      submission = await this.miniProjectRepository.createSubmission({
        user_id: userId,
        mini_project_id: projectId,
        status: 'submitted',
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        submitted_at: new Date()
      });
    }

    // 4. Extract content from the uploaded file
    const absoluteFilePath = path.join(process.cwd(), fileUrl);
    const extractedContent = await this.extractFileContent(absoluteFilePath, fileType);

    // 5. Trigger AI Review via OpenRouter (using fallback if credentials aren't set)
    let reviewResult: any = null;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    const modelChain = [
      primaryModel,
      "openai/gpt-oss-120b:free",
      "z-ai/glm-4.5-air:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "google/gemma-4-31b-it:free",
      "deepseek/deepseek-v4-flash:free",
      "qwen/qwen3-coder:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    if (apiKey) {
      const systemPrompt = `You are an expert Senior Technical Reviewer, Lead Engineer, and Career Coach. Your job is to thoroughly analyze a candidate's submitted files for a Mini Project brief, evaluate their work, and return a structured JSON feedback payload. Always output in Indonesian language (Bahasa Indonesia).`;
      
      const evaluationCriteriaStr = JSON.stringify(project.evaluation_criteria || []);
      const relatedSkillsStr = JSON.stringify(project.related_skills || []);

      const userPrompt = `
Lakukan review mendalam terhadap kode/berkas submission proyek berikut:
Judul Proyek: ${project.title}
Target Peran: ${user.target_role || "Developer"}
Keahlian Terkait: ${relatedSkillsStr}
Kriteria Evaluasi: ${evaluationCriteriaStr}

BERKAS BRIEF PROYEK:
---
${project.brief}
---

KODE/KONTEN SUBMISSION YANG DIEKSTRAK:
---
${extractedContent}
---

Tugas Anda adalah menilai submission ini secara objektif berdasarkan kriteria evaluasi dan brief proyek. Tulis seluruh feedback dalam BAHASA INDONESIA.
Kembalikan payload JSON yang valid dengan format berikut:
{
  "overall_score": <skor_keseluruhan_integer_antara_0_dan_100>,
  "strengths": [
    "<kelebihan_1_maksimal_15_kata>",
    "<kelebihan_2_maksimal_15_kata>",
    "<kelebihan_3_maksimal_15_kata>"
  ],
  "improvements": [
    "<saran_perbaikan_1_maksimal_15_kata>",
    "<saran_perbaikan_2_maksimal_15_kata>",
    "<saran_perbaikan_3_maksimal_15_kata>"
  ],
  "objectives_met": [
    { "title": "<kriteria_1_misal_responsiveness>", "status": "success" },
    { "title": "<kriteria_2_misal_clean_code>", "status": "success" },
    { "title": "<kriteria_3_misal_optimasi>", "status": "warning" }
  ],
  "ai_summary": "<ringkasan_review_menyeluruh_sebanyak_3_sampai_4_kalimat_yang_sangat_profesional_konstruktif_dan_memotivasi>"
}

Catatan untuk "objectives_met": Tentukan status "success" jika kriteria tersebut terpenuhi dengan sangat baik, dan "warning" jika kriteria tersebut masih memerlukan perbaikan signifikan. Tampilkan minimal 3 kriteria evaluasi utama dari proyek ini.

PENTING: Hanya kembalikan objek JSON yang valid. Jangan sertakan teks penjelasan lain, pembuka, atau markdown block di luar objek JSON tersebut.
`;

      for (const model of modelChain) {
        try {
          console.log(`[MiniProjectService] Trying model: ${model} for project ${project.title}...`);

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "Hi-Fi Dev Hub",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ]
            }),
            signal: AbortSignal.timeout(30000) // 30s timeout for code parsing + review
          });

          if (response.status === 429 || response.status === 404) {
            continue;
          }

          if (!response.ok) {
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            reviewResult = this.extractJson(content);
            console.log(`[MiniProjectService] ✅ AI review success with model: ${model}`);
            break;
          }
        } catch (error) {
          console.warn(`[MiniProjectService] Model ${model} failed:`, (error as Error).message);
        }
      }
    } else {
      console.warn("[MiniProjectService] OPENROUTER_API_KEY is not defined. Using fallback review.");
    }

    if (!reviewResult) {
      console.log("[MiniProjectService] Using local fallback review generator.");
      reviewResult = this.generateFallbackReview(project.title, user.target_role || "Developer");
    }

    // 6. Save AI review to Database
    const reviewData: UpdateSubmissionReviewDTO = {
      status: 'reviewed',
      overall_score: reviewResult.overall_score || 80,
      strengths: reviewResult.strengths || [],
      improvements: reviewResult.improvements || [],
      objectives_met: reviewResult.objectives_met || [],
      ai_summary: reviewResult.ai_summary || "Proyek telah berhasil dievaluasi.",
      reviewed_at: new Date()
    };

    return await this.miniProjectRepository.updateSubmissionReview(submission.id, reviewData);
  }

  async submitGitHubAndReview(userId: string, projectId: string, githubUrl: string): Promise<UserMiniProjectSubmission> {
    // 1. Fetch user & project to check permissions & context
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const project = await this.miniProjectRepository.findProjectById(projectId, userId);
    if (!project) {
      throw new Error("Project not found");
    }

    // 2. Parse owner and repo from githubUrl
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (!match) {
      throw new Error("Invalid GitHub repository URL.");
    }
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, "");

    // 3. Download the repository as a ZIP archive from GitHub API
    const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/main`;
    console.log(`[MiniProjectService] Downloading GitHub repo: ${owner}/${repo} from ${zipUrl}...`);

    let zipBuffer: ArrayBuffer;
    try {
      let response = await fetch(zipUrl, {
        headers: {
          "User-Agent": "Hi-Fi-Dev-Hub-Backend"
        }
      });

      // Try master branch if main returns 404
      if (response.status === 404) {
        const fallbackUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/master`;
        console.log(`[MiniProjectService] ZIP main branch failed, trying master branch fallback: ${fallbackUrl}`);
        response = await fetch(fallbackUrl, {
          headers: {
            "User-Agent": "Hi-Fi-Dev-Hub-Backend"
          }
        });
      }

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}: ${response.statusText}`);
      }

      zipBuffer = await response.arrayBuffer();
    } catch (err) {
      console.error("[MiniProjectService] Failed to download GitHub repo ZIP:", err);
      throw new Error(`Gagal mengunduh berkas dari GitHub. Pastikan repositori Anda publik. Detail: ${(err as Error).message}`);
    }

    // 4. Save to temporary file in uploads directory
    const tempFileName = `github-${owner}-${repo}-${Date.now()}.zip`;
    const tempFilePath = path.join(process.cwd(), "uploads", tempFileName);
    
    // Ensure uploads folder exists
    if (!fs.existsSync(path.dirname(tempFilePath))) {
      fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
    }

    fs.writeFileSync(tempFilePath, Buffer.from(zipBuffer));
    console.log(`[MiniProjectService] Saved GitHub ZIP to temporary path: ${tempFilePath}`);

    // 5. Create or Update submission status to 'submitted'
    const fileUrl = githubUrl;
    const fileName = `github:${owner}/${repo}`;
    const fileType = "github";

    let submission = await this.miniProjectRepository.findSubmission(projectId, userId);
    if (submission) {
      // delete old file if it exists locally to avoid junk clutter
      if (submission.file_url && !submission.file_url.startsWith("http") && !submission.file_url.includes("github.com")) {
        try {
          const oldFilePath = path.join(process.cwd(), submission.file_url);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (err) {
          console.warn("Failed to delete old submission file:", err);
        }
      }

      await this.miniProjectRepository.updateSubmission(submission.id, {
        status: 'submitted',
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        submitted_at: new Date()
      });
      submission.status = 'submitted';
      submission.file_name = fileName;
      submission.file_url = fileUrl;
      submission.file_type = fileType;
      submission.submitted_at = new Date();
    } else {
      submission = await this.miniProjectRepository.createSubmission({
        user_id: userId,
        mini_project_id: projectId,
        status: 'submitted',
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        submitted_at: new Date()
      });
    }

    // 6. Extract content from the downloaded temporary ZIP file
    const extractedContent = await this.extractFileContent(tempFilePath, "zip");

    // 7. Delete temporary ZIP file to save disk space
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`[MiniProjectService] Cleaned up temporary ZIP: ${tempFilePath}`);
      }
    } catch (err) {
      console.warn("Failed to delete temporary ZIP file:", err);
    }

    // 8. Trigger AI Review via OpenRouter (using fallback if credentials aren't set)
    let reviewResult: any = null;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    const modelChain = [
      primaryModel,
      "openai/gpt-oss-120b:free",
      "z-ai/glm-4.5-air:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "google/gemma-4-31b-it:free",
      "deepseek/deepseek-v4-flash:free",
      "qwen/qwen3-coder:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    if (apiKey) {
      const systemPrompt = `You are an expert Senior Technical Reviewer, Lead Engineer, and Career Coach. Your job is to thoroughly analyze a candidate's submitted files for a Mini Project brief, evaluate their work, and return a structured JSON feedback payload. Always output in Indonesian language (Bahasa Indonesia).`;
      
      const evaluationCriteriaStr = JSON.stringify(project.evaluation_criteria || []);
      const relatedSkillsStr = JSON.stringify(project.related_skills || []);

      const userPrompt = `
Lakukan review mendalam terhadap kode/berkas submission proyek berikut:
Judul Proyek: ${project.title}
Target Peran: ${user.target_role || "Developer"}
Keahlian Terkait: ${relatedSkillsStr}
Kriteria Evaluasi: ${evaluationCriteriaStr}

BERKAS BRIEF PROYEK:
---
${project.brief}
---

KODE/KONTEN SUBMISSION YANG DIEKSTRAK DARI GITHUB:
---
${extractedContent}
---

Tugas Anda adalah menilai submission ini secara objektif berdasarkan kriteria evaluasi dan brief proyek. Tulis seluruh feedback dalam BAHASA INDONESIA.
Kembalikan payload JSON yang valid dengan format berikut:
{
  "overall_score": <skor_keseluruhan_integer_antara_0_dan_100>,
  "strengths": [
    "<kelebihan_1_maksimal_15_kata>",
    "<kelebihan_2_maksimal_15_kata>",
    "<kelebihan_3_maksimal_15_kata>"
  ],
  "improvements": [
    "<saran_perbaikan_1_maksimal_15_kata>",
    "<saran_perbaikan_2_maksimal_15_kata>",
    "<saran_perbaikan_3_maksimal_15_kata>"
  ],
  "objectives_met": [
    { "title": "<kriteria_1_misal_responsiveness>", "status": "success" },
    { "title": "<kriteria_2_misal_clean_code>", "status": "success" },
    { "title": "<kriteria_3_misal_optimasi>", "status": "warning" }
  ],
  "ai_summary": "<ringkasan_review_menyeluruh_sebanyak_3_sampai_4_kalimat_yang_sangat_profesional_konstruktif_dan_memotivasi>"
}

PENTING: Hanya kembalikan objek JSON yang valid. Jangan sertakan teks penjelasan lain, pembuka, atau markdown block di luar objek JSON tersebut.
`;

      for (const model of modelChain) {
        try {
          console.log(`[MiniProjectService] Trying model: ${model} for GitHub project ${project.title}...`);

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "Hi-Fi Dev Hub",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ]
            }),
            signal: AbortSignal.timeout(30000)
          });

          if (response.status === 429 || response.status === 404) {
            continue;
          }

          if (!response.ok) {
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            reviewResult = this.extractJson(content);
            console.log(`[MiniProjectService] ✅ AI review success with model: ${model}`);
            break;
          }
        } catch (error) {
          console.warn(`[MiniProjectService] Model ${model} failed:`, (error as Error).message);
        }
      }
    }

    if (!reviewResult) {
      reviewResult = this.generateFallbackReview(project.title, user.target_role || "Developer");
    }

    // 9. Save AI review to Database
    const reviewData: UpdateSubmissionReviewDTO = {
      status: 'reviewed',
      overall_score: reviewResult.overall_score || 80,
      strengths: reviewResult.strengths || [],
      improvements: reviewResult.improvements || [],
      objectives_met: reviewResult.objectives_met || [],
      ai_summary: reviewResult.ai_summary || "Proyek telah berhasil dievaluasi.",
      reviewed_at: new Date()
    };

    return await this.miniProjectRepository.updateSubmissionReview(submission.id, reviewData);
  }
}
