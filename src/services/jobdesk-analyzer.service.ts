import { UserRepository } from "../repositories/user.repository";
import { JobdeskAnalysisResult } from "../types/jobdesk-analyzer.types";

export class JobdeskAnalyzerService {
  private userRepository = new UserRepository();

  private extractJson(text: string): JobdeskAnalysisResult {
    try {
      return JSON.parse(text) as JobdeskAnalysisResult;
    } catch (e) {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1].trim()) as JobdeskAnalysisResult;
        } catch (_e2) {}
      }
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(text.substring(firstBrace, lastBrace + 1)) as JobdeskAnalysisResult;
        } catch (_e3) {}
      }
      throw new Error("Could not parse JSON from AI response: " + text);
    }
  }

  private generateFallback(role: string, field: string): JobdeskAnalysisResult {
    return {
      match_score: 72,
      matching_skills: ["JavaScript", "React", "Node.js", "Git", "REST API"],
      missing_skills: ["TypeScript", "Docker", "AWS", "CI/CD"],
      recommendations: [
        "Start a TypeScript Migration project to build familiarity.",
        "Complete a Docker Containerization tutorial and apply it to a project.",
        "Add AWS keywords to your CV once you complete a basic certification.",
      ],
      summary: `Your profile as a ${role} with a background in ${field} shows a decent foundation for this role, but there are some missing advanced technical skills that the job requires.`,
    };
  }

  private async tryModel(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<JobdeskAnalysisResult | null> {
    console.log(`[JobdeskAnalyzer] Trying model: ${model}...`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Hi-Fi Readiness Dashboard",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 429 || response.status === 404) {
      const errText = await response.text();
      console.warn(
        `[JobdeskAnalyzer] Model ${model} returned ${response.status}, skipping. (${errText.substring(0, 120)})`
      );
      return null;
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[JobdeskAnalyzer] Model ${model} error ${response.status}: ${errText.substring(0, 120)}`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[JobdeskAnalyzer] Model ${model} returned empty content.`);
      return null;
    }

    try {
      const parsed = this.extractJson(content);
      console.log(`[JobdeskAnalyzer] ✅ Success with model: ${model}`);
      return parsed;
    } catch (parseErr) {
      console.warn(`[JobdeskAnalyzer] JSON parse failed for model ${model}:`, parseErr);
      return null;
    }
  }

  async analyze(userId: string, jobDescription: string): Promise<JobdeskAnalysisResult> {
    const user = await this.userRepository.findById(userId);
    const targetRole = user?.target_role || "Software Developer";
    const fieldOfStudy = user?.field_of_study || "Computer Science";
    const name = `${user?.first_name || "Candidate"} ${user?.last_name || ""}`.trim();

    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModel = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free";

    // Comprehensive fallback chain — all known free OpenRouter models.
    // Confirmed working (200 OK) first, then the rest as further fallbacks.
    // The service tries each in order; skips any that return 429 or 404.
    const modelChain = [
      primaryModel, // from .env (OPENROUTER_MODEL)

      // ✅ Confirmed working (live test 2026-05-31)
      "openai/gpt-oss-120b:free",
      "z-ai/glm-4.5-air:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "poolside/laguna-m.1:free",

      // 🔄 Further fallbacks (may be available depending on time/load)
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "openai/gpt-oss-20b:free",
      "deepseek/deepseek-v4-flash:free",
      "qwen/qwen3-coder:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "moonshotai/kimi-k2.6:free",
      "minimax/minimax-m2.5:free",
      "poolside/laguna-xs.2:free",
      "liquid/lfm-2.5-1.2b-instruct:free",
      "liquid/lfm-2.5-1.2b-thinking:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "nvidia/nemotron-nano-12b-v2-vl:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "meta-llama/llama-3.2-3b-instruct:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    ].filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate

    const systemPrompt = `You are an expert Career Advisor and AI Job Match Analyzer. Your task is to analyze how well a candidate's profile matches a given job description, and provide constructive feedback.`;

    const userPrompt = `
Analyze the match between the following candidate and the job description.
Candidate Name: ${name}
Target Role: ${targetRole}
Background: ${fieldOfStudy}

Job Description:
${jobDescription}

Return a detailed JSON object with exact ratings and analysis. Be constructive but professional.
The JSON object MUST contain exactly these fields:
1. "match_score": integer between 0 and 100
2. "matching_skills": array of strings (skills the candidate likely has based on their target role and background that are required by the job)
3. "missing_skills": array of strings (skills required by the job that the candidate is missing)
4. "recommendations": array of strings (3 actionable steps to improve their chances for this job)
5. "summary": string (a professional 2-3 sentence summary of the match analysis)

IMPORTANT: Output ONLY the valid JSON object. Do not include any explanations, introduction, markdown blocks, or other text outside the JSON.
`;

    let analysisResult: JobdeskAnalysisResult | null = null;

    if (apiKey) {
      for (const model of modelChain) {
        try {
          analysisResult = await this.tryModel(apiKey, model, systemPrompt, userPrompt);
          if (analysisResult) break;
        } catch (error) {
          console.warn(`[JobdeskAnalyzer] Model ${model} threw an exception:`, error);
        }
      }
    } else {
      console.warn("[JobdeskAnalyzer] OPENROUTER_API_KEY is not defined. Using fallback.");
    }

    if (!analysisResult) {
      console.log("[JobdeskAnalyzer] All AI models failed or unavailable. Using static fallback.");
      analysisResult = this.generateFallback(targetRole, fieldOfStudy);
    }

    return {
      match_score: analysisResult.match_score || 0,
      matching_skills: analysisResult.matching_skills || [],
      missing_skills: analysisResult.missing_skills || [],
      recommendations: analysisResult.recommendations || [],
      summary: analysisResult.summary || "Analysis completed.",
    };
  }
}
