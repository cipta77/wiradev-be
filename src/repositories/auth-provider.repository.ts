import { query } from "../db/connection";
import { AuthProvider, CreateAuthProviderDTO } from "../types/user.types";
import crypto from "crypto";

export class AuthProviderRepository {
  async create(data: CreateAuthProviderDTO): Promise<AuthProvider> {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO auth_providers (id, user_id, provider, provider_user_id) 
      VALUES (?, ?, ?, ?)
    `;
    await query(sql, [id, data.user_id, data.provider, data.provider_user_id]);

    const createdProvider = await this.findById(id);
    if (!createdProvider) {
      throw new Error("Failed to retrieve created auth provider");
    }
    return createdProvider;
  }

  async findById(id: string): Promise<AuthProvider | null> {
    const sql = "SELECT * FROM auth_providers WHERE id = ?";
    const providers = await query<any[]>(sql, [id]);
    if (providers.length === 0) {
      return null;
    }
    return providers[0] as AuthProvider;
  }

  async findByProvider(provider: string, providerUserId: string): Promise<AuthProvider | null> {
    const sql = "SELECT * FROM auth_providers WHERE provider = ? AND provider_user_id = ?";
    const providers = await query<any[]>(sql, [provider, providerUserId]);
    if (providers.length === 0) {
      return null;
    }
    return providers[0] as AuthProvider;
  }

  async findByUserId(userId: string): Promise<AuthProvider[]> {
    const sql = "SELECT * FROM auth_providers WHERE user_id = ?";
    return await query<AuthProvider[]>(sql, [userId]);
  }
}
