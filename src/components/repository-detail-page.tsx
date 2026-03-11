"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

type BranchView = {
  name: string;
  isCurrent: boolean;
  isDefault: boolean;
  files: string[];
};

type CommitView = {
  id: string;
  hash: string;
  branch: string;
  message: string;
  language?: string | null;
  createdAt: string;
  author: { name: string };
  diffPreview: string;
};

type RepositoryDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  primaryLanguage: string;
  technologyStack: string[];
  status: string;
  defaultBranch: string;
  owner: { name: string };
  branches: BranchView[];
  commits: CommitView[];
  pullRequests: Array<{
    id: string;
    title: string;
    status: string;
    sourceBranch: string;
    targetBranch: string;
    author?: { name: string };
    reviews?: Array<{ decision: string; reviewer: { name: string } }>;
  }>;
  discussions: Array<{
    id: string;
    title: string;
    channel: string;
    status: string;
    author?: { name: string };
    messages: Array<{ id: string; text: string; author: { name: string } }>;
  }>;
};

export function RepositoryDetailPage({ slug }: { slug: string }) {
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [status, setStatus] = useState("Loading repository...");
  const [activeFile, setActiveFile] = useState<{ branch: string; path: string; content: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [commitDiffs, setCommitDiffs] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch(`/api/repos/by-slug/${slug}`, { cache: "no-store" });
      if (!response.ok) {
        setStatus(response.status === 401 ? "Sign in on the home page to inspect repository detail." : "Repository not found.");
        return;
      }

      const payload = (await response.json()) as { repository: RepositoryDetail };
      if (active) {
        setRepository(payload.repository);
        setStatus("Repository loaded.");
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [slug]);

  const loadFileContent = useCallback(async (branch: string, filePath: string) => {
    if (!repository) return;
    if (activeFile?.branch === branch && activeFile?.path === filePath) {
      setActiveFile(null);
      return;
    }
    setFileLoading(true);
    try {
      const params = new URLSearchParams({ branch, path: filePath });
      const response = await fetch(`/api/repos/${repository.id}/files?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load file");
      const data = await response.json();
      setActiveFile({ branch, path: filePath, content: data.content });
    } catch {
      setActiveFile({ branch, path: filePath, content: "// Unable to load file content" });
    } finally {
      setFileLoading(false);
    }
  }, [repository, activeFile]);

  const loadCommitDiff = useCallback(async (commitHash: string) => {
    if (!repository) return;
    if (expandedCommit === commitHash) {
      setExpandedCommit(null);
      return;
    }
    setExpandedCommit(commitHash);
    if (commitDiffs[commitHash]) return;
    try {
      const params = new URLSearchParams({ commit: commitHash });
      const response = await fetch(`/api/repos/${repository.id}/files?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load diff");
      const data = await response.json();
      setCommitDiffs((prev) => ({ ...prev, [commitHash]: data.content }));
    } catch {
      setCommitDiffs((prev) => ({ ...prev, [commitHash]: "// Unable to load full diff" }));
    }
  }, [repository, expandedCommit, commitDiffs]);

  if (!repository) {
    return (
      <main className="shell detail-shell">
        <section className="panel detail-header">
          <Link className="repo-link" href="/">Back to dashboard</Link>
          <h1>{status}</h1>
        </section>
      </main>
    );
  }

  const mergedCount = repository.pullRequests.filter((pr) => pr.status === "MERGED").length;
  const openPrCount = repository.pullRequests.filter((pr) => pr.status === "OPEN").length;
  const contributors = [...new Set(repository.commits.map((c) => c.author.name))];

  return (
    <main className="shell detail-shell">
      <section className="panel detail-header reveal-up">
        <div>
          <Link className="repo-link" href="/">Back to dashboard</Link>
          <h1>{repository.name}</h1>
          <p>{repository.description}</p>
          {repository.technologyStack.length > 0 && (
            <div className="stack-row" style={{ marginTop: 8 }}>
              {repository.technologyStack.map((tech) => (
                <span className="stack-pill" key={tech}>{tech}</span>
              ))}
            </div>
          )}
        </div>
        <div className="detail-meta">
          <span className="language-pill">{repository.primaryLanguage}</span>
          <span className={`repo-status repo-status-${repository.status.toLowerCase()}`}>{repository.status}</span>
          <span className="status-pill alt">Owner: {repository.owner.name}</span>
          <span className="status-pill">Branches: {repository.branches.length}</span>
          <span className="status-pill">Commits: {repository.commits.length}</span>
        </div>
      </section>

      <section className="metrics-grid reveal-up delay-1">
        <div className="panel metric-card tone-mint"><span>Pull Requests</span><strong>{repository.pullRequests.length}</strong></div>
        <div className="panel metric-card tone-ice"><span>Merged</span><strong>{mergedCount}</strong></div>
        <div className="panel metric-card tone-sun"><span>Open PRs</span><strong>{openPrCount}</strong></div>
        <div className="panel metric-card tone-peach"><span>Discussions</span><strong>{repository.discussions.length}</strong></div>
      </section>

      {contributors.length > 0 && (
        <section className="panel reveal-up delay-1" style={{ marginBottom: 16 }}>
          <h2>Contributors</h2>
          <div className="stack-row">
            {contributors.map((name) => (
              <span className="status-pill alt" key={name}>{name}</span>
            ))}
          </div>
        </section>
      )}

      <section className="detail-grid reveal-up delay-2">
        <div className="panel detail-panel">
          <h2>Branches</h2>
          <div className="branch-grid">
            {repository.branches.map((branch) => (
              <article className="branch-card" key={branch.name}>
                <div className="repo-card-top">
                  <strong>{branch.name}</strong>
                  <div className="stack-row">
                    {branch.isDefault ? <span className="stack-pill">default</span> : null}
                    {branch.isCurrent ? <span className="stack-pill">current</span> : null}
                  </div>
                </div>
                <div className="file-tree">
                  {branch.files.length === 0 ? <span className="muted-inline">No tracked files</span> : branch.files.slice(0, 12).map((file) => (
                    <code
                      key={file}
                      className={`file-entry${activeFile?.branch === branch.name && activeFile?.path === file ? " file-active" : ""}`}
                      onClick={() => void loadFileContent(branch.name, file)}
                    >
                      {file}
                    </code>
                  ))}
                </div>
                {activeFile?.branch === branch.name && (
                  <div className="file-viewer-section">
                    <div className="file-viewer-header">
                      <strong>{activeFile.path}</strong>
                      <button className="file-viewer-close" onClick={() => setActiveFile(null)} type="button">Close</button>
                    </div>
                    <pre className="file-content-viewer">{fileLoading ? "Loading..." : activeFile.content}</pre>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="panel detail-panel">
          <h2>Pull Requests ({repository.pullRequests.length})</h2>
          <div className="mini-list">
            {repository.pullRequests.map((pullRequest) => (
              <div className="mini-card" key={pullRequest.id}>
                <div className="repo-card-top">
                  <strong>{pullRequest.title}</strong>
                  <span className={`repo-status repo-status-${pullRequest.status.toLowerCase()}`}>{pullRequest.status}</span>
                </div>
                <span>{pullRequest.author?.name ? `${pullRequest.author.name} · ` : ""}{pullRequest.sourceBranch} → {pullRequest.targetBranch}</span>
                {pullRequest.reviews && pullRequest.reviews.length > 0 && (
                  <div className="stack-row" style={{ marginTop: 4 }}>
                    {pullRequest.reviews.map((review, index) => (
                      <span key={index} className={`stack-pill ${review.decision === "APPROVE" ? "tone-approve" : review.decision === "REJECT" ? "tone-reject" : ""}`}>
                        {review.reviewer.name}: {review.decision}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {repository.pullRequests.length === 0 && <span className="muted-inline">No pull requests yet.</span>}
          </div>
        </div>
      </section>

      <section className="panel detail-panel reveal-up delay-3">
        <h2>Discussions ({repository.discussions.length})</h2>
        <div className="mini-list">
          {repository.discussions.map((discussion) => (
            <div className="mini-card" key={discussion.id}>
              <div className="repo-card-top">
                <strong>{discussion.title}</strong>
                <div className="stack-row">
                  <span className="stack-pill">{discussion.channel}</span>
                  <span className={`repo-status repo-status-${(discussion.status ?? "OPEN").toLowerCase()}`}>{discussion.status ?? "OPEN"}</span>
                </div>
              </div>
              {discussion.author && <span className="muted-inline">by {discussion.author.name}</span>}
              <div className="discussion-thread">
                {discussion.messages.map((message) => (
                  <div key={message.id} className="discussion-msg">
                    <strong>{message.author.name}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {repository.discussions.length === 0 && <span className="muted-inline">No discussions yet.</span>}
        </div>
      </section>

      <section className="panel detail-panel reveal-up delay-4">
        <h2>Commit History and Diffs</h2>
        <p className="section-subtitle">Click a commit to view the full diff. Summary diffs shown by default.</p>
        <div className="commit-list">
          {repository.commits.map((commit) => (
            <article
              className={`commit-card${expandedCommit === commit.hash ? " commit-expanded" : ""}`}
              key={commit.id}
              onClick={() => void loadCommitDiff(commit.hash)}
              style={{ cursor: "pointer" }}
            >
              <div className="repo-card-top">
                <div>
                  <strong>{commit.message}</strong>
                  <p>{commit.author.name} · {commit.branch} · {commit.hash.slice(0, 8)} · {new Date(commit.createdAt).toLocaleString()}</p>
                </div>
                {commit.language ? <span className="language-pill">{commit.language}</span> : null}
              </div>
              {expandedCommit === commit.hash && commitDiffs[commit.hash] ? (
                <pre className="file-content-viewer">{commitDiffs[commit.hash]}</pre>
              ) : (
                <pre className="diff-block">{commit.diffPreview}</pre>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}