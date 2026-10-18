import { sql } from "drizzle-orm";

import { getDb } from "@/backend/db/client";

export async function GET() {
  const startedAt = Date.now();

  try {
    const db = getDb();
    const ping = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    const tables = await db.execute<{ count: number }>(
      sql`select count(*)::int as count
          from information_schema.tables
          where table_schema = 'public'`,
    );

    return Response.json({
      status: "ok",
      database: {
        connected: ping.rows[0]?.ok === 1,
        tables: tables.rows[0]?.count ?? 0,
        branch: process.env.NEON_BRANCH ?? null,
      },
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "unknown error",
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
