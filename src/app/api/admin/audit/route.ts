import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { admins, auditLog } from "@/db/schema";
import { count, desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        detail: auditLog.detail,
        createdAt: auditLog.createdAt,
        adminEmail: admins.email,
      })
      .from(auditLog)
      .leftJoin(admins, eq(auditLog.adminId, admins.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLog),
  ]);

  return NextResponse.json({ rows, total, page, pageSize: PAGE_SIZE });
}
