import type { GenerationMode } from "./generation-modes";
import type { ModelKey } from "./model-options";

const USAGE_EVENTS_KEY = "analytics:generation-events";

export const USAGE_PERIODS = ["24h", "7d", "30d", "all"] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

export type UsageEventInput = {
  outcome: "success" | "error";
  requests: number;
  totalTokens: number;
  costUsd: number | null;
  model: ModelKey;
  modelLabel: string;
  generationMode: GenerationMode;
  generationModeLabel: string;
  garmentCount: number;
  durationMs: number;
  error?: string;
};

export type UsageEvent = UsageEventInput & {
  id: string;
  createdAt: string;
};

export type UsageStats = {
  configured: boolean;
  period: UsagePeriod;
  generatedAt: string;
  totals: {
    attempts: number;
    generations: number;
    failedAttempts: number;
    successRate: number | null;
    calls: number;
    avgCallsPerGeneration: number | null;
    costUsd: number | null;
    avgCostPerGeneration: number | null;
    costedGenerations: number;
    unknownCostGenerations: number;
    tokens: number;
    avgTokensPerGeneration: number | null;
    avgGarmentsPerGeneration: number | null;
    avgDurationMs: number | null;
  };
  series: {
    label: string;
    generations: number;
    calls: number;
    costUsd: number;
    failedAttempts: number;
  }[];
  models: { label: string; count: number; costUsd: number | null }[];
  modes: { label: string; count: number; calls: number }[];
  recent: UsageEvent[];
};

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  const { kv } = await import("@vercel/kv");
  return kv;
}

export async function recordUsageEvent(input: UsageEventInput): Promise<void> {
  const kv = await getKv();
  if (!kv) return;

  const now = Date.now();
  const event: UsageEvent = {
    ...input,
    id: `${now}:${crypto.randomUUID()}`,
    createdAt: new Date(now).toISOString(),
  };

  await kv.zadd(USAGE_EVENTS_KEY, {
    score: now,
    member: JSON.stringify(event),
  });
}

export async function getUsageStats(period: UsagePeriod): Promise<UsageStats> {
  const kv = await getKv();
  const now = new Date();
  if (!kv) return emptyStats(period, now, false);

  const startMs = getPeriodStartMs(period, now);
  const rawEvents = await kv.zrange<string[]>(
    USAGE_EVENTS_KEY,
    startMs ?? "-inf",
    "+inf",
    { byScore: true },
  );
  const events = rawEvents
    .map(parseUsageEvent)
    .filter((event): event is UsageEvent => event !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return buildStats(period, now, events, true);
}

function parseUsageEvent(raw: unknown): UsageEvent | null {
  try {
    const event = (
      typeof raw === "string" ? JSON.parse(raw) : raw
    ) as Partial<UsageEvent>;
    if (!event || typeof event !== "object") return null;
    if (!event.id || !event.createdAt || !event.modelLabel || !event.generationModeLabel) {
      return null;
    }
    if (event.outcome !== "success" && event.outcome !== "error") return null;

    return {
      id: event.id,
      createdAt: event.createdAt,
      outcome: event.outcome,
      requests: numberOrZero(event.requests),
      totalTokens: numberOrZero(event.totalTokens),
      costUsd: typeof event.costUsd === "number" ? event.costUsd : null,
      model: (event.model ?? "gemini") as ModelKey,
      modelLabel: event.modelLabel,
      generationMode: (event.generationMode ?? "single") as GenerationMode,
      generationModeLabel: event.generationModeLabel,
      garmentCount: numberOrZero(event.garmentCount),
      durationMs: numberOrZero(event.durationMs),
      error: typeof event.error === "string" ? event.error : undefined,
    };
  } catch {
    return null;
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getPeriodStartMs(period: UsagePeriod, now: Date): number | null {
  switch (period) {
    case "24h":
      return now.getTime() - 24 * 60 * 60 * 1000;
    case "7d":
      return now.getTime() - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    case "all":
      return null;
  }
}

function emptyStats(period: UsagePeriod, now: Date, configured: boolean): UsageStats {
  return buildStats(period, now, [], configured);
}

function buildStats(
  period: UsagePeriod,
  now: Date,
  events: UsageEvent[],
  configured: boolean,
): UsageStats {
  const successes = events.filter((event) => event.outcome === "success");
  const failures = events.filter((event) => event.outcome === "error");
  const costedSuccesses = successes.filter((event) => event.costUsd !== null);
  const totalCost =
    costedSuccesses.length > 0
      ? costedSuccesses.reduce((sum, event) => sum + (event.costUsd ?? 0), 0)
      : null;
  const calls = successes.reduce((sum, event) => sum + event.requests, 0);
  const tokens = successes.reduce((sum, event) => sum + event.totalTokens, 0);

  return {
    configured,
    period,
    generatedAt: now.toISOString(),
    totals: {
      attempts: events.length,
      generations: successes.length,
      failedAttempts: failures.length,
      successRate: events.length > 0 ? successes.length / events.length : null,
      calls,
      avgCallsPerGeneration: successes.length > 0 ? calls / successes.length : null,
      costUsd: totalCost,
      avgCostPerGeneration:
        totalCost !== null && costedSuccesses.length > 0
          ? totalCost / costedSuccesses.length
          : null,
      costedGenerations: costedSuccesses.length,
      unknownCostGenerations: successes.length - costedSuccesses.length,
      tokens,
      avgTokensPerGeneration: successes.length > 0 ? tokens / successes.length : null,
      avgGarmentsPerGeneration:
        successes.length > 0
          ? successes.reduce((sum, event) => sum + event.garmentCount, 0) / successes.length
          : null,
      avgDurationMs:
        events.length > 0
          ? events.reduce((sum, event) => sum + event.durationMs, 0) / events.length
          : null,
    },
    series: buildSeries(period, now, events),
    models: buildModelBreakdown(successes),
    modes: buildModeBreakdown(successes),
    recent: [...events].reverse().slice(0, 8),
  };
}

function buildSeries(period: UsagePeriod, now: Date, events: UsageEvent[]): UsageStats["series"] {
  const buckets = createBuckets(period, now, events);
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const event of events) {
    const bucket = bucketByKey.get(getBucketKey(period, new Date(event.createdAt)));
    if (!bucket) continue;

    if (event.outcome === "success") {
      bucket.generations += 1;
      bucket.calls += event.requests;
      bucket.costUsd += event.costUsd ?? 0;
    } else {
      bucket.failedAttempts += 1;
    }
  }

  return buckets.map(({ label, generations, calls, costUsd, failedAttempts }) => ({
    label,
    generations,
    calls,
    costUsd,
    failedAttempts,
  }));
}

function createBuckets(period: UsagePeriod, now: Date, events: UsageEvent[]) {
  if (period === "24h") {
    return Array.from({ length: 24 }, (_, index) => {
      const date = new Date(now.getTime() - (23 - index) * 60 * 60 * 1000);
      date.setMinutes(0, 0, 0);
      return emptyBucket(getBucketKey(period, date), formatHour(date));
    });
  }

  if (period === "all") {
    const firstEvent = events[0];
    const start = firstEvent ? new Date(firstEvent.createdAt) : now;
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const buckets = [];
    const cursor = new Date(start);
    const last = new Date(now);
    last.setDate(1);
    last.setHours(0, 0, 0, 0);

    while (cursor <= last) {
      buckets.push(emptyBucket(getBucketKey(period, cursor), formatMonth(cursor)));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  const days = period === "7d" ? 7 : 30;
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - 1 - index) * 24 * 60 * 60 * 1000);
    date.setHours(0, 0, 0, 0);
    return emptyBucket(getBucketKey(period, date), formatDay(date));
  });
}

function emptyBucket(key: string, label: string) {
  return { key, label, generations: 0, calls: 0, costUsd: 0, failedAttempts: 0 };
}

function getBucketKey(period: UsagePeriod, date: Date): string {
  if (period === "24h") {
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
  }
  if (period === "all") {
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
  }
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function buildModelBreakdown(events: UsageEvent[]): UsageStats["models"] {
  const totals = new Map<string, { count: number; costUsd: number; unknownCost: number }>();
  for (const event of events) {
    const next = totals.get(event.modelLabel) ?? { count: 0, costUsd: 0, unknownCost: 0 };
    next.count += 1;
    if (event.costUsd === null) next.unknownCost += 1;
    else next.costUsd += event.costUsd;
    totals.set(event.modelLabel, next);
  }

  return [...totals.entries()]
    .map(([label, value]) => ({
      label,
      count: value.count,
      costUsd: value.unknownCost === value.count ? null : value.costUsd,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildModeBreakdown(events: UsageEvent[]): UsageStats["modes"] {
  const totals = new Map<string, { count: number; calls: number }>();
  for (const event of events) {
    const next = totals.get(event.generationModeLabel) ?? { count: 0, calls: 0 };
    next.count += 1;
    next.calls += event.requests;
    totals.set(event.generationModeLabel, next);
  }

  return [...totals.entries()]
    .map(([label, value]) => ({ label, count: value.count, calls: value.calls }))
    .sort((a, b) => b.count - a.count);
}

export function normalizeUsagePeriod(value: string | null): UsagePeriod {
  return USAGE_PERIODS.find((period) => period === value) ?? "7d";
}
