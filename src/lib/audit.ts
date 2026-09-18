import "server-only";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

export async function logAudit(
  adminId: number | null,
  action: "create" | "update" | "delete" | "import" | "login",
  entity: "member" | "school" | "organization" | "admin" | "roster",
  entityId?: number | null,
  detail?: unknown,
) {
  try {
    await db.insert(auditLog).values({
      adminId,
      action,
      entity,
      entityId: entityId ?? null,
      detail: detail ?? null,
    });
  } catch (err) {
    // Audit failures should never break the underlying operation.
    console.error("audit log write failed", err);
  }
}
