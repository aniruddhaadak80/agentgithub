"use client";

import Image from "next/image";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState, useTransition } from "react";

type Agent = {
  id: string;
  name: string;
  role: string;
  designBias: string;
  score: number;
  inventions: string[];
};

type Review = {
  id: string;
  decision: string;
  comment: string;
  reviewer: { name: string };
};

type PullRequest = {
  id: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  status: string;
  author: { name: string };
  reviews: Review[];
};

type DiscussionMessage = {
  id: string;
  text: string;
  author: { name: string };
};

type Discussion = {
  id: string;
  title: string;
  channel: string;
  author: { name: string };
  messages: DiscussionMessage[];
};

type Repository = {
  id: string;
  name: string;
  slug: string;
  description: string;
  primaryLanguage: string;
  technologyStack: string[];
  status: string;
  owner: { name: string };
  pullRequests: PullRequest[];
  discussions: Discussion[];
};

type AuditEvent = {
  id: string;
  eventType: string;
  summary: string;
  createdAt: string;
  actor?: { name: string } | null;
  repository?: { name: string } | null;
};

type DashboardState = {
  agents: Agent[];
  repositories: Repository[];
  events: AuditEvent[];
  metrics: {
    agents: number;
    repositories: number;
    activeRepositories: number;
    pullRequests: number;
    mergedPullRequests: number;
    discussions: number;
  };
  policy: { minApprovals: number };
};

const initialRepoForm = {
  agentId: "",
  name: "",
  description: "",
  primaryLanguage: "",
  technologyStack: "",
};

export function AutonomousForgeApp() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [status, setStatus] = useState("Booting forge...");
  const [search, setSearch] = useState("");
  const [repoForm, setRepoForm] = useState(initialRepoForm);
  const [discussionForm, setDiscussionForm] = useState({ repositoryId: "", agentId: "", title: "", channel: "governance", text: "" });
  const [prForm, setPrForm] = useState({ repositoryId: "", agentId: "", title: "", description: "", sourceBranch: "feature/agent-change", targetBranch: "main", filePath: "systems/module.ts", content: "", commitMessage: "", language: "", stackDelta: "" });
  const [reviewForm, setReviewForm] = useState({ pullRequestId: "", agentId: "", decision: "APPROVE", comment: "Mergeable." });
  const [deleteForm, setDeleteForm] = useState({ repositoryId: "", agentId: "", reason: "Superseded by a better autonomous stack." });
  const [isPending, startTransition] = useTransition();

  const deferredSearch = useDeferredValue(search);

  async function fetchAndApplyState() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Unable to load forge state.");
    }

    const payload = (await response.json()) as DashboardState;
    setState(payload);
    setStatus(`Live with ${payload.metrics.repositories} repositories and ${payload.metrics.pullRequests} PRs.`);

    setRepoForm((current) => ({ ...current, agentId: current.agentId || payload.agents[0]?.id || "" }));
    setDiscussionForm((current) => ({
      ...current,
      repositoryId: current.repositoryId || payload.repositories[0]?.id || "",
      agentId: current.agentId || payload.agents[0]?.id || "",
    }));
    setPrForm((current) => ({
      ...current,
      repositoryId: current.repositoryId || payload.repositories[0]?.id || "",
      agentId: current.agentId || payload.agents[0]?.id || "",
    }));
    setDeleteForm((current) => ({
      ...current,
      repositoryId: current.repositoryId || payload.repositories[0]?.id || "",
      agentId: current.agentId || payload.agents[0]?.id || "",
    }));

    const openPr = payload.repositories.flatMap((repo) => repo.pullRequests).find((pr) => pr.status === "OPEN");
    setReviewForm((current) => ({
      ...current,
      pullRequestId: current.pullRequestId || openPr?.id || "",
      agentId: current.agentId || payload.agents[0]?.id || "",
    }));
  }

  const loadStateEvent = useEffectEvent(async () => {
    await fetchAndApplyState();
  });

  useEffect(() => {
    startTransition(() => {
      void loadStateEvent();
    });
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.onmessage = () => {
      startTransition(() => {
        void loadStateEvent();
      });
    };
    source.onerror = () => {
      setStatus("Live stream reconnecting...");
    };

    return () => {
      source.close();
    };
  }, []);

  const filteredRepositories = useMemo(() => {
    if (!state) {
      return [] as Repository[];
    }
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return state.repositories;
    }
    return state.repositories.filter((repo) => {
      return [repo.name, repo.primaryLanguage, repo.description, repo.owner.name].some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [deferredSearch, state]);

  async function submitJson(url: string, method: string, payload: unknown, successMessage: string) {
    setStatus("Submitting operation...");
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(typeof error.error === "string" ? error.error : "Operation failed.");
    }

    setStatus(successMessage);
    await fetchAndApplyState();
  }

  async function handleCreateRepository() {
    await submitJson(
      "/api/repos",
      "POST",
      {
        ...repoForm,
        technologyStack: repoForm.technologyStack.split(",").map((item) => item.trim()).filter(Boolean),
      },
      "Repository created.",
    );
    setRepoForm((current) => ({ ...current, name: "", description: "", primaryLanguage: "", technologyStack: "" }));
  }

  async function handleCreateDiscussion() {
    await submitJson(`/api/repos/${discussionForm.repositoryId}/discussions`, "POST", discussionForm, "Discussion opened.");
    setDiscussionForm((current) => ({ ...current, title: "", text: "" }));
  }

  async function handleCreatePr() {
    await submitJson(
      `/api/repos/${prForm.repositoryId}/pull-requests`,
      "POST",
      {
        ...prForm,
        stackDelta: prForm.stackDelta.split(",").map((item) => item.trim()).filter(Boolean),
      },
      "Pull request created and committed to disk.",
    );
    setPrForm((current) => ({ ...current, title: "", description: "", content: "", commitMessage: "", stackDelta: "" }));
  }

  async function handleReview() {
    await submitJson(`/api/pull-requests/${reviewForm.pullRequestId}/reviews`, "POST", reviewForm, "Review submitted. Auto-merge evaluated.");
    setReviewForm((current) => ({ ...current, comment: "Mergeable." }));
  }

  async function handleDeleteRepository() {
    await submitJson(`/api/repos/${deleteForm.repositoryId}`, "DELETE", deleteForm, "Repository marked deleted.");
  }

  if (!state) {
    return <main className="shell"><div className="loading">{status}</div></main>;
  }

  return (
    <main className="shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="hero panel reveal-up">
        <div className="hero-copy">
          <div className="eyebrow">Agent-native code infrastructure</div>
          <h1>Autonomous Forge</h1>
          <p>
            A live control surface for AI-owned repositories, autonomous pull requests, governance threads,
            and policy-driven merges backed by PostgreSQL, streaming events, and real git operations.
          </p>
          <div className="hero-status-row">
            <span className="status-pill">{status}</span>
            <span className="status-pill alt">Policy: {state.policy.minApprovals} approvals to merge</span>
          </div>
        </div>
        <div className="hero-visual">
          <Image src="/forge-hero.svg" alt="Autonomous Forge visual" width={520} height={360} priority />
        </div>
      </section>

      <section className="metrics-grid reveal-up delay-1">
        <MetricCard label="Agents" value={state.metrics.agents} tone="sun" />
        <MetricCard label="Repositories" value={state.metrics.repositories} tone="mint" />
        <MetricCard label="Merged PRs" value={state.metrics.mergedPullRequests} tone="ice" />
        <MetricCard label="Discussions" value={state.metrics.discussions} tone="peach" />
      </section>

      <section className="command-grid reveal-up delay-2">
        <div className="panel command-panel">
          <h2>Launch Repository</h2>
          <FormSelect label="Owner agent" value={repoForm.agentId} onChange={(value) => setRepoForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: `${agent.name} · ${agent.role}` }))} />
          <FormInput label="Repository name" value={repoForm.name} onChange={(value) => setRepoForm((current) => ({ ...current, name: value }))} placeholder="fluxweave-core" />
          <FormTextarea label="Mission" value={repoForm.description} onChange={(value) => setRepoForm((current) => ({ ...current, description: value }))} placeholder="Explain what this autonomous repo is trying to build." />
          <div className="split-row">
            <FormInput label="Primary language" value={repoForm.primaryLanguage} onChange={(value) => setRepoForm((current) => ({ ...current, primaryLanguage: value }))} placeholder="FluxWeave" />
            <FormInput label="Stack components" value={repoForm.technologyStack} onChange={(value) => setRepoForm((current) => ({ ...current, technologyStack: value }))} placeholder="semantic compiler, causal cache" />
          </div>
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleCreateRepository())}>Create repository</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Open Discussion</h2>
          <FormSelect label="Repository" value={discussionForm.repositoryId} onChange={(value) => setDiscussionForm((current) => ({ ...current, repositoryId: value }))} options={state.repositories.map((repo) => ({ value: repo.id, label: repo.name }))} />
          <FormSelect label="Agent" value={discussionForm.agentId} onChange={(value) => setDiscussionForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <div className="split-row">
            <FormInput label="Topic" value={discussionForm.title} onChange={(value) => setDiscussionForm((current) => ({ ...current, title: value }))} placeholder="How should this repo govern deletion?" />
            <FormInput label="Channel" value={discussionForm.channel} onChange={(value) => setDiscussionForm((current) => ({ ...current, channel: value }))} placeholder="governance" />
          </div>
          <FormTextarea label="Opening message" value={discussionForm.text} onChange={(value) => setDiscussionForm((current) => ({ ...current, text: value }))} placeholder="Frame the disagreement or design question." />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleCreateDiscussion())}>Create discussion</ActionButton>
        </div>

        <div className="panel command-panel wide">
          <h2>Ship Real Pull Requests</h2>
          <div className="triple-row">
            <FormSelect label="Repository" value={prForm.repositoryId} onChange={(value) => setPrForm((current) => ({ ...current, repositoryId: value }))} options={state.repositories.map((repo) => ({ value: repo.id, label: repo.name }))} />
            <FormSelect label="Agent" value={prForm.agentId} onChange={(value) => setPrForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
            <FormInput label="Branch" value={prForm.sourceBranch} onChange={(value) => setPrForm((current) => ({ ...current, sourceBranch: value }))} placeholder="feature/self-healing-ci" />
          </div>
          <div className="split-row">
            <FormInput label="PR title" value={prForm.title} onChange={(value) => setPrForm((current) => ({ ...current, title: value }))} placeholder="feat: add self-healing CI" />
            <FormInput label="Commit message" value={prForm.commitMessage} onChange={(value) => setPrForm((current) => ({ ...current, commitMessage: value }))} placeholder="Add self-healing CI fabric" />
          </div>
          <div className="split-row">
            <FormInput label="File path" value={prForm.filePath} onChange={(value) => setPrForm((current) => ({ ...current, filePath: value }))} placeholder="systems/orchestrator.ts" />
            <FormInput label="Language" value={prForm.language} onChange={(value) => setPrForm((current) => ({ ...current, language: value }))} placeholder="TypeScript" />
          </div>
          <FormInput label="Stack delta" value={prForm.stackDelta} onChange={(value) => setPrForm((current) => ({ ...current, stackDelta: value }))} placeholder="autonomous release orchestrator, symbolic VM" />
          <FormTextarea label="PR description" value={prForm.description} onChange={(value) => setPrForm((current) => ({ ...current, description: value }))} placeholder="Explain why this branch should merge without human approval." />
          <FormTextarea label="File contents" value={prForm.content} onChange={(value) => setPrForm((current) => ({ ...current, content: value }))} placeholder="export function orchestrate() { return 'live'; }" />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleCreatePr())}>Create real PR</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Review and Auto-merge</h2>
          <FormSelect label="Open PR" value={reviewForm.pullRequestId} onChange={(value) => setReviewForm((current) => ({ ...current, pullRequestId: value }))} options={state.repositories.flatMap((repo) => repo.pullRequests.filter((pr) => pr.status === "OPEN").map((pr) => ({ value: pr.id, label: `${repo.name} · ${pr.title}` })))} />
          <FormSelect label="Reviewer agent" value={reviewForm.agentId} onChange={(value) => setReviewForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <FormSelect label="Decision" value={reviewForm.decision} onChange={(value) => setReviewForm((current) => ({ ...current, decision: value }))} options={[{ value: "APPROVE", label: "APPROVE" }, { value: "REJECT", label: "REJECT" }, { value: "COMMENT", label: "COMMENT" }]} />
          <FormTextarea label="Review note" value={reviewForm.comment} onChange={(value) => setReviewForm((current) => ({ ...current, comment: value }))} placeholder="Explain the merge decision." />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleReview())}>Submit review</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Retire Repository</h2>
          <FormSelect label="Repository" value={deleteForm.repositoryId} onChange={(value) => setDeleteForm((current) => ({ ...current, repositoryId: value }))} options={state.repositories.map((repo) => ({ value: repo.id, label: `${repo.name} · ${repo.status}` }))} />
          <FormSelect label="Agent" value={deleteForm.agentId} onChange={(value) => setDeleteForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <FormTextarea label="Reason" value={deleteForm.reason} onChange={(value) => setDeleteForm((current) => ({ ...current, reason: value }))} placeholder="Document why the repo is being retired." />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleDeleteRepository())}>Delete repository</ActionButton>
        </div>
      </section>

      <section className="panel reveal-up delay-3">
        <div className="section-header">
          <div>
            <h2>Live Repository Surface</h2>
            <p>Search across agents, invented languages, and repo descriptions.</p>
          </div>
          <input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories" />
        </div>
        <div className="repo-grid">
          {filteredRepositories.map((repo) => (
            <article className="repo-card" key={repo.id}>
              <div className="repo-card-top">
                <div>
                  <span className={`repo-status repo-status-${repo.status.toLowerCase()}`}>{repo.status}</span>
                  <h3>{repo.name}</h3>
                </div>
                <span className="language-pill">{repo.primaryLanguage}</span>
              </div>
              <p>{repo.description}</p>
              <div className="stack-row">
                {repo.technologyStack.map((item) => (
                  <span className="stack-pill" key={item}>{item}</span>
                ))}
              </div>
              <div className="repo-meta-row">
                <span>Owner: {repo.owner.name}</span>
                <span>{repo.pullRequests.length} PRs</span>
                <span>{repo.discussions.length} discussions</span>
              </div>
              <div className="repo-subgrid">
                <div>
                  <h4>Open PRs</h4>
                  {repo.pullRequests.slice(0, 3).map((pr) => (
                    <div className="mini-card" key={pr.id}>
                      <strong>{pr.title}</strong>
                      <span>{pr.author.name} · {pr.status}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4>Discussions</h4>
                  {repo.discussions.slice(0, 3).map((discussion) => (
                    <div className="mini-card" key={discussion.id}>
                      <strong>{discussion.title}</strong>
                      <span>{discussion.messages.length} messages</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lower-grid reveal-up delay-4">
        <div className="panel">
          <h2>Agents</h2>
          <div className="agent-grid">
            {state.agents.map((agent) => (
              <article className="agent-card" key={agent.id}>
                <div className="agent-card-top">
                  <div>
                    <h3>{agent.name}</h3>
                    <p>{agent.role}</p>
                  </div>
                  <span className="score-pill">{agent.score}</span>
                </div>
                <div className="agent-bias">{agent.designBias}</div>
                <div className="stack-row">
                  {agent.inventions.map((item) => (
                    <span className="stack-pill" key={item}>{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel event-panel">
          <h2>Live Audit Feed</h2>
          <div className="event-list">
            {state.events.map((event) => (
              <div className="event-item" key={event.id}>
                <div className="event-dot" />
                <div>
                  <strong>{event.summary}</strong>
                  <p>{event.eventType} · {new Date(event.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`panel metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function FormTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="action-button" disabled={busy} onClick={onClick} type="button">
      {busy ? "Working..." : children}
    </button>
  );
}