import { Request, Response } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { query } from "../db/connection";

type GoalRow = RowDataPacket & {
  id: number;
  name: string;
};

type UserAccountRow = RowDataPacket & {
  id: number;
  email: string;
  name: string | null;
};

type SkillRow = RowDataPacket & {
  id: number;
  skill_name: string;
  current_score: number;
  required_score: number;
  demand: string;
  priority: string;
};

function normalizeString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeGoals(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function goalToAchievementGoal(goal: string | undefined) {
  const map: Record<string, string> = {
    "Get my first job in tech": "GET_FIRST_JOB",
    "Switch to a developer role": "SWITCH_DEVELOPER_ROLE",
    "Improve my coding skills": "IMPROVE_CODING_SKILLS",
    "Prepare for technical interviews": "PREPARE_INTERVIEWS",
    "Build a strong portfolio": "BUILD_PORTFOLIO",
    "Understand market demands": "UNDERSTAND_MARKET",
  };

  return goal ? map[goal] || "UNDERSTAND_MARKET" : "UNDERSTAND_MARKET";
}

async function getOrCreateUserAccount(email: string, name: string) {
  const existing = await query<UserAccountRow[]>(
    "SELECT id, email, name FROM user_accounts WHERE email = ? LIMIT 1",
    [email],
  );

  if (existing.length > 0) {
    await query<ResultSetHeader>(
      "UPDATE user_accounts SET name = ? WHERE id = ?",
      [name, existing[0].id],
    );

    return existing[0].id;
  }

  const result = await query<ResultSetHeader>(
    "INSERT INTO user_accounts (email, name) VALUES (?, ?)",
    [email, name],
  );

  return result.insertId;
}

async function syncUsersTable(payload: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  university: string;
  fieldOfStudy: string;
  graduationYear: number | null;
  achievementGoal: string;
  cvUrl: string;
  transcriptUrl: string;
}) {
  try {
    await query<ResultSetHeader>(
      `INSERT INTO users
        (email, username, first_name, last_name, university, field_of_study, graduation_year, achievement_goal, cv_url, transcript_url, onboarding_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        university = VALUES(university),
        field_of_study = VALUES(field_of_study),
        graduation_year = VALUES(graduation_year),
        achievement_goal = VALUES(achievement_goal),
        cv_url = VALUES(cv_url),
        transcript_url = VALUES(transcript_url),
        onboarding_completed = 1,
        updated_at = CURRENT_TIMESTAMP`,
      [
        payload.email,
        payload.username,
        payload.firstName,
        payload.lastName,
        payload.university,
        payload.fieldOfStudy,
        payload.graduationYear,
        payload.achievementGoal,
        payload.cvUrl,
        payload.transcriptUrl,
      ],
    );
  } catch (error) {
    // users memakai UUID, sedangkan flow MVP web memakai user_accounts.
    // Kalau sync ke tabel users gagal, onboarding tetap dianggap berhasil selama user_accounts/profiles tersimpan.
    console.warn("Optional users table sync failed:", error);
  }
}

export async function testDb(req: Request, res: Response) {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT COUNT(*) AS totalUsers FROM user_accounts",
    );

    res.status(200).json({
      success: true,
      message: "Database connected successfully",
      data: rows[0],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
}

export async function getOnboarding(req: Request, res: Response) {
  try {
    const users = await query<RowDataPacket[]>(
      `SELECT
        ua.id,
        ua.email,
        ua.name,
        p.first_name,
        p.last_name,
        p.university,
        p.field_of_study,
        p.graduation_year
       FROM user_accounts ua
       LEFT JOIN profiles p ON p.user_id = ua.id
       ORDER BY ua.id DESC
       LIMIT 1`,
    );

    if (users.length === 0) {
      res.status(200).json({ success: true, data: null });
      return;
    }

    const goals = await query<RowDataPacket[]>(
      `SELECT g.id, g.name
       FROM user_goals ug
       JOIN goals g ON g.id = ug.goal_id
       WHERE ug.user_id = ?
       ORDER BY g.id ASC`,
      [users[0].id],
    );

    const documents = await query<RowDataPacket[]>(
      `SELECT document_type, file_name, file_url
       FROM user_documents
       WHERE user_id = ?`,
      [users[0].id],
    );

    res.status(200).json({
      success: true,
      data: {
        ...users[0],
        goals,
        documents,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to load onboarding data",
      error: error.message,
    });
  }
}

export async function submitOnboarding(req: Request, res: Response) {
  try {
    const firstName = normalizeString(
      req.body.firstName || req.body.first_name,
      "Alex",
    );
    const lastName = normalizeString(
      req.body.lastName || req.body.last_name,
      "Rahman",
    );
    const university = normalizeString(
      req.body.university,
      "Universitas Contoh",
    );
    const fieldOfStudy = normalizeString(
      req.body.fieldOfStudy || req.body.field_of_study,
      "Informatika",
    );
    const graduationYearRaw = normalizeString(
      req.body.graduationYear || req.body.graduation_year,
      "2026",
    );
    const graduationYearNumber = Number.parseInt(graduationYearRaw, 10);
    const graduationYear = Number.isNaN(graduationYearNumber)
      ? null
      : graduationYearNumber;
    const goals = normalizeGoals(req.body.goals);
    const name = `${firstName} ${lastName}`.trim();
    const email = normalizeString(
      req.body.email,
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}@wirapath.local`,
    ).toLowerCase();

    const cvFileName = normalizeString(
      req.body.cvFileName || req.body.cv_file_name,
      "skipped-cv.pdf",
    );
    const transcriptFileName = normalizeString(
      req.body.transcriptFileName || req.body.transcript_file_name,
      "skipped-transcript.pdf",
    );

    const userId = await getOrCreateUserAccount(email, name);

    await query<ResultSetHeader>(
      `INSERT INTO profiles (user_id, first_name, last_name, university, field_of_study, graduation_year)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        university = VALUES(university),
        field_of_study = VALUES(field_of_study),
        graduation_year = VALUES(graduation_year),
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        firstName,
        lastName,
        university,
        fieldOfStudy,
        graduationYearRaw,
      ],
    );

    await query<ResultSetHeader>("DELETE FROM user_goals WHERE user_id = ?", [
      userId,
    ]);

    if (goals.length > 0) {
      const goalRows = await query<GoalRow[]>(
        `SELECT id, name FROM goals WHERE name IN (${goals.map(() => "?").join(",")})`,
        goals,
      );

      for (const goal of goalRows) {
        await query<ResultSetHeader>(
          "INSERT IGNORE INTO user_goals (user_id, goal_id) VALUES (?, ?)",
          [userId, goal.id],
        );
      }
    }

    await query<ResultSetHeader>(
      `INSERT INTO user_documents (user_id, document_type, file_name, file_url)
       VALUES (?, 'cv', ?, ?)
       ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), file_url = VALUES(file_url)`,
      [userId, cvFileName, `/uploads/${cvFileName}`],
    );

    await query<ResultSetHeader>(
      `INSERT INTO user_documents (user_id, document_type, file_name, file_url)
       VALUES (?, 'transcript', ?, ?)
       ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), file_url = VALUES(file_url)`,
      [userId, transcriptFileName, `/uploads/${transcriptFileName}`],
    );

    await syncUsersTable({
      email,
      username: email.split("@")[0],
      firstName,
      lastName,
      university,
      fieldOfStudy,
      graduationYear,
      achievementGoal: goalToAchievementGoal(goals[0]),
      cvUrl: `/uploads/${cvFileName}`,
      transcriptUrl: `/uploads/${transcriptFileName}`,
    });

    res.status(201).json({
      success: true,
      message: "Onboarding saved successfully",
      data: {
        userId,
        email,
        name,
        goals,
      },
    });
  } catch (error: any) {
    console.error("submitOnboarding error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save onboarding",
      error: error.message,
    });
  }
}

export async function getDashboardSummary(req: Request, res: Response) {
  try {
    const authUser = req.user;

    let user;
    let readinessScore = 62;
    if (authUser) {
      const name =
        [authUser.first_name, authUser.last_name].filter(Boolean).join(" ") ||
        "Ubay Dillah";
      user = {
        name: name,
        role:
          authUser.target_role ||
          authUser.field_of_study ||
          "Frontend Developer",
      };

      // Pull dynamic readiness score from DB
      const userDb = await query<RowDataPacket[]>(
        "SELECT readiness_score FROM users WHERE id = ? LIMIT 1",
        [authUser.id],
      );
      if (userDb.length > 0 && userDb[0].readiness_score !== null) {
        readinessScore = Math.round(Number(userDb[0].readiness_score));
      }
    } else {
      user = {
        name: "Ubay Dillah",
        role: "Frontend Developer",
      };
    }

    const initials = user.name
      ? user.name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "UD";

    res.status(200).json({
      message: "Dashboard summary retrieved successfully",
      result: {
        name: user.name,
        role: user.role,
        initials: initials,
        streak: 3,
        readinessScore: readinessScore,
        readinessTrend: "+8%",
      },
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard summary",
      error: err.message,
    });
  }
}

export async function getSkillGap(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const latest = await query<RowDataPacket[]>(
      `SELECT id FROM user_assessments 
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [user.id],
    );

    if (latest.length === 0) {
      res.status(200).json({
        message: "No assessment found",
        result: [],
      });
      return;
    }

    const assessmentId = latest[0].id;

    const categoryResults = await query<RowDataPacket[]>(
      `SELECT 
         c.slug,
         c.name,
         COUNT(uaa.id) as total,
         SUM(CASE WHEN uaa.is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM user_assessment_answers uaa
       JOIN assessment_questions q ON q.id = uaa.question_id
       JOIN assessment_categories c ON c.id = q.category_id
       WHERE uaa.assessment_id = ?
       GROUP BY c.id`,
      [assessmentId],
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

    const DEMAND_LEVELS: Record<string, string> = {
      frontend: "High",
      backend: "High",
      data_science: "High",
      general_cs: "Medium",
      soft_skills: "Medium",
      other: "Low",
      devops: "High",
      security: "High",
      mobile: "Medium",
      database: "High",
    };

    const result = categoryResults.map((r) => {
      const total = Number(r.total);
      const correct = Number(r.correct || 0);
      const current = total > 0 ? Math.round((correct / total) * 100) : 0;
      const required = REQUIRED_SCORES[r.slug] || 60;
      const gap = required - current;

      let priority = "Low";
      if (gap > 10) priority = "Critical";
      else if (gap > 0) priority = "High";
      else if (gap > -10) priority = "Medium";

      return {
        skill: r.name,
        current,
        required,
        demand: DEMAND_LEVELS[r.slug] || "Medium",
        priority,
      };
    });

    res.status(200).json({
      message: "Skill gap retrieved successfully",
      result,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to load skill gap",
      error: err.message,
    });
  }
}

export async function getMarketDemand(req: Request, res: Response) {
  try {
    const user = req.user;
    const role = user?.target_role || "Frontend Developer";

    let demandData: Array<{
      rank: number;
      skill: string;
      jobs_count: number;
      trend_score: number;
      bar_width: number;
    }> = [];

    if (role === "Frontend Developer") {
      demandData = [
        {
          rank: 1,
          skill: "JavaScript / TypeScript",
          jobs_count: 18500,
          trend_score: 96,
          bar_width: 96,
        },
        {
          rank: 2,
          skill: "React / Next.js Frameworks",
          jobs_count: 15400,
          trend_score: 92,
          bar_width: 92,
        },
        {
          rank: 3,
          skill: "Responsive UI & CSS Engine",
          jobs_count: 11000,
          trend_score: 85,
          bar_width: 85,
        },
        {
          rank: 4,
          skill: "State Management (Redux/Zustand)",
          jobs_count: 8500,
          trend_score: 78,
          bar_width: 78,
        },
        {
          rank: 5,
          skill: "Accessibility Standards (WCAG)",
          jobs_count: 6000,
          trend_score: 72,
          bar_width: 72,
        },
      ];
    } else if (role === "Backend Developer") {
      demandData = [
        {
          rank: 1,
          skill: "Node.js / Go / Python Runtime",
          jobs_count: 19000,
          trend_score: 95,
          bar_width: 95,
        },
        {
          rank: 2,
          skill: "SQL / NoSQL Database Design",
          jobs_count: 16500,
          trend_score: 90,
          bar_width: 90,
        },
        {
          rank: 3,
          skill: "API Gateways & Security Protocols",
          jobs_count: 14200,
          trend_score: 88,
          bar_width: 88,
        },
        {
          rank: 4,
          skill: "System Architecture & Caching",
          jobs_count: 11500,
          trend_score: 82,
          bar_width: 82,
        },
        {
          rank: 5,
          skill: "Docker & CI/CD Cloud DevOps",
          jobs_count: 9800,
          trend_score: 80,
          bar_width: 80,
        },
      ];
    } else if (role === "Data Scientist") {
      demandData = [
        {
          rank: 1,
          skill: "Python & R Languages",
          jobs_count: 21000,
          trend_score: 97,
          bar_width: 97,
        },
        {
          rank: 2,
          skill: "Machine Learning Algorithms",
          jobs_count: 17200,
          trend_score: 93,
          bar_width: 93,
        },
        {
          rank: 3,
          skill: "SQL / Big Data Warehousing",
          jobs_count: 15800,
          trend_score: 91,
          bar_width: 91,
        },
        {
          rank: 4,
          skill: "Data Pipelines & ETL",
          jobs_count: 12500,
          trend_score: 86,
          bar_width: 86,
        },
        {
          rank: 5,
          skill: "Statistical Analysis & Math",
          jobs_count: 11000,
          trend_score: 80,
          bar_width: 80,
        },
      ];
    } else if (role === "UI/UX Designer") {
      demandData = [
        {
          rank: 1,
          skill: "Figma & Interactive Prototyping",
          jobs_count: 14500,
          trend_score: 92,
          bar_width: 92,
        },
        {
          rank: 2,
          skill: "User Research & Personas",
          jobs_count: 12000,
          trend_score: 88,
          bar_width: 88,
        },
        {
          rank: 3,
          skill: "Frontend Integration (CSS/HTML)",
          jobs_count: 10500,
          trend_score: 82,
          bar_width: 82,
        },
        {
          rank: 4,
          skill: "Interaction Design System",
          jobs_count: 9000,
          trend_score: 80,
          bar_width: 80,
        },
        {
          rank: 5,
          skill: "Usability Testing Protocols",
          jobs_count: 8500,
          trend_score: 78,
          bar_width: 78,
        },
      ];
    } else {
      demandData = [
        {
          rank: 1,
          skill: "Full Stack Web Development",
          jobs_count: 22000,
          trend_score: 96,
          bar_width: 96,
        },
        {
          rank: 2,
          skill: "Project Management & Git",
          jobs_count: 18000,
          trend_score: 90,
          bar_width: 90,
        },
        {
          rank: 3,
          skill: "API Integration & Databases",
          jobs_count: 15000,
          trend_score: 88,
          bar_width: 88,
        },
        {
          rank: 4,
          skill: "Mobile Responsive Layouts",
          jobs_count: 13000,
          trend_score: 84,
          bar_width: 84,
        },
        {
          rank: 5,
          skill: "UI Prototyping & Figma",
          jobs_count: 11000,
          trend_score: 80,
          bar_width: 80,
        },
      ];
    }

    res.status(200).json({
      message: "Market demand retrieved successfully",
      result: demandData,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: "Failed to load market demand",
      error: err.message,
    });
  }
}
