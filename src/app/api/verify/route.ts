import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { members, verifications } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { clientIp, hashIp, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ memberId: z.number().int().positive() });

// Completes a verification: records it and hands back the member's
// submission URL. This is the only place a submission URL leaves the server.
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(`verify:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, parsed.data.memberId), eq(members.status, "active")))
    .limit(1);

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await db.insert(verifications).values({ memberId: member.id, ipHash: hashIp(ip) });

  return NextResponse.json({ url: member.submissionUrl });
}
