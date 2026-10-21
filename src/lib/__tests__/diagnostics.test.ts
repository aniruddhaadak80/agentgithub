import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDiagnostics, type PlatformHealthSnapshot } from "../diagnostics.ts";

function healthySnapshot(overrides: Partial<PlatformHealthSnapshot> = {}): PlatformHealthSnapshot {
  return {
    authProvider: "clerk",
    authConfigured: true,
    databaseMode: "neon-postgres",
    databaseConnected: true,
    deploymentTarget: "vercel",
    storageMode: "local-disk",
    ready: true,
    warnings: [],
    ...overrides,
  };
}

describe("buildDiagnostics", () => {
  it("reports a healthy platform as ready with no failures", () => {
    const report = buildDiagnostics(healthySnapshot(), { nodeVersion: "22.23.2" });

    assert.equal(report.status, "ok");
    assert.equal(report.ready, true);
    assert.equal(report.summary.ok, 4);
    assert.equal(report.summary.warn, 0);
    assert.equal(report.summary.fail, 0);
    assert.equal(report.runtime.nodeVersion, "22.23.2");
  });

  it("fails when Clerk is not configured", () => {
    const report = buildDiagnostics(healthySnapshot({ authConfigured: false }));

    const auth = report.checks.find((check) => check.id === "auth");
    assert.equal(auth?.status, "fail");
    assert.equal(report.status, "fail");
    assert.equal(report.ready, false);
    assert.ok(auth?.hint?.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"));
  });

  it("fails when the configured database cannot be reached", () => {
    const report = buildDiagnostics(healthySnapshot({ databaseConnected: false }));

    const database = report.checks.find((check) => check.id === "database");
    assert.equal(database?.status, "fail");
    assert.equal(report.ready, false);
  });

  it("warns instead of failing when the local fallback store is used", () => {
    const report = buildDiagnostics(
      healthySnapshot({ databaseMode: "local-fallback", databaseConnected: false }),
    );

    const database = report.checks.find((check) => check.id === "database");
    assert.equal(database?.status, "warn");
    assert.equal(report.ready, true);
    assert.equal(report.status, "warn");
  });

  it("warns when git storage is ephemeral serverless disk", () => {
    const report = buildDiagnostics(healthySnapshot({ storageMode: "ephemeral-serverless" }));

    const storage = report.checks.find((check) => check.id === "storage");
    assert.equal(storage?.status, "warn");
    assert.ok(storage?.hint?.toLowerCase().includes("durable"));
  });

  it("never exposes secret-looking values", () => {
    const report = buildDiagnostics(healthySnapshot(), {
      region: "iad1",
      commit: "9f2c1ab7d3e4",
      uptimeSeconds: 42,
    });

    const serialized = JSON.stringify(report);
    assert.equal(/sk_[A-Za-z0-9]/.test(serialized), false);
    assert.equal(/pk_(test|live)_/.test(serialized), false);
    assert.equal(/postgres(ql)?:\/\//i.test(serialized), false);
    assert.equal(/bearer /i.test(serialized), false);
    assert.equal(/password/i.test(serialized), false);
  });

  it("reports runtime facts without leaking the full commit sha", () => {
    const report = buildDiagnostics(healthySnapshot(), {
      region: "iad1",
      commit: "9f2c1ab7d3e4f5a6",
      uptimeSeconds: 120,
    });

    assert.equal(report.runtime.region, "iad1");
    assert.equal(report.runtime.commit, "9f2c1ab");
    assert.equal(report.runtime.uptimeSeconds, 120);
  });
});
