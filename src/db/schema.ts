import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schools = pgTable(
  "schools",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("schools_name_org_unique").on(t.name, t.organizationId)],
);

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionUrl: text("submission_url").notNull(),
    // active members show up in public search; archived ones are kept for history
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("members_school_name_idx").on(t.schoolId, t.name),
    index("members_org_idx").on(t.organizationId),
  ],
);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per completed public verification (member clicked through to
// their submission page). ipHash is a salted hash, never the raw address.
export const verifications = pgTable(
  "verifications",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash").notNull().default(""),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_member_idx").on(t.memberId)],
);

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
  action: text("action").notNull(), // create | update | delete | import | login
  entity: text("entity").notNull(), // member | school | organization | admin | roster
  entityId: integer("entity_id"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Admin = typeof admins.$inferSelect;
