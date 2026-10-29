import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Reusable async/await query function with generic return types
export const query = async <T = any>(sql: string, params?: any[]): Promise<T> => {
  const [results] = await pool.execute(sql, params);
  return results as T;
};

// Dynamically ensure GitHub integration columns exist in users table
export const ensureGithubColumnsExist = async (): Promise<void> => {
  try {
    const checkColumns = [
      { name: "github_username", type: "VARCHAR(255) NULL" },
      { name: "github_languages", type: "JSON NULL" },
      { name: "github_readiness_score", type: "DECIMAL(5,2) NULL" },
      { name: "github_last_synced_at", type: "TIMESTAMP NULL" },
    ];

    for (const col of checkColumns) {
      const rows = await query<any[]>(`SHOW COLUMNS FROM users LIKE '${col.name}'`);
      if (rows.length === 0) {
        console.log(`[Database] Column '${col.name}' not found in 'users' table. Adding it...`);
        await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[Database] Column '${col.name}' added successfully.`);
      }
    }
  } catch (error: any) {
    console.error("[Database] Error ensuring GitHub columns exist:", error);
  }
};
