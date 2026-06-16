import { cookies } from "next/headers";
import { prisma } from "./db";
import type { SessionUser } from "@/types";

const COOKIE_NAME = "mch_session";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionUser;
    const user = await prisma.user.findUnique({ where: { id: parsed.id } });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role, employeeId: user.employeeId };
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 86400 * 7, path: "/",
  });
  return user;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export interface IdentityProvider {
  authenticate(credentials: { email: string; password?: string }): Promise<SessionUser | null>;
}

class MockIdentityProvider implements IdentityProvider {
  async authenticate({ email }: { email: string }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role, employeeId: user.employeeId };
  }
}

function getIdentityProvider(): IdentityProvider {
  if (process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID) {
    const { CognitoIdentityProvider } = require("./auth-cognito") as typeof import("./auth-cognito");
    return new CognitoIdentityProvider();
  }
  return new MockIdentityProvider();
}

export const identityProvider: IdentityProvider = getIdentityProvider();
