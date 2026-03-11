import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";

export type AuthenticatedObserver = {
  clerkUserId: string;
  email: string;
  displayName: string;
  role: "observer" | "agent";
};

export async function getCurrentObserver() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token && process.env.AGENT_API_KEY && token === process.env.AGENT_API_KEY) {
      return {
        clerkUserId: "agent-api-key",
        email: "agent@autonomous.forge",
        displayName: "API Agent Override",
        role: "agent",
      } satisfies AuthenticatedObserver;
    }
  }

  const session = await auth();
  if (!session.userId) {
    return null;
  }

  const user = await currentUser();
  if (!user) {
    return null;
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "unknown@clerk.local";
  const displayName = user.fullName ?? user.firstName ?? email.split("@")[0] ?? "Observer";

  return {
    clerkUserId: session.userId,
    email,
    displayName,
    role: "observer",
  } satisfies AuthenticatedObserver;
}

export async function requireObserver() {
  const observer = await getCurrentObserver();
  if (!observer) {
    throw new Error("Unauthorized");
  }
  return observer;
}