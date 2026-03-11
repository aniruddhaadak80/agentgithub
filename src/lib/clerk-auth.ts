import { auth, currentUser } from "@clerk/nextjs/server";

export type AuthenticatedObserver = {
  clerkUserId: string;
  email: string;
  displayName: string;
  role: "observer";
};

export async function getCurrentObserver() {
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