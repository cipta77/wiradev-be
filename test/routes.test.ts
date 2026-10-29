import { describe, it } from "node:test";
import assert from "node:assert/strict";
import authRoutes from "../src/routes/auth.routes";
import userRoutes from "../src/routes/user.routes";
import webMvpRoutes from "../src/routes/webMvp.routes";

describe("Express Routes Integrity", () => {
  it("should define auth routes for Google, GitHub, and session management", () => {
    assert.ok(authRoutes, "authRoutes should be defined");
    assert.strictEqual(typeof authRoutes, "function", "authRoutes should be an Express Router");

    // Check registered route paths in authRoutes router stack
    const stack = (authRoutes as any).stack || [];
    const registeredPaths = stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    assert.ok(registeredPaths.includes("/register"), "Must have /register route");
    assert.ok(registeredPaths.includes("/login"), "Must have /login route");
    assert.ok(registeredPaths.includes("/google"), "Must have /google route");
    assert.ok(registeredPaths.includes("/github"), "Must have /github route");
    assert.ok(registeredPaths.includes("/refresh"), "Must have /refresh route");
    assert.ok(registeredPaths.includes("/logout"), "Must have /logout route");
    assert.ok(registeredPaths.includes("/me"), "Must have /me route");
  });

  it("should define user routes router", () => {
    assert.ok(userRoutes, "userRoutes should be defined");
    assert.strictEqual(typeof userRoutes, "function", "userRoutes should be an Express Router");
  });

  it("should define webMvp routes router", () => {
    assert.ok(webMvpRoutes, "webMvpRoutes should be defined");
    assert.strictEqual(typeof webMvpRoutes, "function", "webMvpRoutes should be an Express Router");
  });
});
