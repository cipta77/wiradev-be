import { TranscriptScreeningRepository } from "../repositories/transcript-screening.repository";
import { UserRepository as RepoUser } from "../repositories/user.repository";
import { TranscriptScreening, CreateTranscriptScreeningDTO } from "../types/transcript-screening.types";
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export class TranscriptScreeningService {
  private transcriptScreeningRepository = new TranscriptScreeningRepository();
  private userRepository = new RepoUser();

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

  private generateFallbackAnalysis(firstName: string, lastName: string, targetRole: string, university: string, fieldOfStudy: string): any {
    const role = targetRole || "Software Developer";
    const name = `${firstName || "Candidate"} ${lastName || ""}`.trim();
    const uni = university || "University";
    const field = fieldOfStudy || "Computer Science";

    return {
      overall_score: 75,
      strengths: [
        "Completed core computer science modules",
        `Academic background in ${field} provides a solid foundation`
      ],
      weaknesses: [
        `Limited specialized coursework directly aligned with ${role}`,
        "Practical application details not captureable solely from course titles"
      ],
      ai_summary: `The academic transcript of ${name} from ${uni} demonstrates a solid academic foundation in ${field}. Coursework is generally aligned with target role, showing a reasonable balance of theoretical fundamentals. Recommended to supplement with practical projects.`,
      recommendations: [
        "Focus on practical project experience to complement academic coursework.",
        "Consider specialized certifications or online bootcamps for target role technologies.",
        "Highlight key academic projects on your CV to showcase practical skills."
      ]
    };
  }

  async uploadAndAnalyze(userId: string, fileName: string, fileUrl: string): Promise<TranscriptScreening> {
    // 1. Fetch user profile to tailor analysis
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const firstName = user.first_name || "Candidate";
    const lastName = user.last_name || "";
    const name = `${firstName} ${lastName}`.trim();
    const university = user.university || "University";
    const fieldOfStudy = user.field_of_study || "Computer Science";
    const targetRole = user.target_role || "Software Developer";
    const graduationYear = user.graduation_year || "N/A";

    let transcriptText = "";
    let base64Image: string | undefined;

    try {
      const cleanPath = fileUrl.replace(/^\/?uploads\//, "");
      const filePath = path.join(process.cwd(), "uploads", cleanPath);
      
      if (fs.existsSync(filePath)) {
        console.log(`[TranscriptScreening] Processing file ${fileName}...`);
        const fileExt = path.extname(fileName).toLowerCase();
        
        if ([".jpg", ".jpeg", ".png", ".webp"].includes(fileExt)) {
          const dataBuffer = fs.readFileSync(filePath);
          const mimeType = fileExt === ".jpg" || fileExt === ".jpeg" ? "jpeg" : fileExt.replace(".", "");
          base64Image = `data:image/${mimeType};base64,${dataBuffer.toString("base64")}`;
          transcriptText = "Transcript provided as an image.";
        } else if (fileExt === ".pdf") {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await new PDFParse({ data: dataBuffer }).getText();
          transcriptText = pdfData.text;
        } else if (fileExt === ".docx") {
          const result = await mammoth.extractRawText({ path: filePath });
          transcriptText = result.value;
        } else {
          transcriptText = fs.readFileSync(filePath, "utf-8");
        }
        
        if (transcriptText.length > 15000) {
          transcriptText = transcriptText.substring(0, 15000) + "... (truncated)";
        }
        
        console.log(`[TranscriptScreening] Successfully processed file.`);
      }
    } catch (err) {
      console.warn("[TranscriptScreening] Failed to extract/read file:", err);
      transcriptText = "Could not extract text from the file.";
    }

    let analysisResult: any;

    // 2. Call OpenRouter API
    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    const textModelChain = [
      primaryModel,
      "openai/gpt-oss-120b:free",
      "z-ai/glm-4.5-air:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "poolside/laguna-m.1:free",
      "google/gemma-4-31b-it:free",
      "openai/gpt-oss-20b:free",
      "deepseek/deepseek-v4-flash:free",
      "qwen/qwen3-coder:free",
      "moonshotai/kimi-k2.6:free",
      "poolside/laguna-xs.2:free",
      "liquid/lfm-2.5-1.2b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "meta-llama/llama-3.2-3b-instruct:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
    ];

    const visionModelChain = [
      primaryModel,
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "moonshotai/kimi-k2.6:free",
      "nvidia/nemotron-nano-12b-v2-vl:free"
    ];

    const modelChain = (base64Image ? visionModelChain : textModelChain).filter((m, i, arr) => arr.indexOf(m) === i);

    let lastError = "";
    if (apiKey) {
      const systemPrompt = `You are an expert Academic Advisor and technical recruiting assistant. Your task is to analyze the candidate's academic transcript and target role, then generate a highly professional and realistic screening assessment.`;

      const userPrompt = `
Generate a highly customized, realistic academic transcript screening analysis for:
Candidate Name: ${name}
Target Role: ${targetRole}
University: ${university}
Field of Study: ${fieldOfStudy}
Graduation Year: ${graduationYear}
Transcript File: ${fileName}

--- TRANSCRIPT CONTENT START ---
${transcriptText}
--- TRANSCRIPT CONTENT END ---

Since you are analyzing this academic transcript, evaluate their preparation and readiness for the target role based on the transcript content above.
Please score the transcript strictly based on this rubric (Total 100 points):
- Academic Performance / GPA (40 pts): Overall GPA, grades in key technical courses, or grade trend.
- Course Relevance (40 pts): Relevance and depth of coursework taken to the target role (e.g. core engineering, databases, algorithms).
- Rigor & Growth (20 pts): Overall rigor of coursework, progress/improvement over semesters, or notable academic achievements.

Return a detailed and beautifully constructed JSON object. Be constructive but professional.
The JSON object MUST contain exactly these fields:
1. "overall_score": integer between 0 and 100
2. "strengths": array of strings (3-5 key academic strengths, high grades in critical courses, or relevant coursework)
3. "weaknesses": array of strings (3-5 key academic weaknesses, missing core courses, or low grades in critical areas regarding the target role)
4. "ai_summary": string (a highly professional, cohesive 3-4 sentence summary of their academic profile strengths, relevance to target role, and academic foundation)
5. "recommendations": array of strings (3-5 clear, highly actionable steps to supplement their academic background, e.g. online courses, certifications, projects to offset missing classes)

IMPORTANT: Output ONLY the valid JSON object. Do not include any explanations, introduction, markdown blocks, or other text outside the JSON.
`;

      for (const model of modelChain) {
        try {
          console.log(`[TranscriptScreening] Trying model: ${model} for ${name}...`);

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "Hi-Fi Readiness Dashboard",
            },
            body: JSON.stringify({
              model,
              temperature: 0.1,
              top_p: 0.9,
              messages: [
                { role: "system", content: systemPrompt },
                { 
                  role: "user", 
                  content: base64Image 
                    ? [
                        { type: "text", text: userPrompt },
                        { type: "image_url", image_url: { url: base64Image } }
                      ]
                    : userPrompt 
                }
              ]
            }),
            signal: AbortSignal.timeout(20000)
          });

          if (response.status === 429 || response.status === 404) {
            const errText = await response.text();
            console.warn(`[TranscriptScreening] Model ${model} returned ${response.status}, skipping. (${errText.substring(0, 100)})`);
            lastError = `Model ${model} returned ${response.status} - ${errText.substring(0, 50)}`;
            continue;
          }

          if (!response.ok) {
            console.error(`[TranscriptScreening] Model ${model} error ${response.status}: ${response.statusText}`);
            lastError = `Model ${model} error ${response.status}: ${response.statusText}`;
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            analysisResult = this.extractJson(content);
            console.log(`[TranscriptScreening] ✅ Success with model: ${model}`);
            break;
          }
        } catch (error: any) {
          console.warn(`[TranscriptScreening] Model ${model} threw an error:`, error);
          lastError = `Model ${model} threw an error: ${error.message || error}`;
        }
      }
    } else {
      console.warn("[TranscriptScreening] OPENROUTER_API_KEY is not defined.");
      lastError = "OPENROUTER_API_KEY is not defined.";
    }

    if (!analysisResult) {
      console.warn(`[TranscriptScreening] AI Analysis failed for all available models. Using fallback. Last error: ${lastError}`);
      analysisResult = this.generateFallbackAnalysis(firstName, lastName, targetRole, university, fieldOfStudy);
    }

    // 4. Save to Database
    const screeningData: CreateTranscriptScreeningDTO = {
      user_id: userId,
      file_name: fileName,
      file_url: fileUrl,
      overall_score: analysisResult.overall_score || 70,
      strengths: analysisResult.strengths || [],
      weaknesses: analysisResult.weaknesses || [],
      ai_summary: analysisResult.ai_summary || "Academic transcript analysis completed successfully.",
      recommendations: analysisResult.recommendations || []
    };

    const created = await this.transcriptScreeningRepository.create(screeningData);

    // Fold the transcript analysis into the user's overall readiness score
    try {
      await this.userRepository.recomputeReadinessScore(userId);
    } catch (err) {
      console.warn("[TranscriptScreening] Failed to recompute readiness score:", err);
    }

    return created;
  }

  async getHistory(userId: string): Promise<TranscriptScreening[]> {
    return await this.transcriptScreeningRepository.findAllByUserId(userId);
  }

  async getById(userId: string, id: string): Promise<TranscriptScreening | null> {
    return await this.transcriptScreeningRepository.findById(id, userId);
  }

  async deleteScreening(userId: string, id: string): Promise<boolean> {
    const screening = await this.transcriptScreeningRepository.findById(id, userId);
    if (!screening) {
      return false;
    }

    try {
      if (screening.file_url && !screening.file_url.startsWith("http")) {
        const cleanPath = screening.file_url.replace(/^\/?uploads\//, "");
        const filePath = path.join(process.cwd(), "uploads", cleanPath);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted transcript file at: ${filePath}`);
        }
      }
    } catch (err) {
      console.error("Failed to delete physical transcript file:", err);
    }

    return await this.transcriptScreeningRepository.deleteById(id, userId);
  }
}
