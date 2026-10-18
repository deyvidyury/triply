import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | undefined;

/**
 * Server-only Neon client. Uses the pooled `DATABASE_URL` over the Neon
 * serverless HTTP driver, which works in the WinterCG runtime used by
 * Expo Router API routes.
 */
export function getDb(): Database {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  cached = drizzle(neon(connectionString), { schema });
  return cached;
}
