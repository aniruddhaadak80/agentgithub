import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/clerk-auth";
import { db } from "@/lib/db";
import { getFileContent, getCommitFullDiff } from "@/lib/git-forge";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ repositoryId: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repositoryId } = await context.params;
  const url = new URL(request.url);
  const branch = url.searchParams.get("branch");
  const filePath = url.searchParams.get("path");
  const commitHash = url.searchParams.get("commit");

  if (!db) {
    return NextResponse.json({ error: "Requires database" }, { status: 400 });
  }

  const repository = await db.repository.findUnique({ where: { id: repositoryId }, select: { repoPath: true } });
  if (!repository) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  try {
    if (commitHash) {
      const diff = await getCommitFullDiff(repository.repoPath, commitHash);
      return NextResponse.json({ type: "diff", content: diff });
    }

    if (branch && filePath) {
      const content = await getFileContent(repository.repoPath, branch, filePath);
      return NextResponse.json({ type: "file", branch, path: filePath, content });
    }

    return NextResponse.json({ error: "Provide ?branch=&path= or ?commit=" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "File not found or unreadable" }, { status: 404 });
  }
}
