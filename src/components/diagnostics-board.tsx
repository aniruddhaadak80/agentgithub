"use client";

import { useEffect, useState } from "react";

import type { DiagnosticsReport } from "@/lib/diagnostics";

const REFRESH_INTERVAL_MS = 30_000;

function statusLabel(status: string) {
  if (status === "ok") return "Healthy";
  if (status === "warn") return "Degraded";
  return "Failing";
}

export function DiagnosticsBoard({ initialReport }: { initialReport: DiagnosticsReport }) {
  const [report, setReport] = useState<DiagnosticsReport>(initialReport);
  const [lastChecked, setLastChecked] = useState(initialReport.generatedAt);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { diagnostics?: DiagnosticsReport };
        if (!active || !payload.diagnostics) return;

        setReport(payload.diagnostics);
        setLastChecked(payload.diagnostics.generatedAt);
      } catch {
        // Keep the last known report when the refresh request fails.
      }
    }

    const timer = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="diagnostics-grid">
      <section className="panel diagnostics-status-card">
        <div className="diagnostics-status-head">
          <span className={`diagnostics-badge diagnostics-badge-${report.status}`}>
            {statusLabel(report.status)}
          </span>
          <span className="diagnostics-updated">
            Last checked{" "}
            <time dateTime={lastChecked} suppressHydrationWarning>
              {new Date(lastChecked).toISOString().slice(11, 19)} UTC
            </time>{" "}
            (refreshes every 30s)
          </span>
        </div>
        <div className="diagnostics-counts">
          <div className="diagnostics-count">
            <strong>{report.summary.ok}</strong>
            <span>healthy</span>
          </div>
          <div className="diagnostics-count">
            <strong>{report.summary.warn}</strong>
            <span>warnings</span>
          </div>
          <div className="diagnostics-count">
            <strong>{report.summary.fail}</strong>
            <span>failures</span>
          </div>
        </div>
        <p className="diagnostics-note">
          This board reports whether each dependency is configured and reachable. It never shows
          environment values, connection strings, tokens, or filesystem paths.
        </p>
      </section>

      <section className="panel diagnostics-checks">
        <h2>Checks</h2>
        <div className="diagnostics-check-list">
          {report.checks.map((check) => (
            <article key={check.id} className="diagnostics-check">
              <div className="diagnostics-check-head">
                <span className={`diagnostics-dot diagnostics-dot-${check.status}`} />
                <strong>{check.label}</strong>
                <span className={`diagnostics-state diagnostics-state-${check.status}`}>
                  {check.status}
                </span>
              </div>
              <p>{check.detail}</p>
              {check.hint ? <p className="diagnostics-hint">{check.hint}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="panel diagnostics-runtime">
        <h2>Runtime</h2>
        <div className="diagnostics-runtime-grid">
          <div className="diagnostics-runtime-item">
            <span>Deployment target</span>
            <strong>{report.runtime.deploymentTarget}</strong>
          </div>
          <div className="diagnostics-runtime-item">
            <span>Storage mode</span>
            <strong>{report.runtime.storageMode}</strong>
          </div>
          <div className="diagnostics-runtime-item">
            <span>Node.js</span>
            <strong>{report.runtime.nodeVersion}</strong>
          </div>
          <div className="diagnostics-runtime-item">
            <span>Region</span>
            <strong>{report.runtime.region ?? "not reported"}</strong>
          </div>
          <div className="diagnostics-runtime-item">
            <span>Commit</span>
            <strong>{report.runtime.commit ?? "not reported"}</strong>
          </div>
          <div className="diagnostics-runtime-item">
            <span>Uptime</span>
            <strong>
              {report.runtime.uptimeSeconds === null
                ? "not reported"
                : `${report.runtime.uptimeSeconds}s`}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}
