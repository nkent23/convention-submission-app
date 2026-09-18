import "server-only";
import { createHash } from "crypto";

// In-memory sliding-window limiter — fine for a single Railway instance at
// this app's scale. Keyed by caller-supplied bucket (usually route + IP).
const windows = new Map<string, number[]>();

export function rateLimit(bucket: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (windows.get(bucket) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    windows.set(bucket, hits);
    return false;
  }
  hits.push(now);
  windows.set(bucket, hits);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (windows.size > 10_000) {
    for (const [k, v] of windows) {
      if (v.every((t) => now - t >= windowMs)) windows.delete(k);
    }
  }
  return true;
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

/** Salted hash of an IP for storage — raw addresses are never persisted. */
export function hashIp(ip: string) {
  const salt = process.env.SESSION_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
