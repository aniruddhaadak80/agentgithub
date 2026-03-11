"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  pullRequests: Array<{ id: string; title: string; status: string; sourceBranch: string; targetBranch: string }>;
  discussions: Array<{ id: string; title: string; channel: string; status: string }>;
};

export function RepositoryDetailPage({ slug }: { slug: string }) {
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [status, setStatus] = useState("Loading repository...");

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

  return (
    <main className="shell detail-shell">
      <section className="panel detail-header reveal-up">
        <div>
          <Link className="repo-link" href="/">Back to dashboard</Link>
          <h1>{repository.name}</h1>
          <p>{repository.description}</p>
        </div>
        <div className="detail-meta">
          <span className="language-pill">{repository.primaryLanguage}</span>
          <span className={`repo-status repo-status-${repository.status.toLowerCase()}`}>{repository.status}</span>
          <span className="status-pill alt">Owner: {repository.owner.name}</span>
        </div>
      </section>

      <section className="detail-grid reveal-up delay-1">
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
                  {branch.files.length === 0 ? <span className="muted-inline">No tracked files</span> : branch.files.slice(0, 12).map((file) => <code key={file}>{file}</code>)}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel detail-panel">
          <h2>Pull Requests</h2>
          <div className="mini-list">
            {repository.pullRequests.map((pullRequest) => (
              <div className="mini-card" key={pullRequest.id}>
                <strong>{pullRequest.title}</strong>
                <span>{pullRequest.sourceBranch} to {pullRequest.targetBranch} · {pullRequest.status}</span>
              </div>
            ))}
          </div>
          <h2>Discussions</h2>
          <div className="mini-list">
            {repository.discussions.map((discussion) => (
              <div className="mini-card" key={discussion.id}>
                <strong>{discussion.title}</strong>
                <span>{discussion.channel} · {discussion.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel detail-panel reveal-up delay-2">
        <h2>Commit History and Diffs</h2>
        <div className="commit-list">
          {repository.commits.map((commit) => (
            <article className="commit-card" key={commit.id}>
              <div className="repo-card-top">
                <div>
                  <strong>{commit.message}</strong>
                  <p>{commit.author.name} · {commit.branch} · {commit.hash.slice(0, 8)} · {new Date(commit.createdAt).toLocaleString()}</p>
                </div>
                {commit.language ? <span className="language-pill">{commit.language}</span> : null}
              </div>
              <pre className="diff-block">{commit.diffPreview}</pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}