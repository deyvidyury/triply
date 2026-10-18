import { sql } from "drizzle-orm";
import {
  date,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tripStatus = pgEnum("trip_status", [
  "draft",
  "generating",
  "ready",
  "failed",
]);
export const tripPace = pgEnum("trip_pace", ["relaxed", "balanced", "packed"]);
export const coverSource = pgEnum("cover_source", [
  "unsplash",
  "pexels",
  "none",
]);
export const activitySource = pgEnum("activity_source", ["ai", "user"]);
export const priceBand = pgEnum("price_band", ["budget", "mid", "upscale"]);
export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const generationJobStatus = pgEnum("generation_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export const usageKind = pgEnum("usage_kind", [
  "generation",
  "chat_turn",
  "places",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  imagekitFileId: text("imagekit_file_id"),
  ...timestamps,
});

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: tripStatus("status").notNull().default("draft"),
    destinationName: text("destination_name").notNull(),
    destinationPlaceId: text("destination_place_id"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    countryCode: text("country_code"),
    timezone: text("timezone"),
    startDate: date("start_date").notNull(),
    days: integer("days").notNull(),
    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }),
    budgetCurrency: text("budget_currency"),
    interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
    pace: tripPace("pace").notNull().default("balanced"),
    dietary: text("dietary").array().notNull().default(sql`'{}'::text[]`),
    accessibility: text("accessibility")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    coverUrl: text("cover_url"),
    coverImagekitUrl: text("cover_imagekit_url"),
    coverSource: coverSource("cover_source").notNull().default("none"),
    coverPhotographer: text("cover_photographer"),
    coverPhotographerUrl: text("cover_photographer_url"),
    coverSourceUrl: text("cover_source_url"),
    revision: integer("revision").notNull().default(1),
    errorCode: text("error_code"),
    ...timestamps,
  },
  (table) => [index("trips_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const tripDays = pgTable(
  "trip_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    date: date("date").notNull(),
    title: text("title"),
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("trip_days_trip_sort_idx").on(table.tripId, table.sortOrder),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripDayId: uuid("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    startTime: text("start_time"),
    durationMinutes: integer("duration_minutes"),
    estCostAmount: numeric("est_cost_amount", { precision: 12, scale: 2 }),
    estCostCurrency: text("est_cost_currency"),
    notes: text("notes"),
    placeId: text("place_id"),
    placeName: text("place_name"),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    mapsUrl: text("maps_url"),
    bookingUrl: text("booking_url"),
    source: activitySource("source").notNull().default("ai"),
  },
  (table) => [
    uniqueIndex("activities_day_sort_idx").on(table.tripDayId, table.sortOrder),
  ],
);

export const tripLodging = pgTable(
  "trip_lodging",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    name: text("name").notNull(),
    neighborhood: text("neighborhood"),
    priceBand: priceBand("price_band").notNull(),
    placeId: text("place_id"),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    mapsUrl: text("maps_url"),
  },
  (table) => [
    uniqueIndex("trip_lodging_trip_sort_idx").on(table.tripId, table.sortOrder),
  ],
);

export const tripMessages = pgTable(
  "trip_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    revision: integer("revision").notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("trip_messages_trip_created_idx").on(table.tripId, table.createdAt),
  ],
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: generationJobStatus("status").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(0),
    inngestRunId: text("inngest_run_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("generation_jobs_one_active_idx")
      .on(table.tripId)
      .where(sql`${table.status} in ('queued', 'running')`),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").references(() => trips.id, {
      onDelete: "set null",
    }),
    kind: usageKind("kind").notNull(),
    estCostUsd: numeric("est_cost_usd", { precision: 10, scale: 4 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_events_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("share_links_token_idx").on(table.token)],
);
