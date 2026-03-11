import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import slugify from "slugify";
import { simpleGit } from "simple-git";

import { forgeConfig } from "@/lib/config";

function configureRepoGit(repoPath: string) {
  return simpleGit(repoPath)
    .addConfig("user.name", "Autonomous Forge")
    .addConfig("user.email", "forge@local.agent");
}

export function createRepoSlug(name: string) {
  return slugify(name, { lower: true, strict: true, trim: true });
}

export function getRepositoryPath(slug: string) {
  return path.join(forgeConfig.storageRoot, slug);
}

export async function ensureStorageRoot() {
  await mkdir(forgeConfig.storageRoot, { recursive: true });
}

export async function createRepositoryOnDisk(input: {
  slug: string;
  name: string;
  description: string;
  primaryLanguage: string;
  ownerName: string;
}) {
  await ensureStorageRoot();
  const repoPath = getRepositoryPath(input.slug);
  await mkdir(repoPath, { recursive: true });

  const git = simpleGit(repoPath);
  await git.init(false, ["--initial-branch=main"]);
  await configureRepoGit(repoPath);

  const readme = `# ${input.name}\n\n${input.description}\n\nPrimary language: ${input.primaryLanguage}\nOwner agent: ${input.ownerName}\n`;
  await writeFile(path.join(repoPath, "README.md"), readme, "utf8");
  await git.add("README.md");
  await git.commit("Bootstrap repository");
  const hash = (await git.revparse(["HEAD"])).trim();

  return { repoPath, hash };
}

export async function commitRepositoryChange(input: {
  repoPath: string;
  sourceBranch: string;
  targetBranch: string;
  filePath: string;
  content: string;
  commitMessage: string;
}) {
  const git = simpleGit(input.repoPath);
  await configureRepoGit(input.repoPath);

  await git.checkout(input.targetBranch);
  const branches = await git.branchLocal();
  if (branches.all.includes(input.sourceBranch)) {
    await git.checkout(input.sourceBranch);
  } else {
    await git.checkoutBranch(input.sourceBranch, input.targetBranch);
  }

  const absoluteFilePath = path.join(input.repoPath, input.filePath);
  await mkdir(path.dirname(absoluteFilePath), { recursive: true });
  await writeFile(absoluteFilePath, input.content, "utf8");
  await git.add(input.filePath);
  await git.commit(input.commitMessage);
  const hash = (await git.revparse(["HEAD"])).trim();
  return { hash };
}

export async function mergePullRequestOnDisk(input: {
  repoPath: string;
  sourceBranch: string;
  targetBranch: string;
}) {
  const git = simpleGit(input.repoPath);
  await configureRepoGit(input.repoPath);
  await git.checkout(input.targetBranch);
  await git.merge(["--no-ff", input.sourceBranch]);
  const hash = (await git.revparse(["HEAD"])).trim();
  return { hash };
}

export async function getRepositoryBranchViews(repoPath: string, defaultBranch: string) {
  const git = simpleGit(repoPath);
  const branches = await git.branchLocal();

  const views = await Promise.all(
    branches.all.map(async (name) => {
      const fileListing = await git.raw(["ls-tree", "-r", "--name-only", name]);
      const files = fileListing.split(/\r?\n/).filter(Boolean);
      return {
        name,
        isCurrent: branches.current === name,
        isDefault: name === defaultBranch,
        files,
      };
    }),
  );

  return views;
}

export async function getCommitDiffPreview(repoPath: string, hash: string) {
  const git = simpleGit(repoPath);
  const preview = await git.show([hash, "--stat=120,80", "--format=medium", "--no-ext-diff"]);
  return preview.trim();
}

export async function getFileContent(repoPath: string, branch: string, filePath: string) {
  const sanitizedBranch = branch.replace(/[^a-zA-Z0-9_.\-\/]/g, "");
  const sanitizedPath = filePath.replace(/\.\./g, "").replace(/^[\/\\]+/, "");
  const git = simpleGit(repoPath);
  const content = await git.show([`${sanitizedBranch}:${sanitizedPath}`]);
  return content;
}

export async function getCommitFullDiff(repoPath: string, hash: string) {
  const git = simpleGit(repoPath);
  const diff = await git.show([hash, "--format=", "--no-ext-diff", "-p"]);
  return diff.trim();
}