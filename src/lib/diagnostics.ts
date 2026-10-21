/**
 * Deployment diagnostics.
 *
 * Everything in this module is intentionally secret free: it reports whether a
 * dependency is configured and reachable, never the value of an environment
 * variable, a connection string, a token, or a filesystem path. The builder is
 * a pure function so it can be unit tested without a database, a Clerk
 * instance, or a Vercel deployment.
 */

export type DiagnosticStatus = "ok" | "warn" | "fail";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  hint?: string;
}

export interface DiagnosticsRuntime {
  deploymentTarget: string;
  storageMode: string;
  nodeVersion: string;
  region: string | null;
  commit: string | null;
  uptimeSeconds: number | null;
}

export interface DiagnosticsSummary {
  ok: number;
  warn: number;
  fail: number;
}

export interface DiagnosticsReport {
  generatedAt: string;
  status: DiagnosticStatus;
  ready: boolean;
  summary: DiagnosticsSummary;
  checks: DiagnosticCheck[];
  runtime: DiagnosticsRuntime;
}

/** The subset of the platform health payload the diagnostics builder needs. */
export interface PlatformHealthSnapshot {
  authProvider: string;
  authConfigured: boolean;
  databaseMode: string;
  databaseConnected: boolean;
  deploymentTarget: string;
  storageMode: string;
  ready: boolean;
  warnings: string[];
}

export interface RuntimeSnapshot {
  nodeVersion?: string;
  region?: string | null;
  commit?: string | null;
  uptimeSeconds?: number | null;
}

/**
 * Reads runtime facts from the environment.
 *
 * Only non-sensitive facts are collected: the Node.js version, the Vercel
 * region, the short commit SHA, and the process uptime. No secret or
 * connection string is read here.
 */
export function collectRuntimeSnapshot(): RuntimeSnapshot {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();

  return {
    nodeVersion: process.versions.node,
    region: process.env.VERCEL_REGION?.trim() || null,
    commit: commit ? commit.slice(0, 7) : null,
    uptimeSeconds: typeof process.uptime === "function" ? Math.round(process.uptime()) : null,
  };
}

function summarize(checks: DiagnosticCheck[]): DiagnosticsSummary {
  return {
    ok: checks.filter((check) => check.status === "ok").length,
    warn: checks.filter((check) => check.status === "warn").length,
    fail: checks.filter((check) => check.status === "fail").length,
  };
}

function overallStatus(checks: DiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }

  if (checks.some((check) => check.status === "warn")) {
    return "warn";
  }

  return "ok";
}

/**
 * Builds the diagnostics report for a platform health snapshot.
 *
 * The report describes configuration state only. It never contains environment
 * values, credentials, connection strings, or absolute filesystem paths.
 */
export function buildDiagnostics(
  health: PlatformHealthSnapshot,
  runtime: RuntimeSnapshot = {},
): DiagnosticsReport {
  const checks: DiagnosticCheck[] = [];

  checks.push({
    id: "auth",
    label: "Authentication (Clerk)",
    status: health.authConfigured ? "ok" : "fail",
    detail: health.authConfigured
      ? `${health.authProvider} is configured and the observer sign-in flow is available.`
      : `${health.authProvider} environment variables are missing, so protected routes return 401.`,
    hint: health.authConfigured
      ? undefined
      : "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in the deployment environment.",
  });

  const databaseConfigured = health.databaseMode !== "local-fallback";
  checks.push({
    id: "database",
    label: "Database (Neon Postgres)",
    status: databaseConfigured ? (health.databaseConnected ? "ok" : "fail") : "warn",
    detail: databaseConfigured
      ? health.databaseConnected
        ? `${health.databaseMode} is configured and the connection check succeeded.`
        : `${health.databaseMode} is configured but the connection check failed.`
      : "DATABASE_URL is not set, so the platform runs on the local JSON fallback store.",
    hint: databaseConfigured
      ? health.databaseConnected
        ? undefined
        : "Check DATABASE_URL, the Neon project status, and whether the database is suspended."
      : "Set DATABASE_URL to a pooled or direct Neon connection string for production.",
  });

  const ephemeral = health.storageMode === "ephemeral-serverless";
  checks.push({
    id: "storage",
    label: "Git repository storage",
    status: ephemeral ? "warn" : "ok",
    detail: ephemeral
      ? "Git repositories are written to ephemeral serverless disk and are lost on cold starts."
      : "Git repositories are written to durable local disk.",
    hint: ephemeral
      ? "Move git execution into a durable worker or VM-backed runtime before relying on repository persistence."
      : undefined,
  });

  checks.push({
    id: "runtime",
    label: "Runtime",
    status: "ok",
    detail: `Deployment target: ${health.deploymentTarget}.`,
  });

  const summary = summarize(checks);

  return {
    generatedAt: new Date().toISOString(),
    status: overallStatus(checks),
    ready: checks.every((check) => check.status !== "fail"),
    summary,
    checks,
    runtime: {
      deploymentTarget: health.deploymentTarget,
      storageMode: health.storageMode,
      nodeVersion: runtime.nodeVersion ?? process.versions.node,
      region: runtime.region ?? null,
      commit: runtime.commit ? runtime.commit.slice(0, 7) : null,
      uptimeSeconds: runtime.uptimeSeconds ?? null,
    },
  };
}
