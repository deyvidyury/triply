# Triply — Implementation Plan (v1: Android + Web)

> Single source of truth for v1 scope and architecture.
> Status: blueprint approved. No code written yet.

## 1. Workspace facts (verified)

- Fresh Expo SDK 58 app (`expo ~58.0.14`), Expo Router in `src/app`, React 19.3.0, RN 0.88.0, TS 6.0.3.
- Only routes: `src/app/_layout.tsx` (bare `<Stack />`) and `src/app/index.tsx` (template text).
- `app.json`: scheme `triply`, `web.output: "server"`, typedRoutes + reactCompiler experiments.
- No backend, auth, DB, jobs, tests, EAS config, or `ios/`/`android/` dirs (CNG).
- Package manager: npm (`package-lock.json`), not bun.
- No third-party deps installed yet (Clerk/Neon/Inngest/OpenAI/Places/Sentry/ImageKit all missing).
- `web.output: "server"` already enables API routes and server rendering for the web target.

## 2. Version-accuracy notes

- Clerk Expo SDK is `@clerk/expo` (NOT `@clerk/clerk-expo`). Custom flow needs `expo-auth-session`, `expo-crypto`, `expo-web-browser`.
- Token cache (`@clerk/expo/token-cache` + `expo-secure-store`) is native-only. Web must skip the cache; verify the current documented web setup before coding.
- Clerk webhooks are signed with Svix. Verify signature before any DB write.
- Expo Router API routes: enabled by `web.output: "server"`; deploy to EAS Hosting. Native builds require `origin` in the expo-router plugin config.
- Expo SDK 58 requires Node 22.13+.
- Inngest has no first-party Expo handler → custom/edge `serve()` at `/api/inngest`.
- Neon serverless driver: HTTP (one-shot + non-interactive transactions) and WebSockets (interactive).
- ImageKit uploads should use server-generated auth parameters (token/expire/signature); never ship the private key.
- Unsplash and Pexels have attribution/hotlinking requirements in their API guidelines. Confirm the exact terms for both providers before launch.
- Pin the exact OpenAI model ID and pricing against current docs at implementation time.

## 3. Product summary

AI trip planner for **Android and mobile-focused web**, one Expo codebase. An authenticated user submits destination, start date, duration, party, budget, and preferences. A background job generates a structured day-by-day itinerary, validates venues and lodging against Google Places, attaches a destination cover image from a free stock source, persists everything, and shows it on a details screen with hotel suggestions and a budget breakdown.

After generation, the user can edit the trip conversationally in a **synchronous chat**: send a message, wait a few seconds, receive an assistant reply plus the updated itinerary. Manual edits (remove, reorder, add) remain available. Users can list trips, regenerate, share as image/text, share a public read-only URL, and delete trips or their account.

## 4. Language we agreed on

- **Trip** — persisted itinerary document owned by a user.
- **Itinerary** — ordered set of days, each with ordered activities.
- **Activity** — a single venue/event in a day: attraction, restaurant, experience.
- **Lodging** — hotel suggestion (name + neighborhood + approximate price band). Not a booking, not a live rate.
- **Generation** — full itinerary creation for a trip, asynchronous via Inngest.
- **Chat turn** — one synchronous user message that returns an assistant reply and a new trip revision. Replaces the old "refinement".
- **Revision** — monotonically increasing version of a trip's itinerary; used for optimistic concurrency.
- **Cover** — destination image shown on trip cards and the details header.
- **Custom cover** — cover processed through ImageKit transformations (crop, quality, brand overlay).
- **Price band** — enum (`budget` | `mid` | `upscale`), not a currency amount.
- **Home** — the authenticated trip form. Not a feed.
- **Ready** — trip has a persisted, validated itinerary.

## 5. Scope

### In scope

- **Android** app (EAS Build) and **mobile-first web** (EAS Hosting) from the same codebase.
- Google sign-in. Apple sign-in deferred to v2.
- Bottom tabs on Android; same navigation on web with a mobile-first responsive shell.
- Trip form: Places Autocomplete destination; start date + duration; adults + children; total party budget + currency; interests; pace; dietary; accessibility.
- Async generation via Inngest with automatic retries, then graceful failure.
- Structured itinerary: days → activities with real name, address, coordinates, time, duration, estimated cost, category, notes, map link, optional booking link.
- Lodging suggestions: 3–5 hotels with name, neighborhood, price band, Places-validated, separate "Where to stay" section.
- Budget breakdown: activities total vs user budget, plus a separate approximate lodging estimate, never summed together.
- **Destination cover** fetched from **Unsplash with Pexels fallback** when the trip is created; provider, photographer and source URL stored and attributed.
- **Custom cover** rendered through ImageKit transformations (crop, quality, text/brand overlay).
- **Profile photo upload** via ImageKit signed upload; transformations for avatar sizes.
- **Clerk webhooks → Neon sync** (`user.created`, `user.updated`, `user.deleted`).
- **Synchronous chat editing**: user message → assistant reply + updated itinerary, no Inngest in the chat path.
- Whole-trip regeneration inside a DB transaction.
- Manual edit: remove, reorder, add custom activity.
- Share: image/text via native share sheet on Android, Web Share API on web, plus public read-only link.
- Usage ledger, per-user limits, $50/month global hard stop.
- Sentry for app and server; structured lifecycle logs.
- CI: typecheck, lint, unit tests, API integration tests. Manual E2E on Android and browser.

### Out of scope

- **iOS** (and therefore Apple Developer enrollment).
- Desktop-first web layout.
- Flight/hotel booking, live hotel rates.
- Streaming token-by-token chat.
- Offline mode.
- Push notifications.
- Multi-language support (English only).
- Monetization/paywall.
- Transport preference field.
- Automated E2E on device/browser.
- Live FX conversion or real-time pricing.
- User-generated trip covers in v1 (cover is auto-selected; profile photo is the only user upload).

## 6. Resolved decisions

- **Platforms:** Android + mobile-first web. No iOS.
- **Backend:** same repo, Expo Router API routes, EAS Hosting.
- **Auth:** Clerk custom flow with **Google only** in v1. Apple sign-in deferred to v2.
- **User sync:** Clerk webhooks are the primary source of truth; lazy upsert on authenticated request is the race-condition fallback.
- **Navigation:** tabs Home / Trips / Profile; responsive shell on web.
- **Output:** structured day-by-day itinerary with real places, times, costs, map/booking links.
- **Lodging:** name + neighborhood + price band, Places-validated, separate section; separate approximate estimate in budget.
- **Generation:** async Inngest job + polling; one active job per trip; whole-trip regenerate.
- **Retries:** Inngest automatic retries (2) with backoff, then `failed` with a graceful state.
- **Chat:** synchronous, **non-streaming JSON** request/response. No Inngest. Optimistic concurrency on `revision`.
- **AI:** OpenAI mid-tier model, strict JSON schema.
- **Places:** validation/enrichment via Google Places (name, address, coordinates, price band). No Places photos.
- **Covers:** **both** Unsplash and Pexels. Provider chosen per query with fallback: Unsplash first, Pexels on miss/failure. ImageKit fetches and transforms the stock URL (crop, quality, overlay) to produce the custom cover. Store provider, photographer, source URL. Legal/ToS review required before launch; user accepted the risk.
- **ORM:** Drizzle ORM for schema, migrations and queries.
- **Persistence:** normalized `trips` / `trip_days` / `activities` / `trip_lodging` / `trip_messages`.
- **Edits:** remove, reorder, add custom; chat applies a full new revision transactionally.
- **Share:** native sheet (Android) + Web Share API (web) + public read-only page + deep link.
- **Client state:** TanStack Query.
- **Limits:** 10 generations + 50 chat turns per user/month; $50/month global hard stop.
- **Monetization:** free beta.
- **Account deletion:** app-side cascade, then Clerk user deletion; webhook cleanup is idempotent.
- **Testing:** typecheck/lint + unit + API integration + manual Android/web E2E.
- **Observability:** Sentry only; no analytics vendor.

## 7. Architecture

Server code lives in `src/backend/`. Only `+api.ts` route handlers and the Inngest functions import it.

### Repository layout

```
src/
  app/                        # Expo Router routes only
    _layout.tsx               # ClerkProvider, Sentry, QueryClientProvider, Stack
    (auth)/sign-in.tsx
    (tabs)/_layout.tsx        # tabs; responsive shell on web
    (tabs)/index.tsx          # Home: trip form
    (tabs)/trips.tsx          # Trips history with covers
    (tabs)/profile.tsx        # Profile + photo + delete account
    trip/[id].tsx             # Details / status / cover / chat / edit
    share/[token].tsx         # public read-only page (web + app link)
    api/                      # only server entry points
      trips+api.ts
      trips/[id]+api.ts
      trips/[id]/chat+api.ts
      trips/[id]/regenerate+api.ts
      trips/[id]/activities+api.ts
      trips/[id]/activities/[activityId]+api.ts
      trips/[id]/share+api.ts
      trips/[id]/usage+api.ts
      places/autocomplete+api.ts
      uploads/imagekit-auth+api.ts
      webhooks/clerk+api.ts
      share/[token]+api.ts
      inngest+api.ts

  backend/                    # server-only logic
    db/                       # Drizzle schema, Neon client, migrations
    auth/                     # Clerk JWT verification, ownership guards
    services/                 # trips, itineraries, lodging, chat, edits, usage, share
    ai/                       # OpenAI client, prompts (generate + chat), output schema
    places/                   # autocomplete, venue + lodging resolution
    covers/                   # Unsplash/Pexels search, attribution, ImageKit transform URLs
    media/                    # ImageKit signed upload, avatar transforms
    webhooks/                 # Svix verification, Clerk event handlers
    inngest/                  # client + generate function
    jobs/                     # step helpers
    observability/            # server Sentry init, job logger
    http/                     # Response helpers, error mapping, validation

  lib/                        # isomorphic: Zod schemas, types, constants
```

### Boundary rules

1. `src/app` holds routes only. Non-`+api.ts` files there are client code; importing secrets leaks them into the app bundle.
2. `src/backend` is imported only by `+api.ts` files and `src/backend/inngest/**`. Enforce with `no-restricted-imports` plus an override for `src/app/**/+api.ts`.
3. `src/lib` is the only shared layer: Zod schemas, types, constants. No secrets.
4. Platform-specific code uses `.web.tsx` / `.native.tsx` only where behavior truly differs (auth token cache, share, image picking).

### Runtime flows

**Generation (async):**

```
Android / Web
  → POST /api/trips (creates trip, fetches cover, reserves usage)
  → inngest.send('trip/generate.requested')
  → Inngest → HTTP → /api/inngest
       generate → validate-schema → resolve-places → resolve-lodging
       → compute-budget → persist (transaction) → record-usage
  → client polls GET /api/trips/[id] until ready | failed
```

**Chat (synchronous, no Inngest):**

```
POST /api/trips/[id]/chat { message, revision }
  → verify JWT + ownership + quota + revision match
  → OpenAI (current itinerary + message) → Zod validate
  → Places validation for new/changed activities only (bounded)
  → transaction: replace days/activities/lodging, bump revision
  → insert user + assistant messages, record usage
  → 200 { message, revision, trip }
```

### Secrets

Server env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_URL_ENDPOINT`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `SENTRY_DSN`, `SHARE_TOKEN_SECRET`.

Client env: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `EXPO_PUBLIC_IMAGEKIT_URL_ENDPOINT`.

## 8. Data model (Postgres / Drizzle)

- `users` — `id` (Clerk sub, PK), `email`, `display_name`, `avatar_url`, `imagekit_file_id`, `created_at`, `updated_at`. Written by the Clerk webhook; lazy upsert as fallback.
- `trips` — `id` (uuid), `user_id`, `status` (`draft` | `generating` | `ready` | `failed`), `destination_name`, `destination_place_id`, `lat`, `lng`, `country_code`, `timezone`, `start_date`, `days`, `adults`, `children`, `budget_amount`, `budget_currency`, `interests` (text[]), `pace` (`relaxed` | `balanced` | `packed`), `dietary` (text[]), `accessibility` (text[]), `cover_url`, `cover_imagekit_url`, `cover_source` (`unsplash` | `pexels` | `none`), `cover_photographer`, `cover_photographer_url`, `cover_source_url`, `revision`, `error_code`, `created_at`, `updated_at`.
- `trip_days` — `id`, `trip_id`, `day_number`, `date`, `title`, `summary`, `sort_order`.
- `activities` — `id`, `trip_day_id`, `sort_order`, `title`, `category`, `start_time`, `duration_minutes`, `est_cost_amount`, `est_cost_currency`, `notes`, `place_id`, `place_name`, `address`, `lat`, `lng`, `maps_url`, `booking_url`, `source` (`ai` | `user`).
- `trip_lodging` — `id`, `trip_id`, `sort_order`, `name`, `neighborhood`, `price_band` (`budget` | `mid` | `upscale`), `place_id`, `address`, `lat`, `lng`, `maps_url`.
- `trip_messages` — `id`, `trip_id`, `user_id`, `role` (`user` | `assistant`), `content`, `revision`, `error_code`, `created_at`.
- `generation_jobs` — `id`, `trip_id`, `user_id`, `status` (`queued` | `running` | `succeeded` | `failed`), `attempt`, `inngest_run_id`, `error_code`, `error_message`, `created_at`, `started_at`, `finished_at`.
- `usage_events` — `id`, `user_id`, `trip_id`, `kind` (`generation` | `chat_turn` | `places`), `est_cost_usd`, `created_at`.
- `share_links` — `id`, `trip_id`, `token` (unique, opaque), `revoked_at`, `created_at`.

Constraints and indexes:

- Partial unique index on `generation_jobs(trip_id)` where `status in ('queued','running')`.
- `trips(user_id, updated_at desc)`.
- `trip_days(trip_id, sort_order)` unique.
- `activities(trip_day_id, sort_order)` unique.
- `trip_lodging(trip_id, sort_order)` unique.
- `trip_messages(trip_id, created_at)`.
- `usage_events(user_id, created_at)`.
- `share_links(token)` unique.

Validation:

- `days` 1–14; adults ≥ 1; children ≥ 0; total travelers ≤ 12.
- `budget_amount` > 0; currency ISO-4217; default from device/browser locale.
- `start_date` today or later, local date.
- Destination must resolve to a `place_id`.
- Activity target ≤ 5 per day.
- Chat request must carry the client's `revision`; mismatch → `409 conflict`.

## 9. API surface

| Route                                     | Method       | Purpose                                                             |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------- |
| `/api/places/autocomplete`                | GET          | Proxy Places Autocomplete                                           |
| `/api/trips`                              | POST         | Create trip, pick cover, create job, reserve usage, send event      |
| `/api/trips`                              | GET          | Paginated trip history with covers                                  |
| `/api/trips/[id]`                         | GET          | Trip + days + activities + lodging + budget + messages + job status |
| `/api/trips/[id]`                         | DELETE       | Delete trip (cascade)                                               |
| `/api/trips/[id]/regenerate`              | POST         | New generate job; rejects if one is active                          |
| `/api/trips/[id]/chat`                    | POST         | **Synchronous** chat turn → assistant reply + new revision          |
| `/api/trips/[id]/activities`              | POST/PATCH   | Add custom activity; reorder via ordered ID list                    |
| `/api/trips/[id]/activities/[activityId]` | PATCH/DELETE | Edit custom activity or remove                                      |
| `/api/trips/[id]/share`                   | POST/DELETE  | Create/revoke share token                                           |
| `/api/trips/[id]/usage`                   | GET          | Remaining quota for UI                                              |
| `/api/uploads/imagekit-auth`              | GET          | Signed ImageKit upload parameters                                   |
| `/api/webhooks/clerk`                     | POST         | Svix-verified user sync                                             |
| `/api/share/[token]`                      | GET          | Public read-only payload (no PII)                                   |
| `/api/inngest`                            | GET/POST/PUT | Inngest serve handler                                               |

Authenticated routes verify the Clerk JWT and trip ownership. The webhook route verifies the Svix signature instead. Public routes expose only itinerary, lodging, cover and attribution.

## 10. AI contract

### Generation (Inngest)

```
{
  trip: { title, summary, bestTimeNote },
  days: [{ dayNumber, title, summary,
    activities: [{ title, category, startTime, durationMinutes,
      estimatedCost: { amount, currency }, notes, searchQuery, bookingHint }] }],
  lodging: [{ name, neighborhood, priceBand, searchQuery }],
  budget: { activitiesTotal, currency, notes }
}
```

### Chat turn (synchronous)

Input: `{ message, revision }`.
Output: `{ assistantMessage, itinerary }` where `itinerary` has the same shape as generation output.

Rules:

- Strict JSON schema; reject and retry once on validation failure.
- `priceBand` is an enum, never a number.
- The model returns `searchQuery`; Places resolves `place_id`, address, coordinates, maps URL.
- Chat returns a **full replacement itinerary**, not a patch. Simpler to validate and to persist transactionally.
- Chat prompt carries: trip parameters, current itinerary, the single user message.
- Places revalidation only for new or changed activities, bounded to keep latency under budget.
- Costs are estimates in the trip currency. No FX.

## 11. Pipelines

### Generation job (Inngest, async)

1. `mark-running` — job `running`, trip `generating`.
2. `check-quota` — per-user and global cap.
3. `generate` — OpenAI strict structured output.
4. `validate-schema` — Zod; one retry on failure.
5. `resolve-places` — Places Text Search per activity, bounded concurrency.
6. `resolve-lodging` — Places Text Search `type=lodging`, 3–5 results; fallback to 2 neighborhoods.
7. `compute-budget` — sum activity costs; derive lodging estimate from price bands.
8. `persist` — transaction: delete old days/activities/lodging, insert new, bump `revision`, set `ready`.
9. `record-usage` — cost events.

Retry policy: 2 automatic retries with exponential backoff. Terminal failure sets `failed` + `error_code` and **preserves the previous revision** if one exists. Graceful UI: reason, retry button, existing itinerary still readable.

Idempotency: event key `trip:{tripId}:rev:{revision}`. Persist is transactional.

### Chat turn (synchronous, no Inngest)

1. Verify JWT, ownership, quota, and `revision` match.
2. Build prompt with trip parameters + current itinerary + message.
3. OpenAI → Zod validate (one retry).
4. Resolve Places for new/changed activities only.
5. Transaction: replace itinerary, bump `revision`, insert user + assistant messages, record usage.
6. Return `{ assistantMessage, revision, trip }`.

Latency budget: target < 15 s, hard timeout 45 s. On timeout, return `504` with a recoverable error and do not mutate the trip.

## 12. Screens

- **Sign-in** — Google button, error, loader. Web uses redirect flow; Android uses the native flow.
- **Home** — destination autocomplete, date, duration, adults/children, budget + currency, interests, pace, dietary, accessibility. Inline validation. Submit → Details in `generating`.
- **Trips** — cards with cover image, destination, dates, status badge; pull-to-refresh; empty state.
- **Details** — cover header (ImageKit custom cover + attribution), summary, budget, "Where to stay", day sections, activity cards. Actions: chat, edit, regenerate, share, delete.
- **Chat** — message list, input, pending state with an "applying changes…" indicator, error + retry. No token streaming in v1.
- **Edit mode** — remove, reorder, add custom activity.
- **Profile** — avatar upload (ImageKit), name, usage remaining, sign out, delete account.
- **Web shell** — mobile-first, single column. Exact navigation treatment on wide screens is TBD; default fallback is the same bottom tabs + centered max-width column. Visual design decided separately.

## 13. External integrations

| Service               | Responsibility                                               | Failure behavior                                       |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| Clerk                 | Identity, Google OAuth, user lifecycle events                | Block entry; show auth error                           |
| Clerk webhooks (Svix) | `user.created/updated/deleted` → Neon                        | Retry via Clerk; lazy upsert as fallback               |
| Neon                  | Persistence, transactions                                    | Retry transient errors; `db_error`                     |
| Inngest               | Durable generation, retries                                  | Job stays queued; UI shows delayed state               |
| OpenAI                | Generation + chat                                            | One schema retry; then `ai_error`                      |
| Google Places         | Autocomplete, venue + lodging validation                     | Drop unvalidated venue; fallback neighborhoods         |
| Unsplash + Pexels     | Destination source imagery (Unsplash first, Pexels fallback) | Try second provider; then gradient cover with no image |
| ImageKit              | Profile photos, custom cover transforms, avatar sizes        | Fall back to original source or gradient               |
| Sentry                | Errors, traces, job logs                                     | Non-blocking                                           |
| EAS                   | Android builds, web hosting, OTA                             | Release blocker                                        |

## 14. Implementation phases

### Phase 0 — Accounts and env

1. Google Cloud project with Places API + billing; OpenAI key; Neon; Clerk app (enable Google); ImageKit; **Unsplash API key and Pexels API key**; Sentry; Expo/EAS.
2. No Apple Developer account required.
3. `.env.example`, EAS env vars, `eas.json` profiles (development, preview, production).
4. Confirm Node 22.13+.

### Phase 1 — Foundation

1. Install deps: Clerk set, `expo-auth-session`, `expo-crypto`, `expo-web-browser`, `expo-secure-store` (native), `expo-image-picker`, `expo-sharing`, `react-native-view-shot`, `@tanstack/react-query`, `@sentry/react-native`. Server: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `inngest`, `zod`, `svix`.
2. `app.json`: Clerk + secure-store plugins, Android package, expo-router `origin`.
3. Root layout: platform-aware `ClerkProvider` (token cache on native only), Sentry, Query client, Stack.
4. `src/lib`: Zod schemas, types, constants.
5. **Spike:** Inngest custom/edge `serve()` at `/api/inngest`.
6. **Spike:** Sentry server capture inside an Expo API route.

### Phase 2 — Data, auth, webhooks

1. Drizzle schema + migrations, constraints, indexes.
2. Neon client (HTTP + WebSocket where needed).
3. Clerk JWT verification, `requireUser`, `requireTripOwnership`.
4. `/api/webhooks/clerk` with Svix verification and idempotent handlers.
5. Lazy upsert fallback for webhook lag.
6. Sign-in screen + session gating; verify web redirect flow.

### Phase 3 — Trip form, Places, covers

1. Places Autocomplete proxy.
2. Home form + validation.
3. Cover service: provider chain (Unsplash → Pexels), normalize result to a common shape, store provider + photographer + photographer URL + source URL.
4. ImageKit transform URL builder for custom covers.
5. `POST /api/trips` + Details shell.

### Phase 4 — Generation pipeline

1. OpenAI client, prompt, strict schema.
2. Places resolver for activities + lodging.
3. Budget computation.
4. Transactional persist with revision bump.
5. Inngest function with retries, idempotency, graceful failure.
6. Polling + progress/failure UI.

### Phase 5 — Chat (synchronous)

1. `trip_messages` read/write and UI list.
2. `POST /api/trips/[id]/chat`: quota, revision check, OpenAI, Places delta, transactional replace.
3. Optimistic concurrency: 409 on stale revision; client refetch + resend prompt.
4. Latency instrumentation and timeout handling.

### Phase 6 — Trips, edits, share

1. Trips list with covers.
2. Activity edit endpoints: remove, reorder, add custom.
3. Regeneration with confirmation and transactional replacement.
4. Share: native sheet on Android, Web Share API on web, rendered image.
5. Public page `share/[token].tsx` + `/api/share/[token]`, `noindex`, rate limited, no PII.

### Phase 7 — Profile images, limits, release

1. ImageKit signed upload + `expo-image-picker`; avatar transforms.
2. Usage ledger, per-user quotas, global $50 hard stop, UI feedback.
3. Sentry app + server, job lifecycle logs, source maps.
4. Account deletion cascade + Clerk deletion.
5. CI: typecheck, lint, unit, integration.
6. Manual Android + browser E2E.
7. Privacy policy and Play Store/web disclosures.

## 15. Critical files

- `src/app/_layout.tsx` — platform-aware Clerk, Sentry, Query, Stack.
- `src/app/(tabs)/_layout.tsx` — tabs + responsive shell.
- `src/app/(tabs)/index.tsx` — trip form.
- `src/app/trip/[id].tsx` — details, cover, chat, edit.
- `src/app/(tabs)/profile.tsx` — avatar upload, account deletion.
- `src/app/share/[token].tsx` — public page.
- `src/app/api/**/+api.ts` — thin handlers.
- `src/app/api/webhooks/clerk+api.ts` — Svix verification.
- `src/backend/db/schema.ts` — Drizzle tables and indexes.
- `src/backend/ai/schema.ts` + prompts — generation and chat contracts.
- `src/backend/covers/service.ts` — Unsplash/Pexels + ImageKit transforms.
- `src/backend/media/imagekit.ts` — signed upload + avatar transforms.
- `src/backend/services/chat.ts` — synchronous chat turn.
- `src/backend/services/itineraries.ts` — transactional replacement.
- `src/backend/services/usage.ts` — quotas and spend cap.
- `src/backend/inngest/functions.ts` — generation pipeline.
- `src/lib/trip.ts` — shared schemas and types.

## 16. Verification

1. `npx tsc --noEmit` and `npx expo lint` clean; `npx expo export -p web` builds.
2. Unit: Zod schemas, budget math (activities + separate lodging), quota logic, cover URL builder, revision conflict.
3. Webhook tests: valid Svix signature accepted; invalid rejected; `user.created/updated/deleted` idempotent.
4. API integration with mocked OpenAI/Places: create, ownership rejection, quota rejection, regenerate conflict, chat success, chat 409 on stale revision, chat 504 on timeout without mutation, share revoke, public payload has no PII.
5. Generation retry test: first attempt fails, second succeeds; both fail → `failed` with prior revision intact.
6. Manual Android: Google sign-in, form, generation, chat, edit, share, avatar upload, delete account.
7. Manual browser: same flows; verify responsive layout, web auth redirect, Web Share fallback.
8. Cover fallback chain: Unsplash miss/failure → Pexels; both fail → gradient, trip still usable.
9. Sentry receives an app error and a server job error.

## 17. Risks

1. **Synchronous chat vs serverless timeouts.** OpenAI + Places inside one request can exceed hosting limits. Mitigation: bounded Places delta, 45 s hard timeout, no mutation on timeout, optional streaming later.
2. **Chat concurrency.** Two tabs/devices can submit turns simultaneously. Mitigation: `revision` check → `409`, client refetch.
3. **Unsplash/Pexels license vs ImageKit proxying — ACCEPTED RISK.** Both providers are used; the chosen path fetches stock images through ImageKit. This may breach hotlinking/attribution terms of either provider. Mitigation: store and display attribution for both; review both providers' terms before launch; be ready to switch to owned/licensed imagery.
4. **Two providers, two APIs, two rate limits.** Unsplash has a demo/production quota with a required attribution link; Pexels has hourly quotas. Mitigation: a single normalized cover interface, provider-aware caching of the search result, and per-provider error isolation so one outage does not block cover assignment.
5. **Clerk webhook race.** User signs in before the webhook lands. Mitigation: lazy upsert on first authenticated request.
6. **Web auth differs from native.** Token cache and secure store are native-only. Mitigation: platform-aware provider; verify in Phase 2.
7. **Web is now a first-class target.** Responsive layout, keyboard handling and file upload behavior need explicit testing.
8. **ImageKit upload auth.** Signature endpoint must be authenticated and rate limited; never expose the private key.
9. **Cost.** Stock search + ImageKit transforms + Places + generation + chat under $50/month is tight.
10. **Inngest has no first-party Expo handler.** Spike early; fallback to a small Node service.
11. **Sentry server instrumentation in Expo API routes is unproven.** Fallback: envelope API + logs.
12. **Expo API route bundling:** no dynamic imports, CJS output; prefer `fetch`.
13. **Google Places ToS:** no caching of place content; attribution where required.
14. **AI may propose unresolvable venues.** Degrade per activity, never fail the whole trip.
15. **Normalized tables + full replacement** require careful transactional ordering and stable sort keys.
16. **Share image capture** (view-shot + fonts) needs per-device verification.
17. **Play Store review** requires account deletion, privacy policy, and data disclosures.

## 18. Assumptions

1. "Ingest" = Inngest; "imageKit" = ImageKit.io.
2. Default currency from device/browser locale; user can override. No live FX.
3. Budget covers activities/meals/transport, excludes flights and lodging.
4. Dates are local calendar dates in the destination timezone.
5. One active generation per trip; concurrent requests are rejected.
6. Regeneration and chat replace days, activities and lodging; manual edits are lost after confirmation.
7. Chat is a message thread with a synchronous reply, not streaming.
8. Share links are unlisted, `noindex`, revocable, PII-free.
9. The web target is the full app, mobile-first; there is no separate marketing site.
10. Destination covers come from Unsplash with Pexels fallback; profile photos are the only user uploads.
11. ImageKit applies transformations; the source image may remain remote.
12. Places lookups capped at ≤5 activities/day and 3–5 lodging results.
13. Account deletion cascades rows then deletes the Clerk user; the webhook is idempotent.
14. No analytics vendor; Sentry + job logs are the measurement layer.
15. Android is the only native target; no iOS work.
16. No automated E2E; release verification is manual.
17. Lodging price band is indicative only; no live rates.
18. Drizzle ORM owns schema, migrations and queries.
19. Server folder is `src/backend/`.
20. Chat turns and generations are both quota-metered.
21. Web navigation and all visual design are undecided; implementation uses the mobile-first default until specified.
22. Apple sign-in is v2. No Apple Developer account in v1.
23. Cover provider order is Unsplash then Pexels. Both keys are provisioned.
