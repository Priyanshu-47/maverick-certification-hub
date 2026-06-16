import { createHash } from "crypto";

// ─── Semantic Cache ───────────────────────────────────────────────────────────

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

function hashKey(system: string, user: string): string {
  return createHash("sha256").update(`${system}::${user}`).digest("hex").slice(0, 16);
}

export function cacheGet<T>(system: string, user: string): T | null {
  const key = hashKey(system, user);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(system: string, user: string, value: T, ttl = DEFAULT_TTL): void {
  const key = hashKey(system, user);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

export function cacheClear(): void {
  cache.clear();
}

export function cacheStats() {
  return { size: cache.size, entries: Array.from(cache.keys()) };
}

// ─── Batch Workflow Manager ───────────────────────────────────────────────────

type BatchJob<T> = {
  id: string;
  items: T[];
  processor: (item: T) => Promise<unknown>;
  results: unknown[];
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
};

const batches = new Map<string, BatchJob<unknown>>();

export async function runBatch<T>(
  items: T[],
  processor: (item: T) => Promise<unknown>,
  batchSize = 5,
  delayMs = 1000
): Promise<{ batchId: string; results: unknown[] }> {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: BatchJob<T> = {
    id: batchId,
    items,
    processor,
    results: [],
    status: "running",
    startedAt: new Date(),
  };
  batches.set(batchId, job as BatchJob<unknown>);

  try {
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const chunkResults = await Promise.all(chunk.map(processor));
      job.results.push(...chunkResults);

      // Rate limiting: delay between batches
      if (i + batchSize < items.length && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    job.status = "completed";
    job.completedAt = new Date();
  } catch (e) {
    job.status = "failed";
    job.completedAt = new Date();
    throw e;
  }

  return { batchId, results: job.results };
}

export function getBatchStatus(batchId: string) {
  return batches.get(batchId) ?? null;
}

// ─── Token Budget Manager ─────────────────────────────────────────────────────

type TokenBudget = {
  dailyLimit: number;
  usedToday: number;
  lastReset: string;
};

let tokenBudget: TokenBudget = {
  dailyLimit: parseInt(process.env.AI_DAILY_TOKEN_LIMIT || "100000"),
  usedToday: 0,
  lastReset: new Date().toISOString().split("T")[0],
};

export function checkTokenBudget(estimatedTokens: number): boolean {
  const today = new Date().toISOString().split("T")[0];
  if (tokenBudget.lastReset !== today) {
    tokenBudget.usedToday = 0;
    tokenBudget.lastReset = today;
  }
  return tokenBudget.usedToday + estimatedTokens <= tokenBudget.dailyLimit;
}

export function consumeTokens(count: number) {
  tokenBudget.usedToday += count;
}

export function getTokenBudget() {
  const today = new Date().toISOString().split("T")[0];
  if (tokenBudget.lastReset !== today) {
    tokenBudget.usedToday = 0;
    tokenBudget.lastReset = today;
  }
  return { ...tokenBudget };
}
