import { AssessmentRepository } from "../repositories/assessment.repository";

interface QuestionAnswerPayload {
  question_id: string;
  user_answer: string;
}

export class AssessmentService {
  private repository = new AssessmentRepository();

  async getAssessmentCategories(role: string) {
    const mappedCategories = await this.repository.getMappedCategoriesByRole(role);
    if (mappedCategories.length > 0) return mappedCategories;
    return this.repository.getDefaultCategories();
  }

  async getAssessmentQuestions(role: string) {
    const mappedCategories = await this.repository.getMappedCategorySlugsByRole(role);
    const slugs = mappedCategories.length > 0 ? mappedCategories.map((c) => c.category_slug as string) : ["general_cs", "soft_skills", "other"];

    const categories = await this.repository.getCategoriesBySlugs(slugs);
    categories.sort((a, b) => slugs.indexOf(a.slug as string) - slugs.indexOf(b.slug as string));

    const finalResult = [];
    for (const cat of categories) {
      const dbQuestions = await this.repository.getActiveQuestionsByCategoryId(cat.id as string);

      const parsedQuestions = dbQuestions.map((q) => {
        let opts = q.options;
        if (typeof opts === "string") {
          try {
            opts = JSON.parse(opts);
          } catch {
            opts = null;
          }
        }
        return {
          id: q.id,
          question_type: q.question_type,
          question_text: q.question_text,
          options: opts || [],
        };
      });

      finalResult.push({ ...cat, questions: parsedQuestions });
    }
    return finalResult;
  }

  async startAssessment(userId: string): Promise<number | string> {
    const result = await this.repository.createAssessmentStart(userId);
    return result.insertId || result.info;
  }

  async submitAssessment(userId: string, answers: QuestionAnswerPayload[], timeTakenSeconds: number) {
    const assessmentId = await this.repository.generateUuid();
    await this.repository.createAssessmentWithId(assessmentId, userId, timeTakenSeconds || 0);

    let correctCount = 0;
    const totalCount = answers.length;

    for (const ans of answers) {
      const correctAnswer = await this.repository.getQuestionCorrectAnswer(ans.question_id);
      if (!correctAnswer) continue;

      const isCorrect = String(ans.user_answer).trim().toLowerCase() === correctAnswer.trim().toLowerCase();
      if (isCorrect) correctCount++;

      await this.repository.insertAssessmentAnswer(assessmentId, ans.question_id, ans.user_answer, isCorrect);
    }

    const scorePercentage = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    await this.repository.completeAssessment(assessmentId, totalCount, correctCount, scorePercentage);
    await this.repository.updateUserReadinessScore(userId, scorePercentage);

    return {
      assessment_id: assessmentId,
      total_questions: totalCount,
      correct_answers: correctCount,
      score_percentage: scorePercentage,
    };
  }

  async getAssessmentResult(userId: string, assessmentId: string) {
    const assessment = await this.repository.getAssessmentResultById(assessmentId, userId);
    if (assessment.length === 0) return null;
    const answers = await this.repository.getAssessmentAnswers(assessmentId);
    return { assessment: assessment[0], answers };
  }

  async getLatestAssessment(userId: string) {
    const latest = await this.repository.getLatestCompletedAssessment(userId);
    return latest.length > 0 ? latest[0] : null;
  }

  async getAssessmentAnalytics(userId: string) {
    const latest = await this.repository.getLatestCompletedAssessmentAnalytics(userId);
    if (latest.length === 0) {
      return { has_assessment: false };
    }

    const assessment = latest[0];
    const categoryResults = await this.repository.getCategoryResultsForAssessment(assessment.id as string);

    const REQUIRED_SCORES: Record<string, number> = {
      frontend: 75,
      backend: 75,
      data_science: 70,
      general_cs: 65,
      soft_skills: 60,
      other: 55,
      devops: 65,
      security: 70,
      mobile: 65,
      database: 70,
    };

    const categories = categoryResults.map((r) => {
      const total = Number(r.total);
      const correct = Number(r.correct || 0);
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      const required = REQUIRED_SCORES[r.slug as string] || 60;
      const gap = required - score;

      let status: "strong" | "moderate" | "gap" = "moderate";
      if (score >= 70) status = "strong";
      else if (score < 50) status = "gap";

      return {
        slug: r.slug,
        name: r.name,
        icon: r.icon,
        color: r.color,
        score,
        correct,
        total,
        required,
        gap,
        status,
      };
    });

    return {
      has_assessment: true,
      assessment_id: assessment.id,
      completed_at: assessment.completed_at,
      overall_score: Number(assessment.score_percentage),
      total_questions: Number(assessment.total_questions),
      correct_answers: Number(assessment.correct_answers),
      categories,
      strengths_count: categories.filter((c) => c.status === "strong").length,
      critical_gaps_count: categories.filter((c) => c.status === "gap").length,
      skills_mapped: categories.length,
    };
  }
}
