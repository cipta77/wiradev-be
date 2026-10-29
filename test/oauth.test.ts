import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuthController } from "../src/controllers/auth.controller";
import authRoutes from "../src/routes/auth.routes";

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (data: any) => MockResponse;
  cookie: (name: string, val: any, opts: any) => MockResponse;
  clearCookie: (name: string, opts: any) => MockResponse;
  redirect: (url: string) => MockResponse;
  getStatusCode: () => number;
  getJsonBody: () => any;
  getCookies: () => Record<string, any>;
}

const createMockReq = (
  body: Record<string, any> = {},
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
  cookies: Record<string, string> = {}
) => ({
  body,
  headers,
  query,
  cookies,
});

const createMockRes = (): MockResponse => {
  let statusCode = 200;
  let jsonBody: any = null;
  const cookies: Record<string, any> = {};

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      jsonBody = data;
      return res;
    },
    cookie(name: string, val: any, opts: any) {
      cookies[name] = { val, opts };
      return res;
    },
    clearCookie(name: string, opts: any) {
      cookies[name] = { cleared: true, opts };
      return res;
    },
    redirect(url: string) {
      jsonBody = { redirectUrl: url };
      return res;
    },
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody,
    getCookies: () => cookies,
  };
  return res;
};

describe("OAuth Endpoint Input Validation & Route Contracts", () => {
  const authController = new AuthController();

  describe("Google OAuth Input Validation", () => {
    it("should return HTTP 400 when idToken is missing from request body", async () => {
      const req = createMockReq({});
      const res = createMockRes();

      await authController.googleLogin(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.deepStrictEqual(res.getJsonBody(), {
        message: "idToken is required",
      });
    });

    it("should return HTTP 400 when idToken is an empty string", async () => {
      const req = createMockReq({ idToken: "" });
      const res = createMockRes();

      await authController.googleLogin(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.deepStrictEqual(res.getJsonBody(), {
        message: "idToken is required",
      });
    });

    it("should return HTTP 400 when invalid idToken fails Google verification", async () => {
      const req = createMockReq({ idToken: "invalid_mock_google_token" });
      const res = createMockRes();

      await authController.googleLogin(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.ok(
        res.getJsonBody()?.message,
        "Should return an error message when Google tokeninfo rejects the token"
      );
    });

    it("should redirect properly in googleMobileLogin", async () => {
      const req = createMockReq({}, {}, { redirect_uri: "wirapath://oauth-callback" });
      const res = createMockRes();

      await authController.googleMobileLogin(req as any, res as any);

      const body = res.getJsonBody();
      assert.ok(body?.redirectUrl?.includes("/google-login"), "Must redirect to /google-login");
      assert.ok(
        body?.redirectUrl?.includes("redirect_uri=wirapath%3A%2F%2Foauth-callback"),
        "Must preserve redirect_uri parameter"
      );
    });
  });

  describe("GitHub OAuth Input Validation", () => {
    it("should return HTTP 400 when code is missing from request body", async () => {
      const req = createMockReq({});
      const res = createMockRes();

      await authController.githubLogin(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.deepStrictEqual(res.getJsonBody(), {
        message: "code is required",
      });
    });

    it("should return HTTP 400 when code is an empty string", async () => {
      const req = createMockReq({ code: "" });
      const res = createMockRes();

      await authController.githubLogin(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.deepStrictEqual(res.getJsonBody(), {
        message: "code is required",
      });
    });

    it("should return HTTP 400 when GitHub credentials are unconfigured or code is invalid", async () => {
      const req = createMockReq({ code: "invalid_oauth_code" });
      const res = createMockRes();

      await authController.githubLogin(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.ok(
        res.getJsonBody()?.message,
        "Should return an error message for invalid GitHub OAuth exchange"
      );
    });

    it("should redirect properly in githubMobileLogin", async () => {
      const req = createMockReq(
        {},
        {},
        { redirect_uri: "wirapath://oauth-callback", is_signup: "true" }
      );
      const res = createMockRes();

      await authController.githubMobileLogin(req as any, res as any);

      const body = res.getJsonBody();
      assert.ok(body?.redirectUrl?.includes("/github-login"), "Must redirect to /github-login");
      assert.ok(body?.redirectUrl?.includes("redirect_uri=wirapath%3A%2F%2Foauth-callback"));
      assert.ok(body?.redirectUrl?.includes("is_signup=true"));
    });
  });

  describe("Session & Token Refresh Endpoint Contracts", () => {
    it("should return HTTP 400 when refresh token is missing", async () => {
      const req = createMockReq({});
      const res = createMockRes();

      await authController.refresh(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.deepStrictEqual(res.getJsonBody(), {
        message: "Refresh token is required",
      });
    });

    it("should return HTTP 401 on /me when unauthenticated", async () => {
      const req = createMockReq();
      const res = createMockRes();

      await authController.me(req as any, res as any);

      assert.strictEqual(res.getStatusCode(), 401);
      assert.deepStrictEqual(res.getJsonBody(), {
        message: "Unauthorized",
      });
    });
  });

  describe("Express Auth Route Integrity & HTTP Methods", () => {
    it("should have all required OAuth and authentication routes configured", () => {
      const stack = (authRoutes as any).stack || [];
      const routeLayers = stack.filter((layer: any) => layer.route);

      const routeMap = new Map<string, string[]>();
      for (const layer of routeLayers) {
        const path = layer.route.path;
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        routeMap.set(path, methods);
      }

      // Check /google
      assert.ok(routeMap.has("/google"), "authRoutes must register /google");
      assert.ok(routeMap.get("/google")?.includes("POST"), "/google must handle POST");

      // Check /github
      assert.ok(routeMap.has("/github"), "authRoutes must register /github");
      assert.ok(routeMap.get("/github")?.includes("POST"), "/github must handle POST");

      // Check /refresh
      assert.ok(routeMap.has("/refresh"), "authRoutes must register /refresh");
      assert.ok(routeMap.get("/refresh")?.includes("POST"), "/refresh must handle POST");

      // Check /me
      assert.ok(routeMap.has("/me"), "authRoutes must register /me");
      assert.ok(routeMap.get("/me")?.includes("GET"), "/me must handle GET");

      // Check /login and /register
      assert.ok(routeMap.has("/login"), "authRoutes must register /login");
      assert.ok(routeMap.has("/register"), "authRoutes must register /register");
    });
  });
});
