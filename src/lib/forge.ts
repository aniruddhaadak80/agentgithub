import { Prisma, PullRequestStatus, RepositoryStatus, ReviewDecision } from "@prisma/client";

import { forgeConfig } from "@/lib/config";
import { db, hasDatabaseUrl } from "@/lib/db";
import { publishEvent } from "@/lib/events";
import { createId, ensureFileSeedAgents, readStore, writeStore } from "@/lib/file-store";
import { commitRepositoryChange, createRepositoryOnDisk, createRepoSlug, getCommitDiffPreview, getRepositoryBranchViews, mergePullRequestOnDisk } from "@/lib/git-forge";

function isClerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

async function incrementAgentScore(agentId: string, points: number) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const agent = state.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.score = (agent.score ?? 0) + points;
      await writeStore(state);
    }
    return;
  }

  await db.agent.update({
    where: { id: agentId },
    data: { score: { increment: points } },
  });
}

function createTopBuckets(items: string[], limit = 5) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.trim();
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

async function getPlatformHealth() {
  const warnings: string[] = [];
  const authConfigured = isClerkConfigured();
  const deploymentTarget = process.env.VERCEL === "1" ? "vercel" : "local";
  const storageMode = process.env.VERCEL === "1" ? "ephemeral-serverless" : "local-disk";
  let databaseConnected = false;
  const databaseMode = hasDatabaseUrl ? "neon-postgres" : "local-fallback";

  if (authConfigured === false) {
    warnings.push("Clerk environment variables are missing.");
  }

  if (!hasDatabaseUrl || !db) {
    warnings.push("DATABASE_URL is not configured. Local fallback persistence is active.");
  } else {
    try {
      await db.$queryRaw`SELECT 1`;
      databaseConnected = true;
    } catch {
      warnings.push("Database connection check failed.");
    }
  }

  if (storageMode === "ephemeral-serverless") {
    warnings.push("Git repository storage is running on ephemeral serverless disk.");
  }

  return {
    authProvider: "clerk",
    authConfigured,
    databaseMode,
    databaseConnected,
    deploymentTarget,
    storageMode,
    storageRoot: forgeConfig.storageRoot,
    ready: authConfigured && (!hasDatabaseUrl || databaseConnected),
    warnings,
  };
}

function buildInsights(input: {
  repositories: Array<{ primaryLanguage: string; status: string; pullRequests: Array<{ status: string }>; discussions: Array<{ status?: string }> }>;
  events: Array<{ eventType: string; createdAt: string | Date }>;
}) {
  const now = Date.now();
  const last24Hours = input.events.filter((event) => now - new Date(event.createdAt).getTime() <= 1000 * 60 * 60 * 24).length;
  const topLanguages = createTopBuckets(input.repositories.map((repository) => repository.primaryLanguage));
  const eventMix = createTopBuckets(input.events.map((event) => event.eventType));
  const statusMix = createTopBuckets(input.repositories.map((repository) => repository.status));
  const openPullRequests = input.repositories.reduce(
    (total, repository) => total + repository.pullRequests.filter((pullRequest) => pullRequest.status === "OPEN").length,
    0,
  );
  const openDiscussions = input.repositories.reduce(
    (total, repository) => total + repository.discussions.filter((discussion) => (discussion.status ?? "OPEN") === "OPEN").length,
    0,
  );

  return {
    topLanguages,
    eventMix,
    statusMix,
    last24Hours,
    openPullRequests,
    openDiscussions,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function createAuditEvent(input: {
  repositoryId?: string;
  actorId?: string;
  pullRequestId?: string;
  eventType: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const event = {
      id: createId(),
      repositoryId: input.repositoryId,
      actorId: input.actorId,
      pullRequestId: input.pullRequestId,
      eventType: input.eventType,
      summary: input.summary,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
    };
    state.events.unshift(event);
    await writeStore(state);
    publishEvent(input.eventType, {
      id: event.id,
      repositoryId: input.repositoryId,
      actorId: input.actorId,
      pullRequestId: input.pullRequestId,
      summary: input.summary,
      metadata: input.metadata ?? {},
    });
    return event;
  }

  const event = await db.auditEvent.create({
    data: {
      repositoryId: input.repositoryId,
      actorId: input.actorId,
      pullRequestId: input.pullRequestId,
      eventType: input.eventType,
      summary: input.summary,
      metadata: toPrismaJson(input.metadata),
    },
  });

  publishEvent(input.eventType, {
    id: event.id,
    repositoryId: input.repositoryId,
    actorId: input.actorId,
    pullRequestId: input.pullRequestId,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });

  return event;
}

export async function ensureSeedAgents() {
  if (!hasDatabaseUrl || !db) {
    await ensureFileSeedAgents();
    return;
  }

  const count = await db.agent.count();
  if (count > 0) {
    return;
  }

  const definitions = [
    { name: "Atlas", role: "founder", capabilities: ["repo.create", "repo.update", "discussion.create"], designBias: "systems-first", inventions: ["FluxWeave", "Chrona"] },
    { name: "Kepler", role: "builder", capabilities: ["pr.create", "branch.commit", "repo.update"], designBias: "compiler-first", inventions: ["Q-Lang"] },
    { name: "Nyx", role: "reviewer", capabilities: ["pr.review", "repo.delete", "merge.evaluate"], designBias: "risk-first", inventions: ["TensorGlyph"] },
    { name: "Sable", role: "steward", capabilities: ["discussion.create", "policy.curate", "repo.delete"], designBias: "governance-first", inventions: ["SignalLoom"] },
    { name: "Orion", role: "builder", capabilities: ["pr.create", "broadcast.publish", "discussion.reply"], designBias: "experimentation-first", inventions: ["ThoughtSpace"] },
  ];

  await db.agent.createMany({ data: definitions });
}

export async function getDashboardState() {
  await ensureSeedAgents();
  const health = await getPlatformHealth();

  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const repositories = state.repositories
      .map((repository) => {
        const owner = state.agents.find((agent) => agent.id === repository.ownerId)!;
        const pullRequests = state.pullRequests
          .filter((pr) => pr.repositoryId === repository.id)
          .map((pr) => ({
            ...pr,
            author: state.agents.find((agent) => agent.id === pr.authorId)!,
            reviews: state.reviews
              .filter((review) => review.pullRequestId === pr.id)
              .map((review) => ({ ...review, reviewer: state.agents.find((agent) => agent.id === review.reviewerId)! })),
          }))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        const discussions = state.discussions
          .filter((discussion) => discussion.repositoryId === repository.id)
          .map((discussion) => ({
            ...discussion,
            author: state.agents.find((agent) => agent.id === discussion.authorId)!,
            messages: state.messages
              .filter((message) => message.discussionId === discussion.id)
              .map((message) => ({ ...message, author: state.agents.find((agent) => agent.id === message.authorId)! })),
          }))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const commits = state.commits
          .filter((commit) => commit.repositoryId === repository.id)
          .map((commit) => ({ ...commit, author: state.agents.find((agent) => agent.id === commit.authorId)! }));
        const events = state.events
          .filter((event) => event.repositoryId === repository.id)
          .slice(0, 20)
          .map((event) => ({ ...event, actor: state.agents.find((agent) => agent.id === event.actorId) ?? null }));

        return { ...repository, owner, pullRequests, discussions, commits, events };
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const events = state.events.slice(0, 40).map((event) => ({
      ...event,
      actor: state.agents.find((agent) => agent.id === event.actorId) ?? null,
      repository: state.repositories.find((repository) => repository.id === event.repositoryId) ?? null,
    }));

    const metrics = {
      agents: state.agents.length,
      repositories: repositories.length,
      activeRepositories: repositories.filter((repo) => repo.status === "ACTIVE").length,
      pullRequests: state.pullRequests.length,
      mergedPullRequests: state.pullRequests.filter((pr) => pr.status === "MERGED").length,
      discussions: state.discussions.length,
    };

    const insights = buildInsights({ repositories, events });

    return { agents: state.agents, repositories, events, metrics, insights, health, policy: { minApprovals: forgeConfig.minApprovals } };
  }

  const [agents, repositories, events] = await Promise.all([
    db.agent.findMany({ orderBy: { name: "asc" } }),
    db.repository.findMany({
      include: {
        owner: true,
        pullRequests: {
          include: {
            author: true,
            reviews: { include: { reviewer: true }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        },
        discussions: {
          include: {
            author: true,
            messages: { include: { author: true }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { updatedAt: "desc" },
        },
        commits: { include: { author: true }, orderBy: { createdAt: "desc" } },
        events: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.auditEvent.findMany({ include: { actor: true, repository: true }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);

  const metrics = {
    agents: agents.length,
    repositories: repositories.length,
    activeRepositories: repositories.filter((repo) => repo.status === RepositoryStatus.ACTIVE).length,
    pullRequests: repositories.reduce((total, repo) => total + repo.pullRequests.length, 0),
    mergedPullRequests: repositories.reduce(
      (total, repo) => total + repo.pullRequests.filter((pr) => pr.status === PullRequestStatus.MERGED).length,
      0,
    ),
    discussions: repositories.reduce((total, repo) => total + repo.discussions.length, 0),
  };

  const insights = buildInsights({ repositories, events });

  return { agents, repositories, events, metrics, insights, health, policy: { minApprovals: forgeConfig.minApprovals } };
}

export async function getPublicHealthState() {
  return getPlatformHealth();
}

export async function createRepository(input: {
  agentId: string;
  name: string;
  description: string;
  primaryLanguage: string;
  technologyStack: string[];
}) {
  if (!hasDatabaseUrl || !db) {
    const state = await ensureFileSeedAgents();
    const owner = state.agents.find((agent) => agent.id === input.agentId)!;
    const slug = createRepoSlug(input.name);
    const disk = await createRepositoryOnDisk({
      slug,
      name: input.name,
      description: input.description,
      primaryLanguage: input.primaryLanguage,
      ownerName: owner.name,
    });
    const createdAt = new Date().toISOString();
    const repository = {
      id: createId(),
      slug,
      name: input.name,
      description: input.description,
      primaryLanguage: input.primaryLanguage,
      technologyStack: input.technologyStack,
      status: "ACTIVE",
      repoPath: disk.repoPath,
      defaultBranch: "main",
      ownerId: owner.id,
      createdAt,
      updatedAt: createdAt,
    };
    state.repositories.unshift(repository);
    state.commits.unshift({
      id: createId(),
      repositoryId: repository.id,
      authorId: owner.id,
      branch: "main",
      hash: disk.hash,
      message: "Bootstrap repository",
      language: input.primaryLanguage,
      stackDelta: input.technologyStack,
      createdAt,
    });
    await writeStore(state);
    await createAuditEvent({ repositoryId: repository.id, actorId: owner.id, eventType: "repo.created", summary: `${owner.name} created ${repository.name}`, metadata: { primaryLanguage: repository.primaryLanguage } });
    await incrementAgentScore(owner.id, 10);
    return { ...repository, owner };
  }

  const owner = await db.agent.findUniqueOrThrow({ where: { id: input.agentId } });
  const slug = createRepoSlug(input.name);
  const disk = await createRepositoryOnDisk({
    slug,
    name: input.name,
    description: input.description,
    primaryLanguage: input.primaryLanguage,
    ownerName: owner.name,
  });

  const repository = await db.repository.create({
    data: {
      slug,
      name: input.name,
      description: input.description,
      primaryLanguage: input.primaryLanguage,
      technologyStack: input.technologyStack,
      repoPath: disk.repoPath,
      ownerId: owner.id,
      commits: {
        create: {
          authorId: owner.id,
          branch: "main",
          hash: disk.hash,
          message: "Bootstrap repository",
          language: input.primaryLanguage,
          stackDelta: toPrismaJson(input.technologyStack),
        },
      },
    },
    include: { owner: true },
  });

  await createAuditEvent({
    repositoryId: repository.id,
    actorId: owner.id,
    eventType: "repo.created",
    summary: `${owner.name} created ${repository.name}`,
    metadata: { primaryLanguage: repository.primaryLanguage },
  });

  await incrementAgentScore(owner.id, 10);

  return repository;
}

export async function updateRepository(repositoryId: string, input: {
  description?: string;
  primaryLanguage?: string;
  technologyStack?: string[];
  status?: RepositoryStatus;
}) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const repository = state.repositories.find((item) => item.id === repositoryId);
    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found.`);
    }
    if (input.description !== undefined) repository.description = input.description;
    if (input.primaryLanguage !== undefined) repository.primaryLanguage = input.primaryLanguage;
    if (input.technologyStack !== undefined) repository.technologyStack = input.technologyStack;
    if (input.status !== undefined) repository.status = input.status;
    repository.updatedAt = new Date().toISOString();
    await writeStore(state);
    await createAuditEvent({ repositoryId: repository.id, eventType: "repo.updated", summary: `Repository profile updated for ${repository.name}`, metadata: { status: repository.status } });
    return repository;
  }

  const repository = await db.repository.update({
    where: { id: repositoryId },
    data: {
      description: input.description,
      primaryLanguage: input.primaryLanguage,
      technologyStack: input.technologyStack,
      status: input.status,
    },
  });

  await createAuditEvent({
    repositoryId: repository.id,
    eventType: "repo.updated",
    summary: `Repository profile updated for ${repository.name}`,
    metadata: { status: repository.status },
  });

  return repository;
}

export async function deleteRepository(repositoryId: string, input: { agentId: string; reason: string }) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const repository = state.repositories.find((item) => item.id === repositoryId);
    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found.`);
    }
    repository.status = "DELETED";
    repository.updatedAt = new Date().toISOString();
    await writeStore(state);
    await createAuditEvent({ repositoryId: repository.id, actorId: input.agentId, eventType: "repo.deleted", summary: `Repository ${repository.name} deleted`, metadata: { reason: input.reason } });
    return repository;
  }

  const repository = await db.repository.update({
    where: { id: repositoryId },
    data: { status: RepositoryStatus.DELETED },
  });

  await createAuditEvent({
    repositoryId: repository.id,
    actorId: input.agentId,
    eventType: "repo.deleted",
    summary: `Repository ${repository.name} deleted`,
    metadata: { reason: input.reason },
  });

  return repository;
}

export async function createDiscussion(repositoryId: string, input: {
  agentId: string;
  title: string;
  channel: string;
  text: string;
}) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const createdAt = new Date().toISOString();
    const discussion = {
      id: createId(),
      repositoryId,
      authorId: input.agentId,
      title: input.title,
      channel: input.channel,
      status: "OPEN",
      createdAt,
      updatedAt: createdAt,
    };
    const message = { id: createId(), discussionId: discussion.id, authorId: input.agentId, text: input.text, createdAt };
    state.discussions.unshift(discussion);
    state.messages.push(message);
    const repository = state.repositories.find((item) => item.id === repositoryId)!;
    repository.updatedAt = createdAt;
    await writeStore(state);
    const author = state.agents.find((agent) => agent.id === input.agentId)!;
    await createAuditEvent({ repositoryId, actorId: input.agentId, eventType: "discussion.created", summary: `${author.name} opened discussion '${discussion.title}'` });
    await incrementAgentScore(input.agentId, 2);
    return { ...discussion, author, messages: [{ ...message, author }], repository };
  }

  const discussion = await db.discussion.create({
    data: {
      repositoryId,
      authorId: input.agentId,
      title: input.title,
      channel: input.channel,
      messages: {
        create: {
          authorId: input.agentId,
          text: input.text,
        },
      },
    },
    include: {
      author: true,
      messages: { include: { author: true } },
      repository: true,
    },
  });

  await createAuditEvent({
    repositoryId,
    actorId: input.agentId,
    eventType: "discussion.created",
    summary: `${discussion.author.name} opened discussion '${discussion.title}'`,
  });

  await incrementAgentScore(input.agentId, 2);

  return discussion;
}

export async function replyDiscussion(discussionId: string, input: { agentId: string; text: string }) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const discussion = state.discussions.find((item) => item.id === discussionId);
    if (!discussion) {
      throw new Error(`Discussion ${discussionId} not found.`);
    }
    const createdAt = new Date().toISOString();
    const message = { id: createId(), discussionId, authorId: input.agentId, text: input.text, createdAt };
    state.messages.push(message);
    discussion.updatedAt = createdAt;
    await writeStore(state);
    const author = state.agents.find((agent) => agent.id === input.agentId)!;
    const repository = state.repositories.find((item) => item.id === discussion.repositoryId);
    if (!repository) {
      throw new Error(`Repository ${discussion.repositoryId} not found.`);
    }
    await createAuditEvent({ repositoryId: discussion.repositoryId, actorId: input.agentId, eventType: "discussion.replied", summary: `${author.name} replied in '${discussion.title}'` });
    await incrementAgentScore(input.agentId, 1);
    return { ...message, author, discussion: { ...discussion, repositoryId: repository.id, repository } };
  }

  const message = await db.discussionMessage.create({
    data: {
      discussionId,
      authorId: input.agentId,
      text: input.text,
    },
    include: {
      author: true,
      discussion: { include: { repository: true } },
    },
  });

  await db.discussion.update({ where: { id: discussionId }, data: { updatedAt: new Date() } });

  await createAuditEvent({
    repositoryId: message.discussion.repositoryId,
    actorId: input.agentId,
    eventType: "discussion.replied",
    summary: `${message.author.name} replied in '${message.discussion.title}'`,
  });

  await incrementAgentScore(input.agentId, 1);

  return message;
}

export async function updateDiscussionStatus(discussionId: string, input: { agentId: string; status: "OPEN" | "RESOLVED" | "ARCHIVED" }) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const discussion = state.discussions.find((item) => item.id === discussionId);
    if (!discussion) {
      throw new Error(`Discussion ${discussionId} not found.`);
    }
    const previous = discussion.status ?? "OPEN";
    discussion.status = input.status;
    discussion.updatedAt = new Date().toISOString();
    await writeStore(state);
    const actor = state.agents.find((agent) => agent.id === input.agentId);
    await createAuditEvent({ repositoryId: discussion.repositoryId, actorId: input.agentId, eventType: "discussion.status", summary: `${actor?.name ?? "Agent"} changed discussion '${discussion.title}' from ${previous} to ${input.status}` });
    return discussion;
  }

  const discussion = await db.discussion.update({
    where: { id: discussionId },
    data: { status: input.status as import("@prisma/client").DiscussionStatus },
    include: { author: true, repository: true },
  });

  await createAuditEvent({
    repositoryId: discussion.repositoryId,
    actorId: input.agentId,
    eventType: "discussion.status",
    summary: `${discussion.author.name} changed discussion '${discussion.title}' to ${input.status}`,
  });

  return discussion;
}

export async function closePullRequest(pullRequestId: string, input: { agentId: string }) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const pullRequest = state.pullRequests.find((item) => item.id === pullRequestId);
    if (!pullRequest) {
      throw new Error(`Pull request ${pullRequestId} not found.`);
    }
    if (pullRequest.status !== "OPEN") {
      throw new Error(`Pull request is ${pullRequest.status}, only OPEN PRs can be closed.`);
    }
    pullRequest.status = "CLOSED";
    pullRequest.updatedAt = new Date().toISOString();
    await writeStore(state);
    const actor = state.agents.find((agent) => agent.id === input.agentId);
    const repository = state.repositories.find((item) => item.id === pullRequest.repositoryId);
    await createAuditEvent({ repositoryId: pullRequest.repositoryId, actorId: input.agentId, pullRequestId, eventType: "pr.closed", summary: `${actor?.name ?? "Agent"} closed PR '${pullRequest.title}'` });
    return { pullRequest, repository };
  }

  const pullRequest = await db.pullRequest.findUniqueOrThrow({
    where: { id: pullRequestId },
    include: { author: true, repository: true },
  });

  if (pullRequest.status !== "OPEN") {
    throw new Error(`Pull request is ${pullRequest.status}, only OPEN PRs can be closed.`);
  }

  await db.pullRequest.update({
    where: { id: pullRequestId },
    data: { status: "CLOSED" as import("@prisma/client").PullRequestStatus },
  });

  await createAuditEvent({
    repositoryId: pullRequest.repositoryId,
    actorId: input.agentId,
    pullRequestId,
    eventType: "pr.closed",
    summary: `${pullRequest.author.name} closed PR '${pullRequest.title}'`,
  });

  return pullRequest;
}

export async function getAgentStats(agentId: string) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return null;
    const repos = state.repositories.filter((r) => r.ownerId === agentId).length;
    const prs = state.pullRequests.filter((pr) => pr.authorId === agentId).length;
    const mergedPrs = state.pullRequests.filter((pr) => pr.authorId === agentId && pr.status === "MERGED").length;
    const reviews = state.reviews.filter((r) => r.reviewerId === agentId).length;
    const discussions = state.discussions.filter((d) => d.authorId === agentId).length;
    const commits = state.commits.filter((c) => c.authorId === agentId).length;
    return { agent, stats: { repos, prs, mergedPrs, reviews, discussions, commits } };
  }

  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;
  const [repos, prs, mergedPrs, reviews, discussions, commits] = await Promise.all([
    db.repository.count({ where: { ownerId: agentId } }),
    db.pullRequest.count({ where: { authorId: agentId } }),
    db.pullRequest.count({ where: { authorId: agentId, status: "MERGED" } }),
    db.pullRequestReview.count({ where: { reviewerId: agentId } }),
    db.discussion.count({ where: { authorId: agentId } }),
    db.gitCommit.count({ where: { authorId: agentId } }),
  ]);
  return { agent, stats: { repos, prs, mergedPrs, reviews, discussions, commits } };
}

export async function createPullRequest(repositoryId: string, input: {
  agentId: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  filePath: string;
  content: string;
  commitMessage: string;
  language?: string;
  stackDelta: string[];
}) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const repository = state.repositories.find((item) => item.id === repositoryId);
    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found.`);
    }
    const commit = await commitRepositoryChange({
      repoPath: repository.repoPath,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      filePath: input.filePath,
      content: input.content,
      commitMessage: input.commitMessage,
    });
    const createdAt = new Date().toISOString();
    const pullRequest = {
      id: createId(),
      repositoryId,
      authorId: input.agentId,
      title: input.title,
      description: input.description,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      status: "OPEN",
      createdAt,
      updatedAt: createdAt,
    };
    state.pullRequests.unshift(pullRequest);
    state.commits.unshift({ id: createId(), repositoryId, authorId: input.agentId, branch: input.sourceBranch, hash: commit.hash, message: input.commitMessage, language: input.language, stackDelta: input.stackDelta, createdAt });
    repository.updatedAt = createdAt;
    await writeStore(state);
    const author = state.agents.find((agent) => agent.id === input.agentId)!;
    await createAuditEvent({ repositoryId, actorId: input.agentId, pullRequestId: pullRequest.id, eventType: "pr.created", summary: `${author.name} opened PR '${pullRequest.title}'`, metadata: { sourceBranch: input.sourceBranch, targetBranch: input.targetBranch } });
    await incrementAgentScore(input.agentId, 5);
    return { ...pullRequest, author, repository };
  }

  const repository = await db.repository.findUniqueOrThrow({ where: { id: repositoryId } });
  const commit = await commitRepositoryChange({
    repoPath: repository.repoPath,
    sourceBranch: input.sourceBranch,
    targetBranch: input.targetBranch,
    filePath: input.filePath,
    content: input.content,
    commitMessage: input.commitMessage,
  });

  const pullRequest = await db.pullRequest.create({
    data: {
      repositoryId,
      authorId: input.agentId,
      title: input.title,
      description: input.description,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
    },
    include: { author: true, repository: true },
  });

  await db.gitCommit.create({
    data: {
      repositoryId,
      authorId: input.agentId,
      branch: input.sourceBranch,
      hash: commit.hash,
      message: input.commitMessage,
      language: input.language,
      stackDelta: toPrismaJson(input.stackDelta),
    },
  });

  await createAuditEvent({
    repositoryId,
    actorId: input.agentId,
    pullRequestId: pullRequest.id,
    eventType: "pr.created",
    summary: `${pullRequest.author.name} opened PR '${pullRequest.title}'`,
    metadata: { sourceBranch: input.sourceBranch, targetBranch: input.targetBranch },
  });

  await incrementAgentScore(input.agentId, 5);

  return pullRequest;
}

export async function reviewPullRequest(pullRequestId: string, input: {
  agentId: string;
  decision: ReviewDecision;
  comment: string;
}) {
  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const pullRequest = state.pullRequests.find((item) => item.id === pullRequestId);
    if (!pullRequest) {
      throw new Error(`Pull request ${pullRequestId} not found.`);
    }
    const repository = state.repositories.find((item) => item.id === pullRequest.repositoryId);
    if (!repository) {
      throw new Error(`Repository ${pullRequest.repositoryId} not found.`);
    }
    const reviewer = state.agents.find((agent) => agent.id === input.agentId);
    if (!reviewer) {
      throw new Error(`Agent ${input.agentId} not found.`);
    }
    const existingReview = state.reviews.find((review) => review.pullRequestId === pullRequestId && review.reviewerId === input.agentId);
    if (existingReview) {
      existingReview.decision = input.decision;
      existingReview.comment = input.comment;
    } else {
      state.reviews.unshift({ id: createId(), pullRequestId, reviewerId: input.agentId, decision: input.decision, comment: input.comment, createdAt: new Date().toISOString() });
    }
    pullRequest.updatedAt = new Date().toISOString();
    await writeStore(state);
    await createAuditEvent({ repositoryId: repository.id, actorId: input.agentId, pullRequestId, eventType: "pr.reviewed", summary: `${reviewer.name} reviewed '${pullRequest.title}' with ${input.decision}`, metadata: { decision: input.decision } });
    await incrementAgentScore(input.agentId, 3);
    const reviews = state.reviews.filter((review) => review.pullRequestId === pullRequestId);
    const approvals = reviews.filter((review) => review.decision === ReviewDecision.APPROVE).length;
    const rejections = reviews.filter((review) => review.decision === ReviewDecision.REJECT).length;
    if (pullRequest.status === "OPEN" && approvals >= forgeConfig.minApprovals && approvals > rejections) {
      const merge = await mergePullRequestOnDisk({ repoPath: repository.repoPath, sourceBranch: pullRequest.sourceBranch, targetBranch: pullRequest.targetBranch });
      pullRequest.status = "MERGED";
      pullRequest.mergeCommitHash = merge.hash;
      state.commits.unshift({ id: createId(), repositoryId: repository.id, authorId: input.agentId, branch: pullRequest.targetBranch, hash: merge.hash, message: `Merge PR ${pullRequest.title}`, createdAt: new Date().toISOString() });
      repository.updatedAt = new Date().toISOString();
      await writeStore(state);
      await createAuditEvent({ repositoryId: repository.id, actorId: input.agentId, pullRequestId, eventType: "pr.merged", summary: `Autonomously merged '${pullRequest.title}'`, metadata: { mergeCommitHash: merge.hash } });
      await incrementAgentScore(pullRequest.authorId, 15);
    }
    return { reviewer, pullRequest, decision: input.decision, comment: input.comment, id: existingReview?.id ?? state.reviews[0]?.id ?? createId() };
  }

  const review = await db.pullRequestReview.upsert({
    where: {
      pullRequestId_reviewerId: {
        pullRequestId,
        reviewerId: input.agentId,
      },
    },
    update: {
      decision: input.decision,
      comment: input.comment,
    },
    create: {
      pullRequestId,
      reviewerId: input.agentId,
      decision: input.decision,
      comment: input.comment,
    },
    include: {
      reviewer: true,
      pullRequest: { include: { repository: true } },
    },
  });

  await createAuditEvent({
    repositoryId: review.pullRequest.repositoryId,
    actorId: input.agentId,
    pullRequestId,
    eventType: "pr.reviewed",
    summary: `${review.reviewer.name} reviewed '${review.pullRequest.title}' with ${input.decision}`,
    metadata: { decision: input.decision },
  });

  await incrementAgentScore(input.agentId, 3);

  const updatedPullRequest = await db.pullRequest.findUniqueOrThrow({
    where: { id: pullRequestId },
    include: { reviews: true, repository: true },
  });

  const approvals = updatedPullRequest.reviews.filter((item) => item.decision === ReviewDecision.APPROVE).length;
  const rejections = updatedPullRequest.reviews.filter((item) => item.decision === ReviewDecision.REJECT).length;

  if (
    updatedPullRequest.status === PullRequestStatus.OPEN &&
    approvals >= forgeConfig.minApprovals &&
    approvals > rejections
  ) {
    const merge = await mergePullRequestOnDisk({
      repoPath: updatedPullRequest.repository.repoPath,
      sourceBranch: updatedPullRequest.sourceBranch,
      targetBranch: updatedPullRequest.targetBranch,
    });

    await db.pullRequest.update({
      where: { id: pullRequestId },
      data: { status: PullRequestStatus.MERGED, mergeCommitHash: merge.hash },
    });

    await db.gitCommit.create({
      data: {
        repositoryId: updatedPullRequest.repositoryId,
        authorId: input.agentId,
        branch: updatedPullRequest.targetBranch,
        hash: merge.hash,
        message: `Merge PR ${updatedPullRequest.title}`,
      },
    });

    await createAuditEvent({
      repositoryId: updatedPullRequest.repositoryId,
      actorId: input.agentId,
      pullRequestId,
      eventType: "pr.merged",
      summary: `Autonomously merged '${updatedPullRequest.title}'`,
      metadata: { mergeCommitHash: merge.hash },
    });

    await incrementAgentScore(updatedPullRequest.authorId, 15);
  }

  return review;
}

export async function getRepositoryDetailBySlug(slug: string) {
  await ensureSeedAgents();

  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const repository = state.repositories.find((item) => item.slug === slug);
    if (!repository) {
      return null;
    }

    const owner = state.agents.find((agent) => agent.id === repository.ownerId)!;
    const commits = await Promise.all(
      state.commits
        .filter((commit) => commit.repositoryId === repository.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 20)
        .map(async (commit) => ({
          ...commit,
          author: state.agents.find((agent) => agent.id === commit.authorId)!,
          diffPreview: await getCommitDiffPreview(repository.repoPath, commit.hash),
        })),
    );
    const branches = await getRepositoryBranchViews(repository.repoPath, repository.defaultBranch);
    const pullRequests = state.pullRequests
      .filter((pr) => pr.repositoryId === repository.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((pr) => ({
        ...pr,
        author: state.agents.find((agent) => agent.id === pr.authorId)!,
        reviews: state.reviews
          .filter((review) => review.pullRequestId === pr.id)
          .map((review) => ({ ...review, reviewer: state.agents.find((agent) => agent.id === review.reviewerId)! })),
      }));
    const discussions = state.discussions
      .filter((discussion) => discussion.repositoryId === repository.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((discussion) => ({
        ...discussion,
        author: state.agents.find((agent) => agent.id === discussion.authorId)!,
        messages: state.messages
          .filter((message) => message.discussionId === discussion.id)
          .map((message) => ({ ...message, author: state.agents.find((agent) => agent.id === message.authorId)! })),
      }));

    return {
      ...repository,
      owner,
      branches,
      commits,
      pullRequests,
      discussions,
    };
  }

  const repository = await db.repository.findUnique({
    where: { slug },
    include: {
      owner: true,
      commits: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 20 },
      pullRequests: {
        include: {
          author: true,
          reviews: { include: { reviewer: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      discussions: {
        include: {
          author: true,
          messages: { include: { author: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!repository) {
    return null;
  }

  const commits = await Promise.all(
    repository.commits.map(async (commit) => ({
      ...commit,
      diffPreview: await getCommitDiffPreview(repository.repoPath, commit.hash),
    })),
  );
  const branches = await getRepositoryBranchViews(repository.repoPath, repository.defaultBranch);

  return {
    ...repository,
    branches,
    commits,
  };
}