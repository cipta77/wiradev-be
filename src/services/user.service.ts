import { UserRepository } from "../repositories/user.repository";
import { AuthProviderRepository } from "../repositories/auth-provider.repository";
import { User, CreateUserDTO, AuthProvider, OnboardingProfileDTO, OnboardingGoalDTO, AccountSettingsDTO, UpdatePasswordDTO, OnboardingRoleDTO } from "../types/user.types";
import bcrypt from "bcryptjs";
import { query } from "../db/connection";

export class UserService {
  private userRepository = new UserRepository();
  private authProviderRepository = new AuthProviderRepository();

  async register(data: CreateUserDTO): Promise<User> {
    const existingEmail = await this.userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new Error("Email already registered");
    }

    if (data.username) {
      const existingUsername = await this.userRepository.findByUsername(data.username);
      if (existingUsername) {
        throw new Error("Username already taken");
      }
    }

    return await this.userRepository.create(data);
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }

    const providers = await this.authProviderRepository.findByUserId(id);
    const providerNames = providers.map((p) => p.provider);

    return {
      ...user,
      providers: providerNames,
    } as any;
  }

  async linkProvider(userId: string, provider: string, providerUserId: string): Promise<AuthProvider> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const existingLink = await this.authProviderRepository.findByProvider(provider, providerUserId);
    if (existingLink) {
      throw new Error("Auth provider already linked to another account");
    }

    return await this.authProviderRepository.create({
      user_id: userId,
      provider,
      provider_user_id: providerUserId,
    });
  }

  async updateProfile(userId: string, data: OnboardingProfileDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.updateProfile(userId, data);
    
    return this.getUserById(userId);
  }

  async updateGoal(userId: string, data: OnboardingGoalDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.updateGoal(userId, data);
    
    return this.getUserById(userId);
  }

  async updateRole(userId: string, data: OnboardingRoleDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.updateRole(userId, data);
    
    return this.getUserById(userId);
  }

  async updateDocuments(userId: string, cvUrl: string | null, transcriptUrl: string | null): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.updateDocuments(userId, cvUrl, transcriptUrl);
    
    return this.getUserById(userId);
  }

  async completeOnboardingStatus(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepository.completeOnboardingStatus(userId);
    
    return this.getUserById(userId);
  }

  async updateAccountSettings(userId: string, data: AccountSettingsDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (data.email.toLowerCase() !== user.email.toLowerCase()) {
      const existingEmail = await this.userRepository.findByEmail(data.email);
      if (existingEmail) {
        throw new Error("Email already registered by another account");
      }
    }

    await this.userRepository.updateAccountSettings(userId, data);
    
    return this.getUserById(userId);
  }

  async updatePassword(userId: string, data: UpdatePasswordDTO): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!data.new_password || data.new_password.length < 6) {
      throw new Error("New password must be at least 6 characters long");
    }

    if (user.password_hash) {
      if (!data.current_password) {
        throw new Error("Current password is required");
      }
      const isPasswordValid = await bcrypt.compare(data.current_password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error("Incorrect current password");
      }
    }

    const newPasswordHash = await bcrypt.hash(data.new_password, 10);
    await this.userRepository.updatePasswordHash(userId, newPasswordHash);

    return this.getUserById(userId);
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const existing = await this.userRepository.findByUsername(username);
    if (existing && existing.id !== userId) {
      throw new Error("Username already taken");
    }

    await this.userRepository.updateUsername(userId, username);
    return this.getUserById(userId);
  }

  async syncGitHub(userId: string, githubUsername?: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const username = githubUsername || user.github_username || user.username;
    if (!username) {
      throw new Error("GitHub username is required for syncing. Connect your GitHub account first.");
    }

    // 1. Fetch public repositories from GitHub API
    const headers: Record<string, string> = {
      "User-Agent": "Wirapath-OAuth-Integration",
      "Accept": "application/json",
    };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    let repos: any[] = [];
    try {
      const response = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, { headers });
      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}: ${response.statusText}`);
      }
      repos = await response.json() as any[];
    } catch (fetchError: any) {
      throw new Error(`Failed to fetch repositories from GitHub: ${fetchError.message}`);
    }

    // 2. Aggregate language stats by size
    const languageStats: Record<string, number> = {};
    let totalSize = 0;
    let repoCount = 0;

    for (const repo of repos) {
      if (repo.language) {
        const lang = repo.language;
        const size = repo.size || 0;
        languageStats[lang] = (languageStats[lang] || 0) + size;
        totalSize += size;
        repoCount++;
      }
    }

    // 3. Calculate percentages
    const languagePercentages: Record<string, number> = {};
    if (totalSize > 0) {
      for (const [lang, size] of Object.entries(languageStats)) {
        languagePercentages[lang] = Math.round((size / totalSize) * 100);
      }
    }

    // 4. Calculate target-role alignment score
    const targetRole = user.target_role || "Frontend Developer";
    const roleWeights: Record<string, Record<string, number>> = {
      "Frontend Developer": {
        TypeScript: 1.0, JavaScript: 1.0, CSS: 1.0, HTML: 1.0, Vue: 1.0, Svelte: 1.0, SCSS: 1.0, Less: 1.0,
        Python: 0.5, Go: 0.5, Ruby: 0.5, PHP: 0.5, Swift: 0.5, Kotlin: 0.5, Dart: 0.5
      },
      "Backend Developer": {
        Go: 1.0, Python: 1.0, Java: 1.0, JavaScript: 1.0, TypeScript: 1.0, "C#": 1.0, PHP: 1.0, Ruby: 1.0, Rust: 1.0, "C++": 1.0, SQL: 1.0,
        Shell: 0.5, HTML: 0.5, CSS: 0.5, Kotlin: 0.5, Swift: 0.5
      },
      "Data Scientist": {
        Python: 1.0, R: 1.0, "Jupyter Notebook": 1.0, Julia: 1.0, Scala: 1.0, MATLAB: 1.0, SQL: 1.0,
        "C++": 0.5, Java: 0.5, Go: 0.5, Rust: 0.5
      },
      "UI/UX Designer": {
        HTML: 1.0, CSS: 1.0, JavaScript: 1.0, TypeScript: 1.0
      }
    };

    const defaultWeights: Record<string, number> = {
      JavaScript: 1.0, TypeScript: 1.0, Python: 1.0, Go: 1.0, Java: 1.0, "C++": 1.0, "C#": 1.0, Ruby: 1.0, PHP: 1.0, Rust: 1.0
    };

    const weights = roleWeights[targetRole] || defaultWeights;
    let weightedScoreSum = 0;

    if (totalSize > 0) {
      for (const [lang, pct] of Object.entries(languagePercentages)) {
        const weight = weights[lang] !== undefined ? weights[lang] : 0.1;
        weightedScoreSum += pct * weight;
      }
    }

    const baseAlignmentScore = Math.min(100, Math.max(0, weightedScoreSum));
    
    // 5. Apply experience scaling based on repository count
    const experienceFactor = Math.min(1.0, repoCount / 3);
    const githubReadinessScore = Math.round(baseAlignmentScore * (0.5 + 0.5 * experienceFactor));

    // 6. Blend with latest assessment score if available
    const latestAssessment = await query<any[]>(
      `SELECT score_percentage FROM user_assessments 
       WHERE user_id = ? AND completed_at IS NOT NULL 
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    let overallReadinessScore = githubReadinessScore;
    if (latestAssessment.length > 0) {
      const assessmentScore = Number(latestAssessment[0].score_percentage || 0);
      overallReadinessScore = Math.round((assessmentScore + githubReadinessScore) / 2);
    }

    // 7. Update database
    await this.userRepository.updateGithubIntegration(
      userId,
      username,
      languagePercentages,
      githubReadinessScore,
      overallReadinessScore
    );

    // Recompute the overall readiness as a blend of all available signals
    // (assessment + CV analysis + GitHub) so the CV analysis is reflected too.
    await this.userRepository.recomputeReadinessScore(userId);

    return this.getUserById(userId);
  }
}
