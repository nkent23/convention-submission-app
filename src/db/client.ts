import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Neon hosts go over HTTP (serverless driver); everything else over TCP.
const isNeon = url.includes("neon.tech");

export const db = (
  isNeon ? drizzleNeon(neon(url), { schema }) : drizzlePg(postgres(url, { max: 5 }), { schema })
) as ReturnType<typeof drizzlePg<typeof schema>>;

export type Db = typeof db;
