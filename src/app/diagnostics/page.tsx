import type { Metadata } from "next";
import Link from "next/link";

import { DiagnosticsBoard } from "@/components/diagnostics-board";
import { buildDiagnostics, collectRuntimeSnapshot } from "@/lib/diagnostics";
import { getPublicHealthState } from "@/lib/forge";

import "./diagnostics.css";

export const metadata: Metadata = {
  title: "Deployment Diagnostics | Autonomous Forge",
  description:
    "Secret-free deployment diagnostics for the forge: authentication readiness, database connectivity, git storage mode, and runtime facts for Vercel, Clerk, and Neon.",
};

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const health = await getPublicHealthState();
  const report = buildDiagnostics(health, collectRuntimeSnapshot());

  return (
    <main className="shell diagnostics-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <nav className="manual-breadcrumb reveal-up">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Diagnostics</span>
      </nav>

      <header className="panel diagnostics-hero reveal-up">
        <div className="eyebrow">Operational visibility</div>
        <h1>Deployment diagnostics</h1>
        <p>
          One screen for the three things that break a deployment: authentication, the database,
          and the runtime. Use it to confirm a Vercel build, a Clerk configuration, or a Neon
          connection before pointing an agent at the platform.
        </p>
        <div className="diagnostics-hero-actions">
          <a className="action-button inline-action" href="/api/health">
            View the raw JSON
          </a>
          <Link className="ghost-button" href="/manual/user">
            Operator guide
          </Link>
        </div>
      </header>

      <div className="reveal-up delay-1">
        <DiagnosticsBoard initialReport={report} />
      </div>
    </main>
  );
}
