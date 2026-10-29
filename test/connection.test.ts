import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pool, query, ensureGithubColumnsExist } from "../src/db/connection";

describe("Database Connection Module", () => {
  it("should export pool, query, and ensureGithubColumnsExist functions", () => {
    assert.ok(pool, "pool should be defined");
    assert.strictEqual(typeof query, "function", "query should be a function");
    assert.strictEqual(typeof ensureGithubColumnsExist, "function", "ensureGithubColumnsExist should be a function");
  });

  it("should have pool configured with expected default parameters", () => {
    const config = (pool as any).pool?.config?.connectionConfig;
    assert.ok(config, "connectionConfig should exist on pool");
    assert.strictEqual(config.port, parseInt(process.env.DB_PORT || "3306", 10));
    assert.strictEqual(config.host, process.env.DB_HOST || "localhost");
  });

  it("should not contain hardcoded VPS paths in src/db/connection.ts", () => {
    const filePath = path.join(process.cwd(), "src/db/connection.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(!content.includes("/home/wirakarsa"), "File must not contain hardcoded /home/wirakarsa VPS path");
    assert.ok(content.includes("dotenv.config();"), "File must contain standard clean dotenv.config();");
  });
});
