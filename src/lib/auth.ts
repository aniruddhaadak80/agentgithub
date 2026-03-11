import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { db, hasDatabaseUrl } from "@/lib/db";
import { createId, readStore, writeStore } from "@/lib/file-store";

const SESSION_COOKIE_NAME = "forge_observer_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

type Observer = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

function toPublicObserver(observer: { id: string; email: string; displayName: string; role: string }): Observer {
  return {
    id: observer.id,
    email: observer.email,
    displayName: observer.displayName,
    role: observer.role,
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, existing] = passwordHash.split(":");
  const candidate = scryptSync(password, salt, 64);
  const current = Buffer.from(existing, "hex");
  return timingSafeEqual(candidate, current);
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

async function createObserverSession(observerId: string) {
  const token = randomBytes(24).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    state.observerSessions = state.observerSessions.filter((session) => session.expiresAt > new Date().toISOString());
    state.observerSessions.push({
      id: createId(),
      observerId,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    });
    await writeStore(state);
  } else {
    await db.observerSession.create({
      data: {
        observerId,
        tokenHash,
        expiresAt,
      },
    });
  }

  await setSessionCookie(token, expiresAt);
}

export async function signupObserver(input: { email: string; password: string; displayName: string }) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const passwordHash = hashPassword(input.password);

  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    if (state.observers.some((observer) => observer.email === email)) {
      throw new Error("An observer account with that email already exists.");
    }
    const observer = {
      id: createId(),
      email,
      displayName,
      passwordHash,
      role: "observer",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.observers.push(observer);
    await writeStore(state);
    await createObserverSession(observer.id);
    return toPublicObserver(observer);
  }

  const existing = await db.observerAccount.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An observer account with that email already exists.");
  }

  const observer = await db.observerAccount.create({
    data: {
      email,
      displayName,
      passwordHash,
    },
  });
  await createObserverSession(observer.id);
  return toPublicObserver(observer);
}

export async function loginObserver(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();

  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const observer = state.observers.find((account) => account.email === email);
    if (!observer || !verifyPassword(input.password, observer.passwordHash)) {
      throw new Error("Invalid email or password.");
    }
    await createObserverSession(observer.id);
    return toPublicObserver(observer);
  }

  const observer = await db.observerAccount.findUnique({ where: { email } });
  if (!observer || !verifyPassword(input.password, observer.passwordHash)) {
    throw new Error("Invalid email or password.");
  }
  await createObserverSession(observer.id);
  return toPublicObserver(observer);
}

export async function logoutObserver() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    if (!hasDatabaseUrl || !db) {
      const state = await readStore();
      state.observerSessions = state.observerSessions.filter((session) => session.tokenHash !== tokenHash);
      await writeStore(state);
    } else {
      await db.observerSession.deleteMany({ where: { tokenHash } });
    }
  }
  await clearSessionCookie();
}

export async function getCurrentObserver() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  if (!hasDatabaseUrl || !db) {
    const state = await readStore();
    const session = state.observerSessions.find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt) > now);
    if (!session) {
      return null;
    }
    const observer = state.observers.find((account) => account.id === session.observerId);
    return observer ? toPublicObserver(observer) : null;
  }

  const session = await db.observerSession.findUnique({
    where: { tokenHash },
    include: { observer: true },
  });
  if (!session || session.expiresAt <= now) {
    return null;
  }
  return toPublicObserver(session.observer);
}