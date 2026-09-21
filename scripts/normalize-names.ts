// One-off: normalize existing member names in the database (ALL CAPS ->
// capitalized) using the same rule as the CSV import. Run:
//   DATABASE_URL=... npx tsx scripts/normalize-names.ts [--apply]
// Without --apply it only prints what would change.
import { config } from "dotenv";
config({ path: ".env" });

import { normalizeName } from "../src/lib/csv";

async function main() {
  const apply = process.argv.includes("--apply");
  const { db } = await import("../src/db/client");
  const { members } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const all = await db.select().from(members);
  const byKey = new Map<string, number>();
  for (const m of all) byKey.set(`${m.schoolId}|${m.name}`, m.id);

  const changes: { id: number; from: string; to: string }[] = [];
  const collisions: { id: number; from: string; to: string }[] = [];

  for (const m of all) {
    const to = normalizeName(m.name);
    if (to === m.name) continue;
    const existingId = byKey.get(`${m.schoolId}|${to}`);
    if (existingId !== undefined && existingId !== m.id) {
      collisions.push({ id: m.id, from: m.name, to });
    } else {
      changes.push({ id: m.id, from: m.name, to });
    }
  }

  console.log(`${all.length} members; ${changes.length} to normalize, ${collisions.length} collisions.`);
  for (const c of changes.slice(0, 15)) console.log(`  ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  if (changes.length > 15) console.log(`  ... and ${changes.length - 15} more`);
  for (const c of collisions) console.log(`  COLLISION (skipped): #${c.id} ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)} already exists in same school`);

  if (!apply) {
    console.log("Dry run — re-run with --apply to write.");
    return;
  }

  for (const c of changes) {
    await db.update(members).set({ name: c.to }).where(eq(members.id, c.id));
  }
  console.log(`Updated ${changes.length} member names.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
