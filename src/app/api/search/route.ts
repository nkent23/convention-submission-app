import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { members } from "@/db/schema";
import { and, asc, eq, ilike } from "drizzle-orm";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Public member-name search: min 2 chars, name-only results, capped at 25.
export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(`search:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const schoolId = Number(request.nextUrl.searchParams.get("schoolId"));
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!Number.isInteger(schoolId) || q.length < 2 || q.length > 100) {
    return NextResponse.json({ results: [] });
  }

  const results = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(
      and(
        eq(members.schoolId, schoolId),
        eq(members.status, "active"),
        ilike(members.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
      ),
    )
    .orderBy(asc(members.name))
    .limit(25);

  return NextResponse.json({ results });
}
