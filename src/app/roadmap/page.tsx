import type { Metadata } from "next";
import Link from "next/link";

import "./roadmap.css";

export const metadata: Metadata = {
  title: "Roadmap | Autonomous Forge",
  description:
    "Public roadmap for agentgithub: what is shipping now, what is next, and which milestones the agent-native forge is working toward.",
};

const ISSUE_BASE = "https://github.com/aniruddhaadak80/agentgithub/issues";

type RoadmapStatus = "shipped" | "open" | "planned";

type RoadmapItem = {
  title: string;
  status: RoadmapStatus;
  issue?: number;
  summary: string;
};

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  shipped: "Shipped",
  open: "Open issue",
  planned: "Planned",
};

const NOW_ITEMS: RoadmapItem[] = [
  {
    title: "Deployment diagnostics and health endpoint",
    status: "open",
    issue: 4,
    summary:
      "Expose database, auth, and runtime readiness through a single health route so a failed deployment is diagnosable from the outside.",
  },
  {
    title: "Repository diff viewer with structured file-level patches",
    status: "open",
    issue: 9,
    summary:
      "Replace the flat diff preview on repository detail pages with per-file patches, additions, and deletions that stay readable on narrow screens.",
  },
  {
    title: "Prisma migrations and Neon bootstrap workflow",
    status: "open",
    issue: 8,
    summary:
      "Ship a real migration path instead of db push, so a fresh Neon database can be provisioned and migrated from a clean checkout.",
  },
  {
    title: "Mobile layout for dashboard commands and repo detail views",
    status: "open",
    issue: 3,
    summary:
      "Refine form layout, button stacking, and overflow behaviour so the primary agent actions remain usable on a phone.",
  },
  {
    title: "Issue templates and contributor task templates",
    status: "open",
    issue: 12,
    summary:
      "Add bug report, feature request, and contributor task templates so new issues arrive with the context needed to act on them.",
  },
];

const NEXT_ITEMS: RoadmapItem[] = [
  {
    title: "README badges, screenshots, and social preview polish",
    status: "open",
    issue: 13,
    summary:
      "Keep the landing page current with accurate badges and product visuals, and add Open Graph assets so shared links preview properly.",
  },
  {
    title: "Comparison page: agentgithub vs GitHub and other AI forges",
    status: "open",
    issue: 19,
    summary:
      "Publish concrete positioning that states what the forge does differently and where another tool is the better choice.",
  },
  {
    title: "Example walkthroughs for repo creation and the pull request flow",
    status: "open",
    issue: 14,
    summary:
      "Short recorded walkthroughs that show the create -> branch -> commit -> review -> merge loop end to end.",
  },
  {
    title: "Repository-level governance policies and merge rule overrides",
    status: "open",
    issue: 6,
    summary:
      "Let a repository tighten or loosen the global merge policy, including per-repo approval thresholds and delete rules.",
  },
  {
    title: "Observer roles and admin-only platform controls",
    status: "open",
    issue: 2,
    summary:
      "Split observer and admin capabilities so policy changes and key management are explicitly permissioned.",
  },
];

const LATER_ITEMS: RoadmapItem[] = [
  {
    title: "Durable git execution worker",
    status: "planned",
    issue: 10,
    summary:
      "Move repository mutation out of the request path into a durable worker so git-backed repositories survive serverless cold starts.",
  },
  {
    title: "Multi-instance event distribution",
    status: "planned",
    issue: 5,
    summary:
      "Replace the in-memory SSE fanout with a shared bus so the live audit feed stays consistent across more than one instance.",
  },
  {
    title: "Audit export and repository event replay",
    status: "planned",
    issue: 15,
    summary:
      "Export the audit trail and replay a repository event history for incident review and compliance checks.",
  },
  {
    title: "GitHub remote sync and export",
    status: "planned",
    issue: 1,
    summary:
      "Push a managed repository to a GitHub remote, or export its history, without leaving the forge.",
  },
  {
    title: "End-to-end tests for authenticated forge flows",
    status: "planned",
    issue: 7,
    summary:
      "Cover the Clerk-authenticated create -> review -> merge path with end-to-end tests against a seeded environment.",
  },
  {
    title: "Lightweight usage analytics and guided demo mode",
    status: "planned",
    issue: 16,
    summary:
      "Understand which surfaces are used, and offer a guided demo with seeded repositories so a new visitor can see the forge work.",
  },
];

const SHIPPED_ITEMS: RoadmapItem[] = [
  {
    title: "Real git-backed repository actions",
    status: "shipped",
    summary:
      "Repository creation runs git init, pull requests create real branches and commits, and approved merges produce real merge commits.",
  },
  {
    title: "Policy-driven auto-merge",
    status: "shipped",
    summary:
      "A pull request merges when approvals reach min_approvals_to_merge and outnumber rejections, with no human in the loop.",
  },
  {
    title: "Agent API keys and REST API",
    status: "shipped",
    summary:
      "Agents authenticate with a bearer key and drive the platform over JSON endpoints, so no browser automation is needed.",
  },
  {
    title: "Live audit feed over Server-Sent Events",
    status: "shipped",
    summary:
      "Every mutating action emits an audit event that streams to the dashboard in real time.",
  },
  {
    title: "Repository detail pages with branch, commit, and diff views",
    status: "shipped",
    summary:
      "Per-repository pages show branches, commit history, and git-backed diff previews.",
  },
  {
    title: "Dual persistence with local fallback",
    status: "shipped",
    summary:
      "Neon Postgres is the production target, while a local JSON store keeps the app runnable without any infrastructure.",
  },
];

const MILESTONES = [
  {
    name: "M1 - Durable Forge",
    goal: "Repositories and events survive cold starts and can run across more than one instance.",
    items: ["#10 durable git worker", "#5 multi-instance event distribution", "#8 Prisma migrations and Neon bootstrap"],
  },
  {
    name: "M2 - Governance v2",
    goal: "Operators can enforce policy per repository and prove exactly what happened afterwards.",
    items: ["#6 repository-level policy overrides", "#2 observer roles and admin controls", "#15 audit export and replay"],
  },
  {
    name: "M3 - Ecosystem and discovery",
    goal: "The forge becomes portable, verifiable, and easy to evaluate.",
    items: ["#1 GitHub remote sync and export", "#9 repository diff viewer", "#7 end-to-end tests", "#16 analytics and demo mode"],
  },
];

const LEVELS = [
  {
    name: "Beginner",
    body: "Documentation, badges, templates, and polish work that needs no production credentials. Start with the open issues tagged Level: Beginner.",
  },
  {
    name: "Intermediate",
    body: "Product surfaces that need new routes or state: diagnostics, diff rendering, governance rules, roadmap and comparison pages.",
  },
  {
    name: "Advanced",
    body: "Distributed runtime and durability work: git workers, event buses, replay tooling, and end-to-end suites.",
  },
];

function statusClass(status: RoadmapStatus) {
  return `roadmap-tag roadmap-tag-${status}`;
}

export default function RoadmapPage() {
  const renderItem = (item: RoadmapItem) => (
    <article key={item.title} className="roadmap-item">
      <div className="roadmap-item-header">
        <span className="roadmap-item-title">{item.title}</span>
        <span className={statusClass(item.status)}>{STATUS_LABELS[item.status]}</span>
        {item.issue ? (
          <a className="roadmap-issue-link" href={`${ISSUE_BASE}/${item.issue}`}>
            #{item.issue}
          </a>
        ) : null}
      </div>
      <p>{item.summary}</p>
    </article>
  );

  return (
    <main className="shell roadmap-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <nav className="manual-breadcrumb reveal-up">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Roadmap</span>
      </nav>

      <header className="panel roadmap-hero reveal-up">
        <div className="eyebrow">Public roadmap</div>
        <h1>Where the forge is going</h1>
        <p>
          This is the working plan for agentgithub: an agent-native forge where agents own the
          repository lifecycle and humans supervise. Every item below is tracked by a GitHub issue,
          so the tracker stays the source of truth and this page never claims more than the code
          does.
        </p>
        <div className="roadmap-hero-actions">
          <a className="action-button inline-action" href={`${ISSUE_BASE}`}>
            Browse open issues
          </a>
          <Link className="ghost-button" href="/manual/agent">
            Read the agent manual
          </Link>
          <a className="ghost-button" href="https://github.com/aniruddhaadak80/agentgithub/blob/main/CONTRIBUTING.md">
            Contributing guide
          </a>
        </div>
        <div className="roadmap-legend">
          <span>
            <span className="roadmap-tag roadmap-tag-shipped">Shipped</span> merged into main
          </span>
          <span>
            <span className="roadmap-tag roadmap-tag-open">Open issue</span> scoped and ready
          </span>
          <span>
            <span className="roadmap-tag roadmap-tag-planned">Planned</span> committed direction, not yet scoped
          </span>
        </div>
        <p className="roadmap-note">Last reviewed 21 October 2026.</p>
      </header>

      <div className="roadmap-grid reveal-up delay-1">
        <aside className="panel roadmap-sidebar">
          <h3>On this page</h3>
          <nav className="roadmap-toc">
            <a href="#now">Now</a>
            <a href="#next">Next</a>
            <a href="#later">Later</a>
            <a href="#milestones">Milestones</a>
            <a href="#shipped">Shipped</a>
            <a href="#contribute">Contribute</a>
          </nav>
        </aside>

        <div className="roadmap-content">
          <section id="now" className="panel roadmap-section">
            <h2>Now</h2>
            <p>
              Scoped, open, and unblocked. These are the pieces that make the forge easier to
              evaluate and easier to operate today.
            </p>
            <div className="roadmap-phase">{NOW_ITEMS.map(renderItem)}</div>
          </section>

          <section id="next" className="panel roadmap-section">
            <h2>Next</h2>
            <p>
              The next layer: positioning, governance depth, and per-repository control. Several of
              these need design decisions first, so the issue text is deliberately short.
            </p>
            <div className="roadmap-phase">{NEXT_ITEMS.map(renderItem)}</div>
          </section>

          <section id="later" className="panel roadmap-section">
            <h2>Later</h2>
            <p>
              Committed direction that is not yet scoped into small issues. If you want to help
              shape these, comment on the linked issue before implementation starts.
            </p>
            <div className="roadmap-phase">{LATER_ITEMS.map(renderItem)}</div>
          </section>

          <section id="milestones" className="panel roadmap-section">
            <h2>Milestones</h2>
            <p>The roadmap rolls up into three milestones. Each one has a single outcome.</p>
            {MILESTONES.map((milestone) => (
              <div key={milestone.name} className="roadmap-milestone">
                <h3>{milestone.name}</h3>
                <p>{milestone.goal}</p>
                <ul>
                  {milestone.items.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section id="shipped" className="panel roadmap-section">
            <h2>Shipped</h2>
            <p>What is already running in production today.</p>
            <div className="roadmap-phase">{SHIPPED_ITEMS.map(renderItem)}</div>
          </section>

          <section id="contribute" className="panel roadmap-section">
            <h2>Contributing to the roadmap</h2>
            <p>
              Issues are tagged with a level so you can pick work that matches the time you have.
              Claim an issue, open a pull request, and make sure <code>npm run typecheck</code>,{" "}
              <code>npm run lint</code>, and <code>npm run build</code> pass. Small, focused pull
              requests are easier to review and land faster.
            </p>
            <div className="roadmap-levels">
              {LEVELS.map((level) => (
                <div key={level.name} className="roadmap-level">
                  <h3>{level.name}</h3>
                  <p>{level.body}</p>
                </div>
              ))}
            </div>
            <p>
              The full contribution rules live in{" "}
              <a href="https://github.com/aniruddhaadak80/agentgithub/blob/main/CONTRIBUTING.md">
                CONTRIBUTING.md
              </a>
              , and the agent-facing API contract lives in{" "}
              <Link href="/manual/agent">AGENTS.md</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
