import { config } from "dotenv";
config({ path: ".env" });

import { randomBytes, scryptSync } from "crypto";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const { db } = await import("./client");
  const { admins, organizations } = await import("./schema");

  await db
    .insert(organizations)
    .values([{ name: "Sigma Tau Delta" }, { name: "Sigma Kappa Delta" }])
    .onConflictDoNothing();
  console.log("Organizations seeded: Sigma Tau Delta, Sigma Kappa Delta");

  const email = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase().trim();
  if (email) {
    const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
    const inserted = await db
      .insert(admins)
      .values({ email, passwordHash: hashPassword(password) })
      .onConflictDoNothing()
      .returning({ id: admins.id });
    if (inserted.length > 0) {
      console.log(`Admin created: ${email}`);
      if (!process.env.SEED_ADMIN_PASSWORD) {
        console.log(`Generated password (save it now, change it after first login): ${password}`);
      }
    } else {
      console.log(`Admin ${email} already exists — skipped.`);
    }
  } else {
    console.log("SEED_ADMIN_EMAIL not set — no admin created.");
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
