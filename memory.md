# Memory — Triply v1 Discovery & Planning

Last updated: 2026-10-17

## What was built

Nothing yet — no application code written. Only planning artifacts and repository hygiene:

- `PLAN.md` — full v1 blueprint (18 sections: scope, decisions, architecture, data model, API surface, AI contracts, pipelines, screens, integrations, phases, verification, risks, assumptions).
- Session memory `/memories/session/plan.md` (same content, older copy).
- Repo memory `/memories/repo/conventions.md` — plan lives at project root; folder conventions.

Workspace is still the untouched `create-expo-app` template: `src/app/_layout.tsx` is a bare `<Stack />`, `src/app/index.tsx` is placeholder text.

## Decisions made

Hard-to-reverse, future work depends on these:

- **Platforms:** Android + mobile-first web. iOS explicitly out of v1. Single Expo codebase.
- **Auth:** Clerk custom flow (`@clerk/expo`), Google only. Apple deferred to v2. No email/password.
- **User sync:** Clerk webhooks (Svix-verified) → Neon are the source of truth; lazy upsert is the race fallback.
- **Backend location:** same repo, Expo Router API routes, deployed to EAS Hosting. Server logic in `src/backend/` (user chose this over `src/server/`).
- **Boundary:** `src/backend` imported only by `+api.ts` handlers and `src/backend/inngest/**`. `src/lib` is the only isomorphic layer.
- **DB:** Neon Postgres + Drizzle ORM. Normalized tables (`trips`, `trip_days`, `activities`, `trip_lodging`, `trip_messages`), not JSONB itinerary.
- **Generation:** asynchronous via Inngest, polled from the client. 2 automatic retries, then graceful `failed` state that preserves the previous revision.
- **Chat editing:** synchronous, non-streaming JSON. No Inngest in the chat path. Full itinerary replacement, `revision` optimistic concurrency → 409.
- **AI:** OpenAI mid-tier, strict JSON schema. Model returns `searchQuery`; Google Places resolves real place data.
- **Lodging:** added post-interview. Name + neighborhood + price band, Places-validated. Budget shows a separate approximate lodging line, never summed with activities.
- **Images:** destination cover from Unsplash with Pexels fallback, transformed through ImageKit; profile photo upload via ImageKit signed upload. No Google Places photos.
- **Limits:** 10 generations + 50 chat turns per user/month, $50/month global hard stop. Free beta, no paywall.
- **Sharing:** native sheet on Android, Web Share API on web, plus public `noindex` read-only page + deep link.
- **Limits of scope:** no flights/hotels booking, no offline, no push, no i18n, no analytics vendor, no automated E2E.

## Problems solved

- Clarified that the Clerk Expo package is `@clerk/expo`, not `@clerk/clerk-expo`; native Google sign-in needs a dev build.
- Established that Expo Router API routes are viable here because `web.output: "server"` is already set.
- Resolved the Google Places ToS conflict: no Places photos, no caching of place content.
- Resolved the ImageKit-vs-stock-license conflict by user decision (accept the risk, review terms before launch).
- Resolved "chat" ambiguity: it is a synchronous request/response, not a streaming thread, and not Inngest-driven.
- Resolved storage-model ambiguity: normalized tables, with transaction-based whole-itinerary replacement.

## Current state

- Plan is complete and approved; no open blocking decisions for engineering.
- No code, no dependencies, no accounts, no schema, no tests.
- `PLAN.md` exists at project root and is the source of truth.
- Design/visual direction is explicitly deferred; web navigation on wide screens is undecided (default: bottom tabs + centered max-width column).

## Next session starts with

Create a `.env.example` and scaffold Phase 1 foundation:

1. Run `npx expo install` for the Clerk set, `@tanstack/react-query`, `expo-image-picker`, `expo-sharing`, `react-native-view-shot`, `@sentry/react-native`; add server deps (`drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `inngest`, `zod`, `svix`).
2. Configure `app.json` (Clerk + secure-store plugins, Android package, expo-router `origin`).
3. Build the platform-aware root layout (Clerk token cache native-only, Sentry, QueryClientProvider, Stack).
4. Then run the two spikes together: Inngest `serve()` at `/api/inngest`, and Sentry server capture inside an Expo API route. Both are unproven and gate the architecture.

## Open questions

- Web navigation treatment on wide screens (user will decide later).
- Visual design system entirely undecided.
- Exact OpenAI model ID and pricing must be verified against current docs before coding.
- Confirm Unsplash and Pexels terms permit ImageKit fetch/transform before public launch.
- No accounts provisioned yet (Google Cloud/Places, OpenAI, Neon, Clerk, ImageKit, Unsplash, Pexels, Sentry, EAS).
