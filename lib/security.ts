import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import type { SessionUser } from "@/types";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "dev-only-key-do-not-use-in-prod";
  return scryptSync(secret, "maverick-salt", 32);
}

export function encryptCode(plain: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptCode(encrypted: string): string {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  const secret = process.env.TOKEN_SECRET || "dev-token-secret";
  return createHash("sha256").update(token + secret).digest("hex");
}

export function canAccess(permission: string, user: SessionUser | null): boolean {
  if (!user) return false;
  const perms = ROLE_MAP[user.role] ?? [];
  if (perms.includes("*")) return true;
  return perms.some((p) => p === permission || (p.endsWith("*") && permission.startsWith(p.slice(0, -1))));
}

const ROLE_MAP: Record<string, string[]> = {
  Admin: ["*"],
  Coordinator: ["drives:read", "drives:write", "registrations", "assessments", "communications", "vouchers", "reports", "exceptions", "audit", "automation", "eligibility"],
  Approver: ["drives:read", "registrations:read", "approvals", "reports", "audit"],
  ReadOnly: ["drives:read", "registrations:read", "reports", "audit", "dashboard"],
  Candidate: ["registrations:own", "status", "voucher:own"],
};

export function roleGuard(user: SessionUser | null, roles: SessionUser["role"][]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
