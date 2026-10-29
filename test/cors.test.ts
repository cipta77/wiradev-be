import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("CORS and Origin Alignment for Vercel", () => {
  // Simulates the CORS middleware implemented in src/main.ts
  const createCorsHandler = () => {
    return (req: any, res: any, next: () => void) => {
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.sendStatus(200);
        return;
      }
      next();
    };
  };

  const createMockResponse = () => {
    const headers: Record<string, string> = {};
    let statusCode: number | null = null;
    return {
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      sendStatus(code: number) {
        statusCode = code;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
      getStatusCode() {
        return statusCode;
      },
      headers,
    };
  };

  it("should reflect Vercel production origin with credentials", () => {
    const cors = createCorsHandler();
    const req = { headers: { origin: "https://wiradev.vercel.app" }, method: "GET" };
    const res = createMockResponse();
    let nextCalled = false;

    cors(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.getHeader("Access-Control-Allow-Origin"), "https://wiradev.vercel.app");
    assert.strictEqual(res.getHeader("Access-Control-Allow-Credentials"), "true");
    assert.ok(nextCalled, "next() should be called for GET request");
  });

  it("should reflect Vercel preview branch origins dynamically", () => {
    const cors = createCorsHandler();
    const req = { headers: { origin: "https://wiradev-git-milestone-preview.vercel.app" }, method: "POST" };
    const res = createMockResponse();
    let nextCalled = false;

    cors(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.getHeader("Access-Control-Allow-Origin"), "https://wiradev-git-milestone-preview.vercel.app");
    assert.strictEqual(res.getHeader("Access-Control-Allow-Credentials"), "true");
    assert.ok(nextCalled, "next() should be called for POST request");
  });

  it("should respond with 200 OK for OPTIONS preflight without calling next()", () => {
    const cors = createCorsHandler();
    const req = {
      headers: {
        origin: "https://wiradev.vercel.app",
        "access-control-request-method": "POST",
        "access-control-request-headers": "Content-Type, Authorization",
      },
      method: "OPTIONS",
    };
    const res = createMockResponse();
    let nextCalled = false;

    cors(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getHeader("Access-Control-Allow-Origin"), "https://wiradev.vercel.app");
    assert.strictEqual(res.getHeader("Access-Control-Allow-Credentials"), "true");
    assert.ok(res.getHeader("Access-Control-Allow-Methods")?.includes("POST"));
    assert.ok(res.getHeader("Access-Control-Allow-Headers")?.includes("Authorization"));
    assert.strictEqual(nextCalled, false, "next() should NOT be called on OPTIONS preflight");
  });

  it("should verify src/main.ts source code contains CORS and credentials configuration", () => {
    const mainPath = path.join(process.cwd(), "src/main.ts");
    const mainContent = fs.readFileSync(mainPath, "utf-8");

    assert.ok(mainContent.includes("Access-Control-Allow-Origin"), "main.ts must configure Access-Control-Allow-Origin");
    assert.ok(mainContent.includes("Access-Control-Allow-Credentials"), "main.ts must configure Access-Control-Allow-Credentials");
    assert.ok(mainContent.includes("Access-Control-Allow-Methods"), "main.ts must configure Access-Control-Allow-Methods");
    assert.ok(mainContent.includes("Access-Control-Allow-Headers"), "main.ts must configure Access-Control-Allow-Headers");
    assert.ok(mainContent.includes('req.method === "OPTIONS"'), "main.ts must handle preflight OPTIONS");
  });
});
