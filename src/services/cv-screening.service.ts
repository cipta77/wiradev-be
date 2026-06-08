import { CvScreeningRepository } from "../repositories/cv-screening.repository";
import { UserRepository as RepoUser } from "../repositories/user.repository";
import { CvScreening, CreateCvScreeningDTO } from "../types/cv-screening.types";
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export class CvScreeningService {
  private cvScreeningRepository = new CvScreeningRepository();
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
    const uni = university || "Top Tier University";
    const field = fieldOfStudy || "Computer Science";

    // Dynamic categories based on role
    let strengths = ["Familiar with basic web development concepts", "Database structure understanding"];
    let weaknesses = ["Lacks modern frontend frameworks experience", "No mention of state management tools"];
    
    if (role.toLowerCase().includes("front")) {
      strengths = ["Strong understanding of responsive design", "Good grasp of JavaScript fundamentals"];
      weaknesses = ["Could improve testing (Jest/Cypress) coverage", "Lacks advanced performance optimization techniques"];
    } else if (role.toLowerCase().includes("back")) {
      strengths = ["Solid API design patterns", "Good database architecture skills"];
      weaknesses = ["No experience with containerization (Docker)", "Missing CI/CD pipelines knowledge"];
    } else if (role.toLowerCase().includes("data") || role.toLowerCase().includes("ai")) {
      strengths = ["Strong analytical background", "Familiar with data processing libraries"];
      weaknesses = ["Needs more production deployment experience", "Lacks distributed computing skills"];
    } else {
      strengths = ["Good fundamental programming skills", "Strong academic foundation"];
      weaknesses = ["Lacks real-world industry experience", "Needs more cloud deployment exposure"];
    }

    return {
      overall_score: 74,
      strengths: strengths,
      weaknesses: weaknesses,
      ai_summary: `The CV of ${name} demonstrates a solid foundation in ${field} from ${uni}. The profile is well-aligned with the ${role} target role, particularly showing strength in core areas. However, there is a clear opportunity to elevate this CV by addressing the mentioned weaknesses.`,
      recommendations: [
        `Highlight ${weaknesses[0].toLowerCase()} by adding a relevant project or certification.`,
        `Add measurable impact (e.g. percentages, performance gains) in the descriptions of your project/work experiences.`,
        "Ensure your professional contact info (GitHub, LinkedIn) is placed prominently at the top of the header."
      ]
    };
  }

  async uploadAndAnalyze(userId: string, fileName: string, fileUrl: string): Promise<CvScreening> {
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

    let cvText = "";
    let base64Image: string | undefined;

    try {
      const cleanPath = fileUrl.replace(/^\/?uploads\//, "");
      const filePath = path.join(process.cwd(), "uploads", cleanPath);
      
      if (fs.existsSync(filePath)) {
        console.log(`[CvScreening] Processing file ${fileName}...`);
        const fileExt = path.extname(fileName).toLowerCase();
        
        if ([".jpg", ".jpeg", ".png", ".webp"].includes(fileExt)) {
          const dataBuffer = fs.readFileSync(filePath);
          const mimeType = fileExt === ".jpg" || fileExt === ".jpeg" ? "jpeg" : fileExt.replace(".", "");
          base64Image = `data:image/${mimeType};base64,${dataBuffer.toString("base64")}`;
          cvText = "CV provided as an image.";
        } else if (fileExt === ".pdf") {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await new PDFParse({ data: dataBuffer }).getText();
          cvText = pdfData.text;
        } else if (fileExt === ".docx") {
          const result = await mammoth.extractRawText({ path: filePath });
          cvText = result.value;
        } else {
          cvText = fs.readFileSync(filePath, "utf-8");
        }
        
        if (cvText.length > 15000) {
          cvText = cvText.substring(0, 15000) + "... (truncated)";
        }
        
        console.log(`[CvScreening] Successfully processed file.`);
      }
    } catch (err) {
      console.warn("[CvScreening] Failed to extract/read file:", err);
      cvText = "Could not extract text from the file.";
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
      const systemPrompt = `You are an expert HR Specialist and professional ATS (Applicant Tracking System) CV screening assistant. Your task is to analyze the candidate's credentials and target role, then generate a highly professional and realistic screening assessment.`;

      const userPrompt = `
Generate a highly customized, realistic ATS screening analysis for:
Candidate Name: ${name}
Target Role: ${targetRole}
University: ${university}
Field of Study: ${fieldOfStudy}
Graduation Year: ${graduationYear}
CV File: ${fileName}

--- CV CONTENT START ---
${cvText}
--- CV CONTENT END ---

Since you are analyzing this CV, evaluate their match for the role based on the CV content above. 
Please score the CV strictly based on this rubric (Total 100 points):
- Education & Background (20 pts): Relevance of university/field of study to the role.
- Experience & Projects (40 pts): Quality, relevance, and impact of past work.
- Technical/Core Skills (30 pts): Presence of necessary skills for the target role.
- Presentation & Formatting (10 pts): Clarity, typos, and professionalism.

Return a detailed and beautifully constructed JSON object. Be constructive but professional.
The JSON object MUST contain exactly these fields:
1. "overall_score": integer between 0 and 100
2. "strengths": array of strings (3-5 key strengths or advantages found in their CV regarding the target role)
3. "weaknesses": array of strings (3-5 key weaknesses, missing skills, or areas of improvement regarding the target role)
4. "ai_summary": string (a highly professional, cohesive 3-4 sentence summary of their profile strengths, alignment with target role, and key improvement areas)
5. "recommendations": array of strings (3-5 clear, highly actionable steps to improve their CV score)

IMPORTANT: Output ONLY the valid JSON object. Do not include any explanations, introduction, markdown blocks, or other text outside the JSON.
`;

      for (const model of modelChain) {
        try {
          console.log(`[CvScreening] Trying model: ${model} for ${name}...`);

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
            console.warn(`[CvScreening] Model ${model} returned ${response.status}, skipping. (${errText.substring(0, 100)})`);
            lastError = `Model ${model} returned ${response.status} - ${errText.substring(0, 50)}`;
            continue;
          }

          if (!response.ok) {
            console.error(`[CvScreening] Model ${model} error ${response.status}: ${response.statusText}`);
            lastError = `Model ${model} error ${response.status}: ${response.statusText}`;
            continue;
          }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              analysisResult = this.extractJson(content);
              console.log(`[CvScreening] ✅ Success with model: ${model}`);
              break;
            }
          } catch (error: any) {
            console.warn(`[CvScreening] Model ${model} threw an error:`, error);
            lastError = `Model ${model} threw an error: ${error.message || error}`;
          }
        }
      } else {
        console.warn("[CvScreening] OPENROUTER_API_KEY is not defined.");
        lastError = "OPENROUTER_API_KEY is not defined.";
      }
  
      if (!analysisResult) {
        throw new Error(`AI Analysis failed for all available models. Please try again later. Last error: ${lastError}`);
      }

    // 4. Save to Database
    const screeningData: CreateCvScreeningDTO = {
      user_id: userId,
      file_name: fileName,
      file_url: fileUrl,
      overall_score: analysisResult.overall_score || 70,
      strengths: analysisResult.strengths || [],
      weaknesses: analysisResult.weaknesses || [],
      ai_summary: analysisResult.ai_summary || "Profile analysis completed successfully.",
      recommendations: analysisResult.recommendations || []
    };

    return await this.cvScreeningRepository.create(screeningData);
  }

  async getHistory(userId: string): Promise<CvScreening[]> {
    return await this.cvScreeningRepository.findAllByUserId(userId);
  }

  async getById(userId: string, id: string): Promise<CvScreening | null> {
    return await this.cvScreeningRepository.findById(id, userId);
  }

  async deleteScreening(userId: string, id: string): Promise<boolean> {
    // 1. Get screening record to find the file URL
    const screening = await this.cvScreeningRepository.findById(id, userId);
    if (!screening) {
      return false;
    }

    // 2. Delete file physical copy if it's on local disk
    try {
      if (screening.file_url && !screening.file_url.startsWith("http")) {
        // Construct the full local file path
        // Assume file_url looks like "uploads/filename.pdf" or "/uploads/filename.pdf"
        const cleanPath = screening.file_url.replace(/^\/?uploads\//, "");
        const filePath = path.join(process.cwd(), "uploads", cleanPath);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted CV file at: ${filePath}`);
        }
      }
    } catch (err) {
      console.error("Failed to delete physical CV file:", err);
    }

    // 3. Delete from database
    return await this.cvScreeningRepository.deleteById(id, userId);
  }
}
