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

  async start(
    userId: string,
    type: "recruiter" | "salary",
    companyName?: string
  ): Promise<{ simulation: Simulation; firstMessage: SimulationMessage }> {
    // 1. Fetch User details for AI customization
    const user = await this.userRepository.findById(userId);
    const role = user?.target_role || "Software Engineer";
    const name = `${user?.first_name || "Candidate"} ${user?.last_name || ""}`.trim();
    const company = companyName || "this premium company";

    let initialText = "";

    // 2. Dynamic prompt for initial question
    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    const modelChain = [
      primaryModel,
      "openai/gpt-oss-120b:free",
      "z-ai/glm-4.5-air:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "poolside/laguna-m.1:free",
      "google/gemma-4-31b-it:free",
      "deepseek/deepseek-v4-flash:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    if (apiKey) {
      try {
        const systemPrompt = `You are a professional HR Specialist (HRD) and hiring coach. You are conducting an interactive roleplay.`;
        
        let userPrompt = "";
        if (type === "recruiter") {
          userPrompt = `
You are the HRD interviewer at ${company} conducting a first-round interview for candidate ${name} applying for the ${role} position.
Welcomes the candidate warmly, introduce yourself briefly as the HRD, set the context, and ask **ONLY** the FIRST standard introductory question (e.g. tell me about yourself and your interest in this role).
Keep your message short, engaging, and professional (max 3 sentences).
`;
        } else {
          userPrompt = `
You are the HR Hiring Negotiator. You have sent an initial offer of Rp 8.000.000/month to ${name} for a Junior ${role} position.
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

    // Fallback starting text
    if (!initialText) {
      if (type === "recruiter") {
        initialText = `Welcome to your interview simulation at ${company} for the ${role} position. I am the HR Director today. Let's begin! Can you please tell me about yourself and why you're interested in joining our company?`;
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    const primaryModel2 = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    const modelChain2 = [
      primaryModel2,
      "openai/gpt-oss-120b:free",
      "z-ai/glm-4.5-air:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "poolside/laguna-m.1:free",
      "google/gemma-4-31b-it:free",
      "deepseek/deepseek-v4-flash:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    // Scenario A: Keep chatting (up to 3 questions)
    if (currentIndex < 3) {
      let nextQuestionText = "";

      if (apiKey) {
        try {
          console.log(`[Simulation] Generating follow-up question (turn ${currentIndex + 1} of 3)...`);
          // NOTE: Do NOT tell the AI the total question count or call it "final".
          // Let the AI respond naturally to the conversation history.
          const systemPrompt = `You are a professional HR Specialist (HRD) named Maya conducting a job interview roleplay. Stay in character at all times.
Your role: Respond warmly to the candidate's last answer with a brief, genuine acknowledgement (1 sentence), then naturally ask your next interview question.
Guidelines:
- Do NOT mention question numbers, say "next question", or use labels like "Final question".
- Keep each response under 5 sentences total.
- Ask only ONE question per turn.
- Maintain a professional yet friendly tone throughout.`;

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

      // Fallback questions if AI call failed
      if (!nextQuestionText) {
        if (sim.type === "recruiter") {
          if (currentIndex === 1) {
            nextQuestionText = "Great points! Second question: Can you describe a challenging project or technical problem you solved, and how you approached it?";
          } else {
            nextQuestionText = "Interesting experience. Third question: How do you handle working under tight deadlines, or prioritizing tasks when requirements change?";
          }
        } else {
          if (currentIndex === 1) {
            nextQuestionText = "I appreciate your response, and we understand market rates. However, our initial budget is tight. Could we meet in the middle at Rp 9,000,000/month?";
          } else {
            nextQuestionText = "That's a fair point regarding value. If we confirm Rp 9,000,000/month, could we adjust your health or training benefits starting next quarter? What are your thoughts?";
          }
        }
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

    // Scenario B: Completed! Generate Final Evaluation Report
    else {
      console.log(`Simulation complete! Evaluating session ${simulationId}...`);
      let evalResult: any;

      if (apiKey) {
        try {
          const userObj = await this.userRepository.findById(userId);
          const role = userObj?.target_role || "Software Engineer";
          const name = `${userObj?.first_name || "Candidate"} ${userObj?.last_name || ""}`.trim();
          const company = sim.company_name || "company";

          const systemPrompt = `You are a professional HR Specialist and master salary negotiator. Review the complete chat transcripts of a simulation and output a constructive evaluation report.`;
          
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
      await this.simulationRepository.updateSimulationProgress(simulationId, userId, 3, "completed");
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
