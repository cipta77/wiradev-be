import { WebMvpRepository } from "../repositories/web-mvp.repository";

function normalizeString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeGoals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function goalToAchievementGoal(goal: string | undefined): string {
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

export class WebMvpService {
  private repository = new WebMvpRepository();

  async testDb() {
    const rows = await this.repository.getTotalUsers();
    return rows[0];
  }

  async getOnboarding() {
    const users = await this.repository.getLatestOnboardingUser();
    if (users.length === 0) return null;

    const user = users[0];
    const goals = await this.repository.getUserGoals(user.id);
    const documents = await this.repository.getUserDocuments(user.id);

    return { ...user, goals, documents };
  }

  async submitOnboarding(body: any) {
    const firstName = normalizeString(body.firstName || body.first_name, "Alex");
    const lastName = normalizeString(body.lastName || body.last_name, "Rahman");
    const university = normalizeString(body.university, "Universitas Contoh");
    const fieldOfStudy = normalizeString(body.fieldOfStudy || body.field_of_study, "Informatika");
    const graduationYearRaw = normalizeString(body.graduationYear || body.graduation_year, "2026");
    const graduationYearNumber = Number.parseInt(graduationYearRaw, 10);
    const graduationYear = Number.isNaN(graduationYearNumber) ? null : graduationYearNumber;
    const goals = normalizeGoals(body.goals);
    const name = `${firstName} ${lastName}`.trim();
    const email = normalizeString(body.email, `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}@wirapath.local`).toLowerCase();
    const cvFileName = normalizeString(body.cvFileName || body.cv_file_name, "skipped-cv.pdf");
    const transcriptFileName = normalizeString(body.transcriptFileName || body.transcript_file_name, "skipped-transcript.pdf");

    const userId = await this.repository.getOrCreateUserAccount(email, name);

    await this.repository.upsertProfile({
      userId,
      firstName,
      lastName,
      university,
      fieldOfStudy,
      graduationYearRaw,
    });

    await this.repository.replaceUserGoals(userId, goals);
    await this.repository.upsertUserDocument(userId, "cv", cvFileName, `/uploads/${cvFileName}`);
    await this.repository.upsertUserDocument(userId, "transcript", transcriptFileName, `/uploads/${transcriptFileName}`);

    try {
      await this.repository.syncUsersTable({
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
    } catch (error) {
      console.warn("Optional users table sync failed:", error);
    }

    return { userId, email, name, goals };
  }

  async getDashboardSummary(authUser?: any) {
    let user;
    let readinessScore = 62;

    if (authUser) {
      const name = [authUser.first_name, authUser.last_name].filter(Boolean).join(" ") || "Ubay Dillah";
      user = {
        name,
        role: authUser.target_role || authUser.field_of_study || "Frontend Developer",
      };

      const score = await this.repository.getUserReadinessScore(authUser.id);
      if (score !== null) readinessScore = score;
    } else {
      user = { name: "Ubay Dillah", role: "Frontend Developer" };
    }

    const initials = user.name
      ? user.name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "UD";

    return {
      name: user.name,
      role: user.role,
      initials,
      streak: 3,
      readinessScore,
      readinessTrend: "+8%",
    };
  }

  async getSkillGap(userId: string) {
    const latestAssessmentId = await this.repository.getLatestCompletedAssessmentId(userId);
    if (!latestAssessmentId) return [];

    const categoryResults = await this.repository.getCategoryScoresByAssessmentId(latestAssessmentId);

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

    return categoryResults.map((r) => {
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
  }

  getMarketDemand(role?: string) {
    const targetRole = role || "Frontend Developer";

    if (targetRole === "Frontend Developer") {
      return [
        { rank: 1, skill: "JavaScript / TypeScript", jobs_count: 18500, trend_score: 96, bar_width: 96 },
        { rank: 2, skill: "React / Next.js Frameworks", jobs_count: 15400, trend_score: 92, bar_width: 92 },
        { rank: 3, skill: "Responsive UI & CSS Engine", jobs_count: 11000, trend_score: 85, bar_width: 85 },
        { rank: 4, skill: "State Management (Redux/Zustand)", jobs_count: 8500, trend_score: 78, bar_width: 78 },
        { rank: 5, skill: "Accessibility Standards (WCAG)", jobs_count: 6000, trend_score: 72, bar_width: 72 },
      ];
    }
    if (targetRole === "Backend Developer") {
      return [
        { rank: 1, skill: "Node.js / Go / Python Runtime", jobs_count: 19000, trend_score: 95, bar_width: 95 },
        { rank: 2, skill: "SQL / NoSQL Database Design", jobs_count: 16500, trend_score: 90, bar_width: 90 },
        { rank: 3, skill: "API Gateways & Security Protocols", jobs_count: 14200, trend_score: 88, bar_width: 88 },
        { rank: 4, skill: "System Architecture & Caching", jobs_count: 11500, trend_score: 82, bar_width: 82 },
        { rank: 5, skill: "Docker & CI/CD Cloud DevOps", jobs_count: 9800, trend_score: 80, bar_width: 80 },
      ];
    }
    if (targetRole === "Data Scientist") {
      return [
        { rank: 1, skill: "Python & R Languages", jobs_count: 21000, trend_score: 97, bar_width: 97 },
        { rank: 2, skill: "Machine Learning Algorithms", jobs_count: 17200, trend_score: 93, bar_width: 93 },
        { rank: 3, skill: "SQL / Big Data Warehousing", jobs_count: 15800, trend_score: 91, bar_width: 91 },
        { rank: 4, skill: "Data Pipelines & ETL", jobs_count: 12500, trend_score: 86, bar_width: 86 },
        { rank: 5, skill: "Statistical Analysis & Math", jobs_count: 11000, trend_score: 80, bar_width: 80 },
      ];
    }
    if (targetRole === "UI/UX Designer") {
      return [
        { rank: 1, skill: "Figma & Interactive Prototyping", jobs_count: 14500, trend_score: 92, bar_width: 92 },
        { rank: 2, skill: "User Research & Personas", jobs_count: 12000, trend_score: 88, bar_width: 88 },
        { rank: 3, skill: "Frontend Integration (CSS/HTML)", jobs_count: 10500, trend_score: 82, bar_width: 82 },
        { rank: 4, skill: "Interaction Design System", jobs_count: 9000, trend_score: 80, bar_width: 80 },
        { rank: 5, skill: "Usability Testing Protocols", jobs_count: 8500, trend_score: 78, bar_width: 78 },
      ];
    }
    return [
      { rank: 1, skill: "Full Stack Web Development", jobs_count: 22000, trend_score: 96, bar_width: 96 },
      { rank: 2, skill: "Project Management & Git", jobs_count: 18000, trend_score: 90, bar_width: 90 },
      { rank: 3, skill: "API Integration & Databases", jobs_count: 15000, trend_score: 88, bar_width: 88 },
      { rank: 4, skill: "Mobile Responsive Layouts", jobs_count: 13000, trend_score: 84, bar_width: 84 },
      { rank: 5, skill: "UI Prototyping & Figma", jobs_count: 11000, trend_score: 80, bar_width: 80 },
    ];
  }
}
