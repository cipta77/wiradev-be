import { SimulationRepository } from "../repositories/simulation.repository";
import { UserRepository } from "../repositories/user.repository";
import { Simulation, SimulationMessage, SimulationResult } from "../types/simulation.types";

export class SimulationService {
  private simulationRepository = new SimulationRepository();
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

  // Offensive / disrespectful language (Indonesian + English). Used as a
  // deterministic safety net so the HR persona always reacts firmly to abuse
  // even when the AI model times out and we fall back to canned responses.
  private static readonly OFFENSIVE_TERMS = [
    "anjing", "anjg", "asu", "bangsat", "bajingan", "babi", "kontol", "memek",
    "ngentot", "ngentd", "tai", "taik", "tolol", "goblok", "goblog", "bego",
    "bodoh", "brengsek", "brengsek", "kampret", "jancok", "jancuk", "pepek",
    "pantek", "setan", "monyet", "fuck", "fucking", "shit", "bitch", "asshole",
    "dick", "bastard", "idiot", "stupid", "dumbass", "moron",
  ];

  private isDisrespectful(text: string): boolean {
    const normalized = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
    return SimulationService.OFFENSIVE_TERMS.some((term) =>
      normalized.includes(` ${term} `),
    );
  }

  private isEnglishSimulation(history: SimulationMessage[]): boolean {
    if (history.length === 0) return false;
    const firstText = history[0].text;
    return firstText.includes("Software Engineer") || firstText.includes("Software Engineering") || firstText.includes("strictly in English");
  }

  private firmDisrespectResponse(isIndonesian: boolean): string {
    return isIndonesian
      ? "Mohon maaf, tetapi bahasa seperti itu tidak pantas dan tidak dapat saya terima dalam wawancara profesional. Saya mengharapkan komunikasi yang saling menghormati. Sikap seperti ini sangat merugikan penilaian Anda. Jika Anda ingin melanjutkan, silakan jawab pertanyaan saya dengan sopan dan profesional."
      : "I'm sorry, but that kind of language is unacceptable and inappropriate in a professional interview. I expect mutual respect throughout this conversation. Conduct like this seriously harms your candidacy. If you'd like to continue, please respond to my question professionally and respectfully.";
  }

  private looksIndonesian(history: SimulationMessage[], latest: string): boolean {
    const sample = `${latest} ${history.map((m) => m.text).join(" ")}`.toLowerCase();
    return /\b(saya|anda|kamu|terima kasih|halo|tidak|yang|untuk|dengan|apa)\b/.test(
      sample,
    );
  }

  private generateFallbackEvaluation(type: "recruiter" | "salary", history: SimulationMessage[]): any {
    // Simple dynamic generator based on user message lengths as a heuristic proxy for effort!
    const userMessages = history.filter((m) => m.sender === "user");
    let totalLength = 0;
    userMessages.forEach((m) => {
      totalLength += m.text.length;
    });

    const averageLength = totalLength / (userMessages.length || 1);

    // Higher length -> better score!
    let score = 65 + Math.min(Math.floor(averageLength / 5), 25);
    if (score > 95) score = 95;

    // Disrespect / profanity anywhere in the transcript is a hard professionalism
    // failure, regardless of answer length.
    const wasDisrespectful = userMessages.some((m) => this.isDisrespectful(m.text));
    if (wasDisrespectful) {
      const header = type === "recruiter" ? "### Review" : "### Negotiation Review";
      return {
        is_passed: false,
        score: 25,
        ...(type === "salary" ? { negotiated_salary: "Rp 8.000.000" } : {}),
        feedback: `${header}
Your conduct during this session was unprofessional. The use of disrespectful or offensive language is unacceptable in any interview or negotiation and immediately undermines your candidacy.

### What Went Wrong
- You used disrespectful/offensive language toward the interviewer.
- Professional communication and mutual respect are baseline expectations that were not met.

### How To Improve
- Always maintain a calm, respectful, and professional tone, even under pressure or frustration.
- Treat every interaction as a reflection of how you would behave with real colleagues and clients.`,
      };
    }

    if (type === "recruiter") {
      const isPassed = score >= 75;
      return {
        is_passed: isPassed,
        score,
        feedback: `### Overall Review
Your answers demonstrated a good technical baseline, but there is room to highlight your impact more effectively.

### Strengths
- You structured your answers clearly and kept a professional tone.
- Your target role alignment was visible in your answers.

### Weaknesses & Improvements
- Some answers were slightly short. Try using the STAR method (Situation, Task, Action, Result) to format your responses.
- Incorporate quantified achievements and scope metrics to provide evidence of your abilities.`
      };
    } else {
      // Negotiated salary fallback
      const finalSalary = 8000000 + Math.min(Math.floor((score - 60) * 50000), 2000000);
      return {
        is_passed: score >= 70,
        score,
        negotiated_salary: `Rp ${finalSalary.toLocaleString("id-ID")}`,
        feedback: `### Negotiation Review
You successfully negotiated an increase over the initial offer. You showed professional assertion and backed your requests with market expectations.

### Strengths
- You anchored higher based on market rates and remained polite.
- You focused on value delivery rather than personal needs.

### Improvements
- Make sure to explicitly ask for other forms of compensation (equity, remote options, signing bonus) when salary headroom is tight.`
      };
    }
  }

  // Rotating fallback follow-ups used only when the AI model is unreachable.
  // Keeps an open-ended interview/negotiation flowing for any number of turns.
  private fallbackFollowUp(type: "recruiter" | "salary", turn: number, companyName?: string | null): string {
    if (type === "recruiter" && companyName?.toLowerCase() === "gojek") {
      const gojekRecruiter = [
        "Welcome to Gojek. I'm Maya from the Engineering recruitment team. Let's start with a brief introduction. Can you tell me about your background and why you are interested in the Software Engineering role at Gojek?",
        "Gojek systems handle massive scale. Can you walk me through how you would design a highly concurrent ride-allocation queue to handle thousands of requests per second? What technologies would you use?",
        "Interesting. When designing distributed systems at this scale, we often face network latency and partition issues. How would you handle consistency versus availability in a distributed driver assignment service?",
        "Good explanation. Can you tell me about a time you had to deal with a technical disagreement in an engineering project, and how you resolved it?",
        "How do you approach testing your code, especially when dealing with complex asynchronous flow and concurrent database access?",
        "Where do you see yourself contributing most to the Gojek engineering culture, and what areas are you looking to grow in?",
      ];
      return gojekRecruiter[(Math.max(turn, 1) - 1) % gojekRecruiter.length];
    }

    const recruiter = [
      "Thanks for sharing. Can you describe a challenging project or technical problem you solved, and how you approached it?",
      "Interesting. How do you handle working under tight deadlines or shifting priorities when requirements change?",
      "Good to know. Tell me about a time you collaborated with a team to overcome a disagreement — what was your role?",
      "Let's go deeper: what are you most proud of in your work so far, and what impact did it have?",
      "How do you keep your skills current, and what are you learning right now?",
      "Where do you see yourself growing in this role over the next year or two?",
      "Can you walk me through how you'd approach a task you've never done before?",
      "What questions do you have for me about the team or the role?",
    ];
    const salary = [
      "I appreciate your response, and we understand market rates. However, our initial budget is tight. Could we meet in the middle at Rp 9,000,000/month?",
      "That's a fair point regarding value. If we confirm Rp 9,000,000/month, could we revisit your health or training benefits next quarter?",
      "Help me understand the number you have in mind — what market data or value are you basing it on?",
      "We could consider a performance review at six months. How would that change your view on the current figure?",
      "Beyond base salary, are there other forms of compensation (signing bonus, remote flexibility, equity) that matter to you?",
      "Let's try to close this. What's the figure that would make you comfortable accepting today?",
    ];
    const pool = type === "recruiter" ? recruiter : salary;
    // turn starts at 1 for the first follow-up; rotate through the pool.
    return pool[(Math.max(turn, 1) - 1) % pool.length];
  }

  async start(
    userId: string,
    type: "recruiter" | "salary",
    companyName?: string,
    roleOverride?: string,
    scenario?: string
  ): Promise<{ simulation: Simulation; firstMessage: SimulationMessage }> {
    // 1. Fetch User details for AI customization
    const user = await this.userRepository.findById(userId);
    const role = roleOverride || user?.target_role || "Software Engineer";
    const firstName = (user?.first_name || "").trim();
    const name = firstName ? `${firstName} ${user?.last_name || ""}`.trim() : "";
    const company = companyName || "this premium company";

    let initialText = "";

    if (scenario) {
      initialText = scenario;
    } else {
      // 2. Dynamic prompt for initial question
      const apiKey = process.env.OPENROUTER_API_KEY;
      const primaryModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
      const modelChain = [
        primaryModel,
        "google/gemini-2.5-flash",
        "google/gemini-2.0-flash-lite:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-chat",
      ].filter((m, i, arr) => arr.indexOf(m) === i);

      if (apiKey) {
        try {
          const nameInstruction = name
            ? `The candidate's name is ${name}; address them by their first name.`
            : `The candidate's name is unknown: address them naturally (e.g. "you"), and NEVER use placeholders like "[Candidate Name]" or "[Name]".`;
          
          const isEnglish = (roleOverride === "Software Engineer");
          let systemPrompt = "";
          if (isEnglish) {
            systemPrompt = `You are Maya, a professional HR Specialist (HRD) and hiring coach. You are conducting an interactive roleplay. Conduct the entire interview strictly in English. Do not speak or respond in Indonesian or any other language under any circumstances. When you introduce yourself, use the name "Maya" (e.g. "I'm Maya from the HR team"). NEVER refer to yourself with a placeholder such as "[Your Name]", "[HR Name]", or "[Name]". ${nameInstruction}`;
          } else {
            systemPrompt = `You are Maya, a professional HR Specialist (HRD) and hiring coach. You are conducting an interactive roleplay. When you introduce yourself, use the name "Maya" (e.g. "I'm Maya from the HR team"). NEVER refer to yourself with a placeholder such as "[Your Name]", "[HR Name]", or "[Name]". ${nameInstruction} Always respond in the SAME language the candidate writes in (Indonesian or English).`;
          }

          let userPrompt = "";
          if (type === "recruiter") {
            userPrompt = `
  You are the HRD interviewer at ${company} conducting a first-round interview for a candidate applying for the ${role} position.
  ${scenario ? `Specific scenario context for this session (stay anchored to it):\n${scenario}\n` : ""}
  Welcome the candidate warmly, introduce yourself briefly as the HRD, set the context, and ask **ONLY** the FIRST standard introductory question (e.g. tell me about yourself and your interest in this role).${scenario ? " If the scenario context describes a concrete work task instead of an interview, open by presenting that task brief and ask how they would approach it." : ""}
  Keep your message short, engaging, and professional (max 3 sentences).
  `;
          } else {
            userPrompt = `
  You are the HR Hiring Negotiator. You have sent an initial offer of Rp 8.000.000/month to the candidate for a Junior ${role} position.
  ${scenario ? `Specific scenario context for this session (stay anchored to it):\n${scenario}\n` : ""}
  The standard market rate is Rp 9.500.000 to Rp 12.000.000.
  Create a warm initial greeting congratulating the candidate on the offer, present the initial Rp 8.000.000 figure, and ask them how they would like to respond to this offer.
  Keep your message brief and professional (max 3 sentences).
  `;
          }

          for (const model of modelChain) {
            try {
              const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "http://localhost:3000",
                  "X-Title": "Hi-Fi Readiness Simulation",
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                  ]
                }),
                signal: AbortSignal.timeout(12000)
              });

              if (response.status === 429 || response.status === 404) {
                console.warn(`[Simulation] Model ${model} returned ${response.status}, trying next...`);
                continue;
              }

              if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                  initialText = content.trim();
                  break;
                }
              }
            } catch (err) {
              console.warn(`[Simulation] Model ${model} threw an error:`, err);
            }
          }
        } catch (err) {
          console.error("Failed to generate custom starting question via OpenRouter:", err);
        }
      }
    }

    // Fallback starting text
    if (!initialText) {
      if (type === "recruiter") {
        if (companyName?.toLowerCase() === "gojek" && roleOverride === "Software Engineer") {
          initialText = `Welcome to Gojek. I'm Maya from the Engineering recruitment team. Let's start with a brief introduction. Can you tell me about your background and why you are interested in the Software Engineering role at Gojek?`;
        } else {
          initialText = `Welcome to your interview simulation at ${company} for the ${role} position. I'm Maya from the HR team, and I'll be your interviewer today. Let's begin! Can you please tell me about yourself and why you're interested in joining our company?`;
        }
      } else {
        initialText = `Let's practice salary negotiation! You have received a formal offer of Rp 8,000,000/month for a Junior ${role} role. The market average for this role is Rp 9,500,000 to 12,000,000. How would you like to respond to this offer?`;
      }
    }

    // 3. Save to database
    const simulation = await this.simulationRepository.createSimulation({
      user_id: userId,
      type,
      company_name: companyName,
    });

    const firstMessage = await this.simulationRepository.saveMessage({
      simulation_id: simulation.id,
      sender: "bot",
      text: initialText,
    });

    return { simulation, firstMessage };
  }

  async submitMessage(
    userId: string,
    simulationId: string,
    text: string
  ): Promise<{ botMessage?: SimulationMessage; result?: SimulationResult }> {
    // 1. Verify simulation ownership & status
    const sim = await this.simulationRepository.findSimulationById(simulationId, userId);
    if (!sim) {
      throw new Error("Simulation session not found");
    }

    if (sim.status === "completed") {
      throw new Error("Simulation has already been completed");
    }

    // 2. Save user's message
    await this.simulationRepository.saveMessage({
      simulation_id: simulationId,
      sender: "user",
      text,
    });

    const currentIndex = sim.current_question_index + 1; // Increment progress
    const history = await this.simulationRepository.getSimulationMessages(simulationId);
    const isEnglish = this.isEnglishSimulation(history);

    // Deterministic guard: if the candidate is disrespectful / uses profanity,
    // the HR persona responds firmly and professionally and does NOT advance
    // the interview, giving them a chance to continue respectfully. This holds
    // regardless of whether the AI model is reachable.
    if (this.isDisrespectful(text)) {
      const firmText = this.firmDisrespectResponse(
        isEnglish ? false : this.looksIndonesian(history, text),
      );
      const botMessage = await this.simulationRepository.saveMessage({
        simulation_id: simulationId,
        sender: "bot",
        text: firmText,
      });
      return { botMessage };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModel2 = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    const modelChain2 = [
      primaryModel2,
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash-lite:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    // Open-ended conversation: the interview is no longer capped at a fixed
    // number of questions. We always generate the next reply and keep chatting
    // until the user explicitly ends the session (or the front-end 30-minute
    // timer runs out and calls the /end endpoint).
    {
      let nextQuestionText = "";

      if (apiKey) {
        try {
          console.log(`[Simulation] Generating follow-up question (turn ${currentIndex + 1})...`);
          // NOTE: Do NOT tell the AI the total question count or call it "final".
          // Let the AI respond naturally to the conversation history.
          let systemPrompt = "";
          if (isEnglish) {
            systemPrompt = `You are a professional HR Specialist (HRD) named Maya conducting a job interview roleplay. Stay in character at all times, and behave like a real, self-respecting interviewer would.
Your role: Respond to the candidate's last answer appropriately, then naturally ask your next interview question.
Guidelines:
- Conduct the entire conversation strictly in English. Never speak or respond in Indonesian or any other language under any circumstances.
- CRITICAL — DISRESPECT & PROFANITY: If the candidate is rude, hostile, insulting, dismissive, or uses profanity/offensive language toward you (e.g. "anjing lu", "bodoh", swearing, name-calling), do NOT laugh it off, do NOT excuse it as a typo, and do NOT apologize as if you made a mistake. Respond firmly, calmly, and professionally the way a real HR would: directly name that the language/behavior is unprofessional and unacceptable in an interview, make clear that mutual respect is expected, and warn that conduct like this seriously harms their candidacy. Stay composed and assertive — never servile. Then give them one clear chance to continue respectfully.
- For harmless off-topic input only (e.g. a plain greeting like "hello", a "testing" message, or an obvious typo with no hostility), react briefly and lightly, then steer back to your pending question. Never apply this light treatment to genuine rudeness or profanity.
- Under NO circumstances answer questions unrelated to the interview (e.g., math, recipes, general knowledge); steer back to the interview.
- Address the candidate by their first name only if they have shared it; NEVER use placeholders like "[Candidate Name]".
- Do NOT mention question numbers, say "next question", or use labels like "Final question".
- Keep each response under 5 sentences total.
- Ask only ONE question per turn.
- Maintain a professional yet friendly tone throughout.`;
          } else {
            systemPrompt = `You are a professional HR Specialist (HRD) named Maya conducting a job interview roleplay. Stay in character at all times, and behave like a real, self-respecting interviewer would.
Your role: Respond to the candidate's last answer appropriately, then naturally ask your next interview question.
Guidelines:
- CRITICAL — DISRESPECT & PROFANITY: If the candidate is rude, hostile, insulting, dismissive, or uses profanity/offensive language toward you (e.g. "anjing lu", "bodoh", swearing, name-calling), do NOT laugh it off, do NOT excuse it as a typo, and do NOT apologize as if you made a mistake. Respond firmly, calmly, and professionally the way a real HR would: directly name that the language/behavior is unprofessional and unacceptable in an interview, make clear that mutual respect is expected, and warn that conduct like this seriously harms their candidacy. Stay composed and assertive — never servile. Then give them one clear chance to continue respectfully.
- For harmless off-topic input only (e.g. a plain greeting like "halo", a "testing" message, or an obvious typo with no hostility), react briefly and lightly, then steer back to your pending question. Never apply this light treatment to genuine rudeness or profanity.
- Under NO circumstances answer questions unrelated to the interview (e.g., math, recipes, general knowledge); steer back to the interview.
- Always respond in the SAME language the candidate writes in (Indonesian or English).
- Address the candidate by their first name only if they have shared it; NEVER use placeholders like "[Candidate Name]".
- Do NOT mention question numbers, say "next question", or use labels like "Final question".
- Keep each response under 5 sentences total.
- Ask only ONE question per turn.
- Maintain a professional yet friendly tone throughout.`;
          }

          const messagesForAi = history.map((m) => ({
            role: m.sender === "bot" ? "assistant" as const : "user" as const,
            content: m.text
          }));

          for (const model of modelChain2) {
            try {
              const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "http://localhost:3000",
                  "X-Title": "Hi-Fi Readiness Simulation",
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: systemPrompt },
                    ...messagesForAi,
                  ]
                }),
                signal: AbortSignal.timeout(12000)
              });

              if (response.status === 429 || response.status === 404) {
                console.warn(`[Simulation] Model ${model} returned ${response.status}, trying next...`);
                continue;
              }

              if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                  nextQuestionText = content.trim();
                  break;
                }
              }
            } catch (modelErr) {
              console.warn(`[Simulation] Model ${model} threw an error:`, modelErr);
            }
          }
        } catch (e) {
          console.error("[Simulation] Failed to generate dynamic question:", e);
        }
      }

      // Fallback questions if AI call failed — rotate through a pool so the
      // open-ended interview can continue naturally for any number of turns.
      if (!nextQuestionText) {
        nextQuestionText = this.fallbackFollowUp(sim.type, currentIndex, sim.company_name);
      }

      // Update simulation details & save bot message
      await this.simulationRepository.updateSimulationProgress(simulationId, userId, currentIndex, "ongoing");
      const botMessage = await this.simulationRepository.saveMessage({
        simulation_id: simulationId,
        sender: "bot",
        text: nextQuestionText,
      });

      return { botMessage };
    }
  }

  // Generate the final evaluation report and close the session. Triggered when
  // the user clicks "End Interview" or the 30-minute timer reaches zero.
  async endSimulation(
    userId: string,
    simulationId: string
  ): Promise<{ result: SimulationResult }> {
    const sim = await this.simulationRepository.findSimulationById(simulationId, userId);
    if (!sim) {
      throw new Error("Simulation session not found");
    }

    // Idempotent: if already completed, return the stored result.
    if (sim.status === "completed") {
      const existing = await this.simulationRepository.findResultBySimulationId(simulationId);
      if (existing) return { result: existing };
    }

    const history = await this.simulationRepository.getSimulationMessages(simulationId);
    const isEnglish = this.isEnglishSimulation(history);
    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModelEval = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    const modelChain2 = [
      primaryModelEval,
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash-lite:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    {
      console.log(`Simulation complete! Evaluating session ${simulationId}...`);
      let evalResult: any;

      if (apiKey) {
        try {
          const userObj = await this.userRepository.findById(userId);
          const role = isEnglish ? "Software Engineer" : (userObj?.target_role || "Software Engineer");
          const name = `${userObj?.first_name || "Candidate"} ${userObj?.last_name || ""}`.trim();
          const company = sim.company_name || "company";

          let systemPrompt = "";
          if (isEnglish) {
            systemPrompt = `You are a professional HR Specialist and master salary negotiator. Review the complete chat transcripts of a simulation and output a constructive evaluation report. Be honest and realistic: if the candidate was disrespectful, hostile, or used profanity/offensive language at any point, treat it as a serious professionalism failure — set "is_passed" to false, assign a low score (below 40), and address the unprofessional conduct directly and firmly in the feedback. You must output the entire report (including the feedback field) strictly in English.`;
          } else {
            systemPrompt = `You are a professional HR Specialist and master salary negotiator. Review the complete chat transcripts of a simulation and output a constructive evaluation report. Be honest and realistic: if the candidate was disrespectful, hostile, or used profanity/offensive language at any point, treat it as a serious professionalism failure — set "is_passed" to false, assign a low score (below 40), and address the unprofessional conduct directly and firmly in the feedback.`;
          }
          
          const transcriptText = history.map((m) => `${m.sender.toUpperCase()}: ${m.text}`).join("\n");
          
          let evaluationPrompt = "";
          if (sim.type === "recruiter") {
            evaluationPrompt = `
Analyze this standard interview transcript for ${name} applying for the ${role} position at ${company}:
${transcriptText}

Rate their answers and alignment. Return a JSON object with:
1. "is_passed": boolean (true if overall performance/answers are professional and score is >= 70)
2. "score": integer between 0 and 100
3. "feedback": string (use professional markdown headers: '### Review', '### Strengths', '### Weaknesses & Improvements'. Give highly professional, constructive suggestions in bullet points.)

Return ONLY valid JSON. No explanations, no markdown blocks outside JSON.
`;
          } else {
            evaluationPrompt = `
Analyze this salary negotiation transcript for ${name} negotiating a Junior ${role} position at ${company}:
${transcriptText}

Rate their negotiation capabilities. Return a JSON object with:
1. "is_passed": boolean (true if score is >= 70)
2. "score": integer between 0 and 100
3. "negotiated_salary": string (format: 'Rp X.XXX.XXX' representing the final salary outcome negotiated based on the conversation)
4. "feedback": string (use professional markdown headers: '### Negotiation Review', '### Strengths', '### Improvements'. Give constructive tips in bullet points.)

Return ONLY valid JSON. No explanations, no markdown blocks outside JSON.
`;
          }

          for (const model of modelChain2) {
            try {
              const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "http://localhost:3000",
                  "X-Title": "Hi-Fi Readiness Simulation",
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: evaluationPrompt }
                  ]
                }),
                signal: AbortSignal.timeout(18000)
              });

              if (response.status === 429 || response.status === 404) {
                console.warn(`[Simulation] Eval model ${model} returned ${response.status}, trying next...`);
                continue;
              }

              if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                  evalResult = this.extractJson(content);
                  break;
                }
              }
            } catch (modelErr) {
              console.warn(`[Simulation] Eval model ${model} threw:`, modelErr);
            }
          }
        } catch (e) {
          console.error("[Simulation] Failed to generate AI evaluation report:", e);
        }
      }

      // Dynamic fallback evaluation if AI call failed
      if (!evalResult) {
        evalResult = this.generateFallbackEvaluation(sim.type, history);
      }

      // Save result and close simulation
      await this.simulationRepository.updateSimulationProgress(simulationId, userId, sim.current_question_index, "completed");
      const result = await this.simulationRepository.saveResult({
        simulation_id: simulationId,
        is_passed: evalResult.is_passed ?? false,
        score: evalResult.score ?? 70,
        feedback: evalResult.feedback || "Evaluation complete.",
        negotiated_salary: evalResult.negotiated_salary,
      });

      return { result };
    }
  }

  async getDetails(userId: string, id: string): Promise<{ simulation: Simulation; messages: SimulationMessage[]; result?: SimulationResult | null }> {
    const simulation = await this.simulationRepository.findSimulationById(id, userId);
    if (!simulation) {
      throw new Error("Simulation not found");
    }

    const messages = await this.simulationRepository.getSimulationMessages(id);
    const result = await this.simulationRepository.findResultBySimulationId(id);

    return { simulation, messages, result };
  }
}
