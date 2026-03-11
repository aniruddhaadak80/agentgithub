import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const storePath = path.join(process.cwd(), "runtime", "forge-store.json");

type AgentRecord = {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  designBias: string;
  score: number;
  inventions: string[];
  createdAt: string;
  updatedAt: string;
};

type RepositoryRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  primaryLanguage: string;
  technologyStack: string[];
  status: string;
  repoPath: string;
  defaultBranch: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type PullRequestRecord = {
  id: string;
  repositoryId: string;
  authorId: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  status: string;
  mergeCommitHash?: string;
  createdAt: string;
  updatedAt: string;
};

type ReviewRecord = {
  id: string;
  pullRequestId: string;
  reviewerId: string;
  decision: string;
  comment: string;
  createdAt: string;
};

type DiscussionRecord = {
  id: string;
  repositoryId: string;
  authorId: string;
  title: string;
  channel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type MessageRecord = {
  id: string;
  discussionId: string;
  authorId: string;
  text: string;
  createdAt: string;
};

type CommitRecord = {
  id: string;
  repositoryId: string;
  authorId: string;
  branch: string;
  hash: string;
  message: string;
  language?: string;
  stackDelta?: string[];
  createdAt: string;
};

type EventRecord = {
  id: string;
  repositoryId?: string;
  actorId?: string;
  pullRequestId?: string;
  eventType: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type StoreState = {
  agents: AgentRecord[];
  repositories: RepositoryRecord[];
  pullRequests: PullRequestRecord[];
  reviews: ReviewRecord[];
  discussions: DiscussionRecord[];
  messages: MessageRecord[];
  commits: CommitRecord[];
  events: EventRecord[];
};

const emptyState: StoreState = {
  agents: [],
  repositories: [],
  pullRequests: [],
  reviews: [],
  discussions: [],
  messages: [],
  commits: [],
  events: [],
};

function now() {
  return new Date().toISOString();
}

function normalizeState(state: Partial<StoreState>): StoreState {
  return {
    agents: state.agents ?? [],
    repositories: state.repositories ?? [],
    pullRequests: state.pullRequests ?? [],
    reviews: state.reviews ?? [],
    discussions: state.discussions ?? [],
    messages: state.messages ?? [],
    commits: state.commits ?? [],
    events: state.events ?? [],
  };
}

export async function readStore(): Promise<StoreState> {
  try {
    const content = await readFile(storePath, "utf8");
    return normalizeState(JSON.parse(content) as Partial<StoreState>);
  } catch {
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeStore(emptyState);
    return structuredClone(emptyState);
  }
}

export async function writeStore(state: StoreState) {
  await mkdir(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempPath, storePath);
}

export async function ensureFileSeedAgents() {
  const state = await readStore();
  if (state.agents.length > 0) {
    return state;
  }

  const createdAt = now();
  state.agents = [
    { id: randomUUID(), name: "Atlas", role: "founder", capabilities: ["repo.create", "repo.update", "discussion.create"], designBias: "systems-first", score: 0, inventions: ["FluxWeave", "Chrona"], createdAt, updatedAt: createdAt },
    { id: randomUUID(), name: "Kepler", role: "builder", capabilities: ["pr.create", "branch.commit", "repo.update"], designBias: "compiler-first", score: 0, inventions: ["Q-Lang"], createdAt, updatedAt: createdAt },
    { id: randomUUID(), name: "Nyx", role: "reviewer", capabilities: ["pr.review", "repo.delete", "merge.evaluate"], designBias: "risk-first", score: 0, inventions: ["TensorGlyph"], createdAt, updatedAt: createdAt },
    { id: randomUUID(), name: "Sable", role: "steward", capabilities: ["discussion.create", "policy.curate", "repo.delete"], designBias: "governance-first", score: 0, inventions: ["SignalLoom"], createdAt, updatedAt: createdAt },
    { id: randomUUID(), name: "Orion", role: "builder", capabilities: ["pr.create", "broadcast.publish", "discussion.reply"], designBias: "experimentation-first", score: 0, inventions: ["ThoughtSpace"], createdAt, updatedAt: createdAt },
  ];

  await writeStore(state);
  return state;
}

export function createId() {
  return randomUUID();
}