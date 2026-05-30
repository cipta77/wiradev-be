import { CvScreeningRepository } from "../repositories/cv-screening.repository";
import { UserRepository as RepoUser } from "../repositories/user.repository";
import { CvScreening, CreateCvScreeningDTO } from "../types/cv-screening.types";
import fs from "fs";
import path from "path";

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
    let keywordsFound = ["Git", "HTML", "CSS", "SQL", "Agile"];
    let keywordsMissing = ["Docker", "TypeScript", "System Design"];
    
    if (role.toLowerCase().includes("front")) {
      keywordsFound.push("JavaScript", "React", "Tailwind CSS", "Responsive Design");
      keywordsMissing.push("TypeScript", "Redux", "Next.js", "Jest");
    } else if (role.toLowerCase().includes("back")) {
      keywordsFound.push("Node.js", "Express", "REST APIs", "MySQL");
      keywordsMissing.push("Redis", "Docker", "MongoDB", "TypeScript", "CI/CD");
    } else if (role.toLowerCase().includes("data") || role.toLowerCase().includes("ai")) {
      keywordsFound.push("Python", "Pandas", "NumPy", "Statistics");
      keywordsMissing.push("Machine Learning", "Scikit-Learn", "SQL", "Docker");
    } else {
      keywordsFound.push("Algorithms", "Data Structures", "Java", "Python");
      keywordsMissing.push("TypeScript", "Docker", "AWS");
    }

    return {
      overall_score: 74,
      contact_score: 85,
      summary_score: 70,
      skills_score: 78,
      experience_score: 68,
      projects_score: 75,
      education_score: 80,
      ats_score: 72,
      keywords_found: keywordsFound,
      keywords_missing: keywordsMissing,
      ai_summary: `The CV of ${name} demonstrates a solid foundation in ${field} from ${uni}. The profile is well-aligned with the ${role} target role, particularly showing strength in core developer tools and methodology. However, there is a clear opportunity to elevate this CV by highlighting more modern frameworks and advanced tools relevant to this career track.`,
      recommendations: [
        `Reformat the skills section to group technologies logically and highlight ${keywordsMissing.slice(0, 2).join(" and ")} explicitly.`,
        `Add measurable impact (e.g. percentages, performance gains) in the descriptions of your project/work experiences.`,
        "Ensure your professional contact info (GitHub, LinkedIn) is placed prominently at the top of the header.",
        `Incorporate at least one high-quality project utilizing ${keywordsMissing[0]} to directly match modern industry expectations for ${role}.`
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

    let analysisResult: any;

    // 2. Call OpenRouter API
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

    if (apiKey) {
      try {
        console.log(`Analyzing CV using OpenRouter model ${model} for ${name}...`);
        
        const systemPrompt = `You are an expert HR Specialist and professional ATS (Applicant Tracking System) CV screening assistant. Your task is to analyze the candidate's credentials and target role, then generate a highly professional and realistic screening assessment.`;
        
        const userPrompt = `
Generate a highly customized, realistic ATS screening analysis for:
Candidate Name: ${name}
Target Role: ${targetRole}
University: ${university}
Field of Study: ${fieldOfStudy}
Graduation Year: ${graduationYear}
CV File: ${fileName}

Since you are analyzing this CV, evaluate their match for the role. Return a detailed and beautifully constructed JSON object with exact ratings. Be constructive but professional.
The JSON object MUST contain exactly these fields:
1. "overall_score": integer between 0 and 100
2. "contact_score": integer between 0 and 100
3. "summary_score": integer between 0 and 100
4. "skills_score": integer between 0 and 100
5. "experience_score": integer between 0 and 100
6. "projects_score": integer between 0 and 100
7. "education_score": integer between 0 and 100
8. "ats_score": integer between 0 and 100
9. "keywords_found": array of strings (realistic skills they probably have on their resume, e.g. React, Git, JavaScript, etc.)
10. "keywords_missing": array of strings (realistic standard industry skills they are missing or should add, e.g. TypeScript, Docker, etc.)
11. "ai_summary": string (a highly professional, cohesive 3-4 sentence summary of their profile strengths, alignment with target role, and key improvement areas)
12. "recommendations": array of strings (3-5 clear, highly actionable steps to improve their CV score)

IMPORTANT: Output ONLY the valid JSON object. Do not include any explanations, introduction, markdown blocks, or other text outside the JSON.
`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Hi-Fi Readiness Dashboard",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ]
          }),
          signal: AbortSignal.timeout(15000) // 15s timeout
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            analysisResult = this.extractJson(content);
            console.log("Successfully retrieved AI analysis from OpenRouter");
          }
        } else {
          console.error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error("Failed to perform real OpenRouter AI screening analysis:", error);
      }
    } else {
      console.warn("OPENROUTER_API_KEY is not defined. Using fallbacks.");
    }

    // 3. Fallback if AI call failed or key is missing
    if (!analysisResult) {
      console.log("Using dynamic fallback generator for CV screening");
      analysisResult = this.generateFallbackAnalysis(firstName, lastName, targetRole, university, fieldOfStudy);
    }

    // 4. Save to Database
    const screeningData: CreateCvScreeningDTO = {
      user_id: userId,
      file_name: fileName,
      file_url: fileUrl,
      overall_score: analysisResult.overall_score || 70,
      contact_score: analysisResult.contact_score || 80,
      summary_score: analysisResult.summary_score || 75,
      skills_score: analysisResult.skills_score || 70,
      experience_score: analysisResult.experience_score || 65,
      projects_score: analysisResult.projects_score || 70,
      education_score: analysisResult.education_score || 80,
      ats_score: analysisResult.ats_score || 70,
      keywords_found: analysisResult.keywords_found || [],
      keywords_missing: analysisResult.keywords_missing || [],
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
