import { Request, Response } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { query } from "../db/connection";

interface DbCategory extends RowDataPacket {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface DbQuestion extends RowDataPacket {
  id: string;
  category_id: string;
  question_type: "multiple_choice" | "yes_no";
  question_text: string;
  options: string | null;
  correct_answer: string;
  explanation: string;
}

interface QuestionAnswerPayload {
  question_id: string;
  user_answer: string;
}

export async function getAssessmentCategories(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const role = user.target_role || "Frontend Developer";

    // Find custom categories matching the role, order by priority
    const mappedCategories = await query<RowDataPacket[]>(
      `SELECT c.id, c.slug, c.name, c.description, c.icon, c.color 
       FROM role_category_mapping m
       JOIN assessment_categories c ON c.slug = m.category_slug
       WHERE m.target_role_pattern = ?
       ORDER BY m.priority ASC`,
      [role],
    );

    // If no matching mappings, default to other categories
    let finalCategories = mappedCategories;
    if (mappedCategories.length === 0) {
      finalCategories = await query<RowDataPacket[]>(
        `SELECT id, slug, name, description, icon, color 
         FROM assessment_categories 
         WHERE slug IN ('general_cs', 'soft_skills', 'other')
         ORDER BY FIELD(slug, 'general_cs', 'soft_skills', 'other')`,
      );
    }

    res.status(200).json({
      success: true,
      message: "Assessment categories retrieved successfully",
      result: finalCategories,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to load assessment categories",
      error: err.message,
    });
  }
}

export async function getAssessmentQuestions(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const role = user.target_role || "Frontend Developer";

    // Find mapped category slugs
    const mappedCategories = await query<RowDataPacket[]>(
      `SELECT category_slug FROM role_category_mapping WHERE target_role_pattern = ? ORDER BY priority ASC`,
      [role],
    );

    const slugs =
      mappedCategories.length > 0
        ? mappedCategories.map((c) => c.category_slug)
        : ["general_cs", "soft_skills", "other"];

    // Fetch categories with questions
    const categories = await query<DbCategory[]>(
      `SELECT id, slug, name, description, icon, color 
       FROM assessment_categories 
       WHERE slug IN (${slugs.map(() => "?").join(",")})`,
      slugs,
    );

    // Sort categories according to custom priority
    categories.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));

    const finalResult = [];

    for (const cat of categories) {
      const dbQuestions = await query<DbQuestion[]>(
        `SELECT id, category_id, question_type, question_text, options, correct_answer, explanation 
         FROM assessment_questions 
         WHERE category_id = ? AND is_active = TRUE
         ORDER BY sort_order ASC, created_at ASC`,
        [cat.id],
      );

      const parsedQuestions = dbQuestions.map((q) => {
        let opts = q.options;
        if (typeof opts === "string") {
          try {
            opts = JSON.parse(opts);
          } catch {
            opts = null;
          }
        }
        // Exclude correct_answer and explanation to prevent frontend cheating
        return {
          id: q.id,
          question_type: q.question_type,
          question_text: q.question_text,
          options: opts || [],
        };
      });

      finalResult.push({
        ...cat,
        questions: parsedQuestions,
      });
    }

    res.status(200).json({
      success: true,
      message: "Assessment questions retrieved successfully",
      result: finalResult,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to load assessment questions",
      error: err.message,
    });
  }
}

export async function startAssessment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Insert new user assessment record
    const result = await query<ResultSetHeader>(
      `INSERT INTO user_assessments (user_id) VALUES (?)`,
      [user.id],
    );

    res.status(201).json({
      success: true,
      message: "Assessment started successfully",
      result: {
        assessment_id: result.insertId || result.info,
      },
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to start assessment",
      error: err.message,
    });
  }
}

export async function submitAssessment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { answers, time_taken_seconds } = req.body;
    if (!Array.isArray(answers)) {
      res.status(400).json({
        success: false,
        message: "Invalid payload: 'answers' must be an array",
      });
      return;
    }

    // Create a new user assessment transaction
    const assessmentUuidResult = await query<RowDataPacket[]>(
      "SELECT UUID() as uuid",
    );
    const assessmentId = assessmentUuidResult[0].uuid;

    await query<ResultSetHeader>(
      `INSERT INTO user_assessments (id, user_id, time_taken_seconds) VALUES (?, ?, ?)`,
      [assessmentId, user.id, time_taken_seconds || 0],
    );

    let correctCount = 0;
    const totalCount = answers.length;

    const castAnswers = answers as QuestionAnswerPayload[];

    for (const ans of castAnswers) {
      const { question_id, user_answer } = ans;

      const qResult = await query<RowDataPacket[]>(
        `SELECT correct_answer FROM assessment_questions WHERE id = ? LIMIT 1`,
        [question_id],
      );

      if (qResult.length > 0) {
        const correctAnswer = qResult[0].correct_answer;
        const isCorrect =
          String(user_answer).trim().toLowerCase() ===
          correctAnswer.trim().toLowerCase();

        if (isCorrect) {
          correctCount++;
        }

        await query<ResultSetHeader>(
          `INSERT INTO user_assessment_answers (assessment_id, question_id, user_answer, is_correct)
           VALUES (?, ?, ?, ?)`,
          [assessmentId, question_id, user_answer, isCorrect],
        );
      }
    }

    const scorePercentage =
      totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    // Update assessment score & complete time
    await query<ResultSetHeader>(
      `UPDATE user_assessments 
       SET completed_at = CURRENT_TIMESTAMP, total_questions = ?, correct_answers = ?, score_percentage = ?
       WHERE id = ?`,
      [totalCount, correctCount, scorePercentage, assessmentId],
    );

    // Update user readiness score
    await query<ResultSetHeader>(
      `UPDATE users SET readiness_score = ? WHERE id = ?`,
      [scorePercentage, user.id],
    );

    res.status(200).json({
      success: true,
      message: "Assessment submitted successfully",
      result: {
        assessment_id: assessmentId,
        total_questions: totalCount,
        correct_answers: correctCount,
        score_percentage: scorePercentage,
      },
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to submit assessment",
      error: err.message,
    });
  }
}

export async function getAssessmentResult(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;

    const assessmentResult = await query<RowDataPacket[]>(
      `SELECT id, started_at, completed_at, time_taken_seconds, total_questions, correct_answers, score_percentage
       FROM user_assessments 
       WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, user.id],
    );

    if (assessmentResult.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Assessment result not found" });
      return;
    }

    const answersList = await query<RowDataPacket[]>(
      `SELECT uaa.question_id, uaa.user_answer, uaa.is_correct, aq.question_type, aq.correct_answer, aq.explanation
       FROM user_assessment_answers uaa
       JOIN assessment_questions aq ON aq.id = uaa.question_id
       WHERE uaa.assessment_id = ?`,
      [id],
    );

    res.status(200).json({
      success: true,
      message: "Assessment result retrieved successfully",
      result: {
        assessment: assessmentResult[0],
        answers: answersList,
      },
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to load assessment result",
      error: err.message,
    });
  }
}

export async function getLatestAssessment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const latest = await query<RowDataPacket[]>(
      `SELECT id, completed_at, score_percentage 
       FROM user_assessments 
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [user.id],
    );

    res.status(200).json({
      success: true,
      message: "Latest assessment status retrieved",
      result: latest.length > 0 ? latest[0] : null,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to fetch latest assessment",
      error: err.message,
    });
  }
}

export async function getAssessmentAnalytics(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const latest = await query<RowDataPacket[]>(
      `SELECT id, completed_at, total_questions, correct_answers, score_percentage 
       FROM user_assessments 
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [user.id],
    );

    if (latest.length === 0) {
      res.status(200).json({
        success: true,
        result: {
          has_assessment: false,
        },
      });
      return;
    }

    const assessment = latest[0];

    const categoryResults = await query<RowDataPacket[]>(
      `SELECT 
         c.slug,
         c.name,
         c.icon,
         c.color,
         COUNT(uaa.id) as total,
         SUM(CASE WHEN uaa.is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM user_assessment_answers uaa
       JOIN assessment_questions q ON q.id = uaa.question_id
       JOIN assessment_categories c ON c.id = q.category_id
       WHERE uaa.assessment_id = ?
       GROUP BY c.id`,
      [assessment.id],
    );

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
      const required = REQUIRED_SCORES[r.slug] || 60;
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

    const strengths_count = categories.filter(
      (c) => c.status === "strong",
    ).length;
    const critical_gaps_count = categories.filter(
      (c) => c.status === "gap",
    ).length;
    const skills_mapped = categories.length;

    res.status(200).json({
      success: true,
      result: {
        has_assessment: true,
        assessment_id: assessment.id,
        completed_at: assessment.completed_at,
        overall_score: Number(assessment.score_percentage),
        total_questions: Number(assessment.total_questions),
        correct_answers: Number(assessment.correct_answers),
        categories,
        strengths_count,
        critical_gaps_count,
        skills_mapped,
      },
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to generate assessment analytics",
      error: err.message,
    });
  }
}
