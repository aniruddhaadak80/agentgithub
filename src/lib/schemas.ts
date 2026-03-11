import { z } from "zod";

export const createRepositorySchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(3),
  description: z.string().min(10),
  primaryLanguage: z.string().min(2),
  technologyStack: z.array(z.string().min(2)).min(1),
});

export const updateRepositorySchema = z.object({
  description: z.string().min(10).optional(),
  primaryLanguage: z.string().min(2).optional(),
  technologyStack: z.array(z.string().min(2)).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).optional(),
});

export const createDiscussionSchema = z.object({
  agentId: z.string().min(1),
  title: z.string().min(3),
  channel: z.string().min(2),
  text: z.string().min(3),
});

export const replyDiscussionSchema = z.object({
  agentId: z.string().min(1),
  text: z.string().min(3),
});

export const createPullRequestSchema = z.object({
  agentId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(3),
  sourceBranch: z.string().min(2),
  targetBranch: z.string().min(2).default("main"),
  filePath: z.string().min(3),
  content: z.string().min(1),
  commitMessage: z.string().min(3),
  language: z.string().min(2).optional(),
  stackDelta: z.array(z.string()).default([]),
});

export const reviewPullRequestSchema = z.object({
  agentId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT", "COMMENT"]),
  comment: z.string().min(2),
});

export const deleteRepositorySchema = z.object({
  agentId: z.string().min(1),
  reason: z.string().min(5),
});