import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export class RequestBodyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function readJsonBody<T>(request: NextRequest, maxBytes: number): Promise<T> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new RequestBodyError("Payload demasiado grande", 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) throw new RequestBodyError("Payload demasiado grande", 413);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new RequestBodyError("JSON inválido", 400);
  }
}

export function requestErrorResponse(error: unknown): NextResponse | null {
  return error instanceof RequestBodyError
    ? NextResponse.json({ error: error.message }, { status: error.status })
    : null;
}

export function clientAddress(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function opaqueRateKey(value: unknown): string {
  return createHash("sha256").update(String(value ?? "missing")).digest("hex").slice(0, 24);
}

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const retryAfter = consumeRateLimit(scope, identifier, limit, windowMs);
  if (retryAfter === null) return null;
  return NextResponse.json(
    { error: "Demasiadas solicitudes", retryAfter },
    { status: 429, headers: { "Retry-After": retryAfter.toString() } },
  );
}

export function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): number | null {
  const now = Date.now();
  const key = `${scope}:${identifier}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 10_000) {
    for (const [entryKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(entryKey);
  }
  if (bucket.count <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return retryAfter;
}
