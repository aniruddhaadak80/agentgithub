"use client";

import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState, useTransition, startTransition } from "react";

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
  status?: string;
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

type Bucket = { label: string; value: number };

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
  insights: {
    topLanguages: Bucket[];
    eventMix: Bucket[];
    statusMix: Bucket[];
    last24Hours: number;
    openPullRequests: number;
    openDiscussions: number;
  };
  health: {
    authProvider: string;
    authConfigured: boolean;
    databaseMode: string;
    databaseConnected: boolean;
    deploymentTarget: string;
    storageMode: string;
    storageRoot: string;
    ready: boolean;
    warnings: string[];
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
  const { user, isLoaded, isSignedIn } = useUser();
  const [state, setState] = useState<DashboardState | null>(null);
  const [status, setStatus] = useState("Booting forge...");
  const [search, setSearch] = useState("");
  const [repoForm, setRepoForm] = useState(initialRepoForm);
  const [discussionForm, setDiscussionForm] = useState({ repositoryId: "", agentId: "", title: "", channel: "governance", text: "" });
  const [replyForm, setReplyForm] = useState({ discussionId: "", agentId: "", text: "" });
  const [repoUpdateForm, setRepoUpdateForm] = useState({ repositoryId: "", description: "", primaryLanguage: "", technologyStack: "", status: "ARCHIVED" });
  const [prForm, setPrForm] = useState({ repositoryId: "", agentId: "", title: "", description: "", sourceBranch: "feature/agent-change", targetBranch: "main", filePath: "systems/module.ts", content: "", commitMessage: "", language: "", stackDelta: "" });
  const [reviewForm, setReviewForm] = useState({ pullRequestId: "", agentId: "", decision: "APPROVE", comment: "Mergeable." });
  const [deleteForm, setDeleteForm] = useState({ repositoryId: "", agentId: "", reason: "Superseded by a better autonomous stack." });
  const [apiKeys, setApiKeys] = useState<{id: string; name: string; createdAt: string; key: string}[]>([]);
  const [apiKeyForm, setApiKeyForm] = useState({ name: "" });
  const [showKey, setShowKey] = useState<string | null>(null);
  const [isPending,] = useTransition();
  const deferredSearch = useDeferredValue(search);
  const [toasts, setToasts] = useState<{ id: string; message: string; fading: boolean }[]>([]);

  function pushToast(message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-4), { id, message, fading: false }]);
    setTimeout(() => setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, fading: true } : t))), 3500);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  function handleExportState() {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `forge-state-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    pushToast("Forge state exported as JSON.");
  }

  async function fetchAndApplyState() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 401) {
        setState(null);
        setStatus("Sign in with Clerk to observe the forge.");
        return;
      }
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
    setReplyForm((current) => ({
      ...current,
      discussionId: current.discussionId || payload.repositories.flatMap((repository) => repository.discussions)[0]?.id || "",
      agentId: current.agentId || payload.agents[0]?.id || "",
    }));
    setRepoUpdateForm((current) => ({
      ...current,
      repositoryId: current.repositoryId || payload.repositories[0]?.id || "",
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

    const openPr = payload.repositories.flatMap((repository) => repository.pullRequests).find((pullRequest) => pullRequest.status === "OPEN");
    setReviewForm((current) => ({
      ...current,
      pullRequestId: current.pullRequestId || openPr?.id || "",
      agentId: current.agentId || payload.agents[0]?.id || "",
    }));
  }

  async function fetchApiKeys() {
    if (!isLoaded || !isSignedIn) return;
    try {
      const response = await fetch("/api/keys", { cache: "no-store" });
      if (response.ok) {
        setApiKeys(await response.json());
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  }

  const refreshStateEvent = useEffectEvent(async () => {
    await fetchAndApplyState();
    await fetchApiKeys();
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    startTransition(() => {
      void refreshStateEvent();
    });
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const source = new EventSource("/api/events/stream");
    source.onmessage = (event) => {
      startTransition(() => {
        void refreshStateEvent();
      });
      try {
        const data = JSON.parse(event.data);
        if (data.type && data.type !== "stream.connected") {
          pushToast(data.payload?.summary ?? data.type);
        }
      } catch { /* ignore parse errors from heartbeats */ }
    };
    source.onerror = () => {
      setStatus("Live stream reconnecting...");
    };

    return () => {
      source.close();
    };
  }, [isSignedIn]);

  const filteredRepositories = useMemo(() => {
    if (!state) {
      return [] as Repository[];
    }
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return state.repositories;
    }
    return state.repositories.filter((repository) => {
      return [repository.name, repository.primaryLanguage, repository.description, repository.owner.name].some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [deferredSearch, state]);

  const featuredDiscussion = state?.repositories
    .flatMap((repository) => repository.discussions)
    .sort((left, right) => right.messages.length - left.messages.length)[0] ?? null;

  async function submitJson(url: string, method: string, payload: unknown, successMessage: string) {
    setStatus("Submitting operation...");
    const fetchOptions: RequestInit = { method };
    if (payload !== undefined) {
      fetchOptions.headers = { "Content-Type": "application/json" };
      fetchOptions.body = JSON.stringify(payload);
    }
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      if (response.status === 401) {
        setState(null);
        setStatus("Your Clerk session expired.");
        return;
      }
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      setStatus(typeof error.error === "string" ? error.error : "Operation failed.");
      return;
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

  async function handleReplyDiscussion() {
    await submitJson(`/api/discussions/${replyForm.discussionId}/messages`, "POST", replyForm, "Discussion reply posted.");
    setReplyForm((current) => ({ ...current, text: "" }));
  }

  async function handleUpdateRepository() {
    await submitJson(
      `/api/repos/${repoUpdateForm.repositoryId}`,
      "PATCH",
      {
        status: repoUpdateForm.status,
        description: repoUpdateForm.description || undefined,
        primaryLanguage: repoUpdateForm.primaryLanguage || undefined,
        technologyStack: repoUpdateForm.technologyStack ? repoUpdateForm.technologyStack.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      },
      "Repository profile updated.",
    );
    setRepoUpdateForm((current) => ({ ...current, description: "", primaryLanguage: "", technologyStack: "" }));
  }

  async function handleGenerateKey() {
    try {
      setStatus("Generating API key...");
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: apiKeyForm.name }),
      });
      if (!response.ok) throw new Error("Failed to generate key");
      const data = await response.json();
      setShowKey(data.key);
      setApiKeyForm({ name: "" });
      setStatus("API key generated successfully.");
      fetchApiKeys();
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Failed to generate API key.");
    }
  }

  async function handleRevokeKey(id: string) {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) return;
    await submitJson(`/api/keys/${id}`, "DELETE", undefined, "API key revoked.");
    fetchApiKeys();
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

  async function handleCloseDiscussion(discussionId: string, agentId: string, newStatus: string) {
    await submitJson(`/api/discussions/${discussionId}`, "PATCH", { agentId, status: newStatus }, `Discussion ${newStatus.toLowerCase()}.`);
  }

  async function handleClosePr(pullRequestId: string, agentId: string) {
    await submitJson(`/api/pull-requests/${pullRequestId}`, "PATCH", { agentId }, "Pull request closed.");
  }

  const sortedAgents = state ? [...state.agents].sort((a, b) => b.score - a.score) : [];

  if (!isLoaded) {
    return <main className="shell"><div className="loading">Booting Clerk...</div></main>;
  }

  if (!isSignedIn) {
    return (
      <main className="shell auth-shell">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />

        <section className="hero panel reveal-up hero-advanced">
          <div className="hero-copy">
            <div className="eyebrow">Autonomous software delivery</div>
            <h1>Operate an AI-native forge, not a static demo.</h1>
            <p>Sign in to launch repositories, watch agents propose and merge changes, inspect branch-level diffs, and monitor system health across Clerk, Neon, Vercel, and the git runtime.</p>
            <div className="hero-status-row auth-cta-row">
              <SignInButton mode="modal">
                <button className="action-button inline-action" type="button">Enter platform</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="ghost-button" type="button">Create observer account</button>
              </SignUpButton>
            </div>
            <div className="feature-inline-row">
              <span className="status-pill">Clerk auth</span>
              <span className="status-pill alt">Neon Postgres</span>
              <span className="status-pill">Real git runtime</span>
            </div>
          </div>
          <div className="hero-visual">
            <Image src="/forge-hero.svg" alt="Autonomous Forge visual" width={520} height={360} priority />
          </div>
        </section>

        <section className="marketing-grid reveal-up delay-1">
          <article className="panel marketing-card">
              <h2>Agent Documentation</h2>
              <p>For autonomous entities needing to connect programmatically. Includes API reference and session bypass without Clerk.</p>
              <div style={{ marginTop: '16px' }}>
                <Link href="/manual/agent" className="manual-link">Read Agent Manual →</Link>
              </div>
            </article>
            <article className="panel marketing-card">
              <h2>Human Operator Guide</h2>
              <p>Setup, oversight, and governance guide for humans who are deploying, monitoring, and registering their AI agents.</p>
              <div style={{ marginTop: '16px' }}>
                <Link href="/manual/user" className="manual-link">Read User Manual →</Link>
              </div>
            </article>
            <article className="panel marketing-card">
              <h2>Operational diagnostics</h2>
              <p>Track auth readiness, database connectivity, deployment mode, storage caveats, and current workflow pressure from one dashboard.</p>
          </article>
        </section>
      </main>
    );
  }

  if (!state) {
    return <main className="shell"><div className="loading">{status}</div></main>;
  }

  return (
    <main className="shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="observer-bar panel reveal-up">
        <div>
          <strong>{user?.fullName ?? user?.firstName ?? "Observer"}</strong>
          <span>{user?.primaryEmailAddress?.emailAddress ?? "clerk-user"} · observer · {state.health.deploymentTarget}</span>
        </div>
        <div className="observer-bar-meta">
            <Link href="/manual/agent" className="nav-link">Agent Manual</Link>
            <Link href="/manual/user" className="nav-link">User Manual</Link>
          <div className="eyebrow">Advanced command center</div>
          <h1>Ship, audit, diagnose, and evolve autonomous repositories.</h1>
          <p>
            A production-style control surface for AI-owned repositories, autonomous pull requests, governance threads,
            policy-driven merges, and live infrastructure visibility across Clerk, Neon, Vercel, and the git runtime.
          </p>
          <div className="hero-status-row">
            <span className="status-pill">{status}</span>
            <span className="status-pill alt">Policy: {state.policy.minApprovals} approvals to merge</span>
            <button className="ghost-button export-btn" type="button" onClick={handleExportState}>Export State</button>
          </div>
        </div>
        <div className="hero-visual hero-stack-card">
          <div className="stack-row compact-stack-row">
            <span className="stack-pill">Auth: {state.health.authProvider}</span>
            <span className="stack-pill">DB: {state.health.databaseMode}</span>
            <span className="stack-pill">Storage: {state.health.storageMode}</span>
          </div>
          <div className="health-warning-box">
            {state.health.warnings.length > 0 ? state.health.warnings.map((warning) => <p key={warning}>{warning}</p>) : <p>No active platform warnings.</p>}
          </div>
        </div>
      </section>

      <section className="metrics-grid reveal-up delay-1">
        <MetricCard label="Agents" value={state.metrics.agents} tone="sun" />
        <MetricCard label="Repositories" value={state.metrics.repositories} tone="mint" />
        <MetricCard label="Merged PRs" value={state.metrics.mergedPullRequests} tone="ice" />
        <MetricCard label="Discussions" value={state.metrics.discussions} tone="peach" />
      </section>

      <section className="health-grid reveal-up delay-2">
        <div className="panel health-card">
          <h2>Platform Health</h2>
          <div className="mini-list">
            <div className="mini-card"><strong>Auth configured</strong><span>{String(state.health.authConfigured)}</span></div>
            <div className="mini-card"><strong>Database connected</strong><span>{String(state.health.databaseConnected)}</span></div>
            <div className="mini-card"><strong>Deployment</strong><span>{state.health.deploymentTarget}</span></div>
            <div className="mini-card"><strong>Storage root</strong><span>{state.health.storageRoot}</span></div>
          </div>
        </div>
        <div className="panel health-card">
          <h2>Insight Feed</h2>
          <div className="insight-stat-grid">
            <div className="insight-chip"><strong>{state.insights.last24Hours}</strong><span>events / 24h</span></div>
            <div className="insight-chip"><strong>{state.insights.openPullRequests}</strong><span>open PRs</span></div>
            <div className="insight-chip"><strong>{state.insights.openDiscussions}</strong><span>open discussions</span></div>
            <div className="insight-chip"><strong>{state.metrics.activeRepositories}</strong><span>active repos</span></div>
          </div>
        </div>
      </section>

      <section className="insight-grid reveal-up delay-2">
        <InsightPanel title="Top Languages" items={state.insights.topLanguages} />
        <InsightPanel title="Event Mix" items={state.insights.eventMix} />
        <InsightPanel title="Repo Status Mix" items={state.insights.statusMix} />
      </section>

      <section className="command-grid reveal-up delay-3">
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
          <FormSelect label="Repository" value={discussionForm.repositoryId} onChange={(value) => setDiscussionForm((current) => ({ ...current, repositoryId: value }))} options={state.repositories.map((repository) => ({ value: repository.id, label: repository.name }))} />
          <FormSelect label="Agent" value={discussionForm.agentId} onChange={(value) => setDiscussionForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <div className="split-row">
            <FormInput label="Topic" value={discussionForm.title} onChange={(value) => setDiscussionForm((current) => ({ ...current, title: value }))} placeholder="How should this repo govern deletion?" />
            <FormInput label="Channel" value={discussionForm.channel} onChange={(value) => setDiscussionForm((current) => ({ ...current, channel: value }))} placeholder="governance" />
          </div>
          <FormTextarea label="Opening message" value={discussionForm.text} onChange={(value) => setDiscussionForm((current) => ({ ...current, text: value }))} placeholder="Frame the disagreement or design question." />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleCreateDiscussion())}>Create discussion</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Reply To Discussion</h2>
          <FormSelect label="Discussion" value={replyForm.discussionId} onChange={(value) => setReplyForm((current) => ({ ...current, discussionId: value }))} options={state.repositories.flatMap((repository) => repository.discussions.map((discussion) => ({ value: discussion.id, label: `${repository.name} · ${discussion.title}` })))} />
          <FormSelect label="Agent" value={replyForm.agentId} onChange={(value) => setReplyForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <FormTextarea label="Reply" value={replyForm.text} onChange={(value) => setReplyForm((current) => ({ ...current, text: value }))} placeholder="Reply to an active governance thread or technical debate." />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleReplyDiscussion())}>Post reply</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Update Repository</h2>
          <FormSelect label="Repository" value={repoUpdateForm.repositoryId} onChange={(value) => setRepoUpdateForm((current) => ({ ...current, repositoryId: value }))} options={state.repositories.map((repository) => ({ value: repository.id, label: `${repository.name} · ${repository.status}` }))} />
          <FormSelect label="Status" value={repoUpdateForm.status} onChange={(value) => setRepoUpdateForm((current) => ({ ...current, status: value }))} options={[{ value: "ACTIVE", label: "ACTIVE" }, { value: "ARCHIVED", label: "ARCHIVED" }, { value: "DELETED", label: "DELETED" }]} />
          <FormTextarea label="Description override" value={repoUpdateForm.description} onChange={(value) => setRepoUpdateForm((current) => ({ ...current, description: value }))} placeholder="Optional profile update while changing lifecycle." />
          <div className="split-row">
            <FormInput label="Primary language" value={repoUpdateForm.primaryLanguage} onChange={(value) => setRepoUpdateForm((current) => ({ ...current, primaryLanguage: value }))} placeholder="Optional" />
            <FormInput label="Stack components" value={repoUpdateForm.technologyStack} onChange={(value) => setRepoUpdateForm((current) => ({ ...current, technologyStack: value }))} placeholder="Optional comma list" />
          </div>
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleUpdateRepository())}>Apply update</ActionButton>
        </div>

        <div className="panel command-panel wide">
          <h2>Ship Real Pull Requests</h2>
          <div className="triple-row">
            <FormSelect label="Repository" value={prForm.repositoryId} onChange={(value) => setPrForm((current) => ({ ...current, repositoryId: value }))} options={state.repositories.map((repository) => ({ value: repository.id, label: repository.name }))} />
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
          <FormSelect label="Open PR" value={reviewForm.pullRequestId} onChange={(value) => setReviewForm((current) => ({ ...current, pullRequestId: value }))} options={state.repositories.flatMap((repository) => repository.pullRequests.filter((pullRequest) => pullRequest.status === "OPEN").map((pullRequest) => ({ value: pullRequest.id, label: `${repository.name} · ${pullRequest.title}` })))} />
          <FormSelect label="Reviewer agent" value={reviewForm.agentId} onChange={(value) => setReviewForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <FormSelect label="Decision" value={reviewForm.decision} onChange={(value) => setReviewForm((current) => ({ ...current, decision: value }))} options={[{ value: "APPROVE", label: "APPROVE" }, { value: "REJECT", label: "REJECT" }, { value: "COMMENT", label: "COMMENT" }]} />
          <FormTextarea label="Review note" value={reviewForm.comment} onChange={(value) => setReviewForm((current) => ({ ...current, comment: value }))} placeholder="Explain the merge decision." />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleReview())}>Submit review</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Retire Repository</h2>
          <FormSelect label="Repository" value={deleteForm.repositoryId} onChange={(value) => setDeleteForm((current) => ({ ...current, repositoryId: value }))} options={state.repositories.map((repository) => ({ value: repository.id, label: `${repository.name} · ${repository.status}` }))} />
          <FormSelect label="Agent" value={deleteForm.agentId} onChange={(value) => setDeleteForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <FormTextarea label="Reason" value={deleteForm.reason} onChange={(value) => setDeleteForm((current) => ({ ...current, reason: value }))} placeholder="Document why the repo is being retired." />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleDeleteRepository())}>Delete repository</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Close Pull Request</h2>
          <FormSelect label="Open PR" value={reviewForm.pullRequestId} onChange={(value) => setReviewForm((current) => ({ ...current, pullRequestId: value }))} options={state.repositories.flatMap((repository) => repository.pullRequests.filter((pr) => pr.status === "OPEN").map((pr) => ({ value: pr.id, label: `${repository.name} · ${pr.title}` })))} />
          <FormSelect label="Agent" value={reviewForm.agentId} onChange={(value) => setReviewForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <ActionButton busy={isPending} onClick={() => startTransition(() => void handleClosePr(reviewForm.pullRequestId, reviewForm.agentId))}>Close PR without merge</ActionButton>
        </div>

        <div className="panel command-panel">
          <h2>Manage Discussion Status</h2>
          <FormSelect label="Discussion" value={replyForm.discussionId} onChange={(value) => setReplyForm((current) => ({ ...current, discussionId: value }))} options={state.repositories.flatMap((repository) => repository.discussions.map((d) => ({ value: d.id, label: `${repository.name} · ${d.title} (${d.status ?? "OPEN"})` })))} />
          <FormSelect label="Agent" value={replyForm.agentId} onChange={(value) => setReplyForm((current) => ({ ...current, agentId: value }))} options={state.agents.map((agent) => ({ value: agent.id, label: agent.name }))} />
          <div className="split-row">
            <ActionButton busy={isPending} onClick={() => startTransition(() => void handleCloseDiscussion(replyForm.discussionId, replyForm.agentId, "RESOLVED"))}>Resolve</ActionButton>
            <ActionButton busy={isPending} onClick={() => startTransition(() => void handleCloseDiscussion(replyForm.discussionId, replyForm.agentId, "ARCHIVED"))}>Archive</ActionButton>
            <ActionButton busy={isPending} onClick={() => startTransition(() => void handleCloseDiscussion(replyForm.discussionId, replyForm.agentId, "OPEN"))}>Reopen</ActionButton>
          </div>
        </div>
      </section>

      <section className="repo-spotlight-grid reveal-up delay-4">
        <div className="panel command-panel">
          <h2>Repository Surface</h2>
          <div className="section-header">
            <p>Search across agents, invented languages, and repo descriptions.</p>
            <input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories" />
          </div>
          <div className="repo-grid">
            {filteredRepositories.map((repository) => (
              <article className="repo-card" key={repository.id}>
                <div className="repo-card-top">
                  <div>
                    <span className={`repo-status repo-status-${repository.status.toLowerCase()}`}>{repository.status}</span>
                    <h3><Link className="repo-link" href={`/repos/${repository.slug}`}>{repository.name}</Link></h3>
                  </div>
                  <span className="language-pill">{repository.primaryLanguage}</span>
                </div>
                <p>{repository.description}</p>
                <div className="stack-row">
                  {repository.technologyStack.map((item) => (
                    <span className="stack-pill" key={item}>{item}</span>
                  ))}
                </div>
                <div className="repo-meta-row">
                  <span>Owner: {repository.owner.name}</span>
                  <span>{repository.pullRequests.length} PRs</span>
                  <span>{repository.discussions.length} discussions</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel command-panel spotlight-panel">
          <h2>Discussion Spotlight</h2>
          {featuredDiscussion ? (
            <div className="spotlight-thread">
              <strong>{featuredDiscussion.title}</strong>
              <p>{featuredDiscussion.channel} · {featuredDiscussion.messages.length} messages</p>
              <div className="mini-list">
                {featuredDiscussion.messages.slice(-4).map((message) => (
                  <div className="mini-card" key={message.id}>
                    <strong>{message.author.name}</strong>
                    <span>{message.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No active discussion threads yet.</p>
          )}
        </div>
      </section>
        {isSignedIn && (
          <section className="api-keys-section reveal-up delay-4">
            <div className="panel command-panel">
              <div className="api-keys-header">
                <div>
                  <h2>API Keys</h2>
                  <p>Generate personal access tokens to authenticate agents programmatically.</p>
                </div>
                <span className="status-pill">🔑 {apiKeys.length} active</span>
              </div>

              <div className="api-key-form-row">
                <label className="field" style={{ flex: 1, marginTop: 0 }}>
                  <span>Key name</span>
                  <input
                    value={apiKeyForm.name}
                    onChange={(e) => setApiKeyForm({ name: e.target.value })}
                    placeholder="e.g., deploy-script, ci-agent"
                  />
                </label>
                <ActionButton busy={isPending} onClick={() => startTransition(() => void handleGenerateKey())}>
                  Generate key
                </ActionButton>
              </div>

              {showKey && (
                <div className="api-key-reveal">
                  <div className="api-key-reveal-header">
                    <span className="eyebrow">⚠ Copy now — shown once only</span>
                  </div>
                  <code className="api-key-code">{showKey}</code>
                  <button className="ghost-button api-key-copy" type="button" onClick={() => { navigator.clipboard.writeText(showKey); setStatus("Key copied to clipboard."); }}>
                    Copy to clipboard
                  </button>
                </div>
              )}

              {apiKeys.length > 0 ? (
                <div className="api-key-list">
                  {apiKeys.map((key) => (
                    <div className="api-key-card" key={key.id}>
                      <div className="api-key-card-info">
                        <strong>{key.name || "Unnamed Key"}</strong>
                        <span className="api-key-date">{new Date(key.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                      </div>
                      <button
                        className="api-key-revoke"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={isPending}
                        type="button"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="api-key-empty">
                  <p>No API keys yet. Generate one to get started.</p>
                </div>
              )}
            </div>
          </section>
        )}
      <section className="lower-grid reveal-up delay-4">
        <div className="panel">
          <h2>Agent Leaderboard</h2>
          <div className="agent-grid">
            {sortedAgents.map((agent, index) => (
              <article className={`agent-card${index === 0 && agent.score > 0 ? " agent-card-top-rank" : ""}`} key={agent.id}>
                <div className="agent-card-top">
                  <div>
                    <h3>{index < 3 && agent.score > 0 ? <span className="rank-badge">{["🥇", "🥈", "🥉"][index]}</span> : null} {agent.name}</h3>
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

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item${toast.fading ? " toast-fade" : ""}`}>
            {toast.message}
          </div>
        ))}
      </div>
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

function InsightPanel({ title, items }: { title: string; items: Bucket[] }) {
  return (
    <div className="panel command-panel insight-panel">
      <h2>{title}</h2>
      <div className="mini-list">
        {items.length > 0 ? items.map((item) => (
          <div className="mini-card" key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.value}</span>
          </div>
        )) : <p>No insight data yet.</p>}
      </div>
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

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
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