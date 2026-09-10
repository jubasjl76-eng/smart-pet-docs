# Smart Pet — Development & Deployment Plan

**Date:** 2026-09-08 · **Owner:** jubasjl76-eng

Turns the 🔨 / 📋 items in [`SMART-PET-PROGRESS.md`](SMART-PET-PROGRESS.md) into a
sequenced plan.

**Priority (updated):** build a **usable breeder product first, running locally**
(no cloud). Deploy infrastructure (Terraform, EMQX, RDS, ECS, CI/CD) comes
**last** — it only matters once real users and real hardware exist. Everything up
to that point runs on `docker compose` on a laptop or a small box on the kennel
LAN, with the simulator standing in for devices. The one exception is **Phase 3,
the public marketing site**, which ships on Vercel from day one — it's a separate
repo with its own release cadence and doesn't touch the AWS work.

Slices 1–4 are **merged** to `development` / `main`. This plan covers only what's
left, and only **approved** scope — the vision-doc backlog items are in §7 and are
**not** planned.

**Deferred by request:** the Expo app (`smart-pet-app`). The backend is kept
app-ready; no Expo work is scheduled and none is needed yet.

---

## 1. Guiding decisions

Some already apply; the infra ones only bind at Phase 9.

| Decision | Recommendation | Why |
|---|---|---|
| **Local dev environment** | `docker compose` **on your laptop**: Postgres + Mosquitto + `smart-pet-backend` + `backoffice-dashboard`. `smart-pet-backend` already ships a `docker/docker-compose.yml`; extend it with the dashboard. Devices = `smart-pet-simulator`. You watch it in a browser at `localhost`. | The whole breeder product can be built and demoed with zero cloud. Decided: laptop only for now. |
| **Schema management** | `node-pg-migrate`; migrations run on `docker compose up` locally and as a one-off task in the pipeline later. Keep the idempotent boot DDL only as a fallback. | Removes the multi-instance DDL race before it ever bites. |
| **MQTT broker (later, cloud)** | Self-host **EMQX** on ECS behind an NLB; Mosquitto locally and in `dev`. | The contract + TS clients + firmware SDK are built for plain MQTT with username/password + LWT. Not worth an AWS IoT Core rewrite. |
| **Camera service placement (later)** | Run `pet-iot-camera-service` **at the edge** near the cameras, not in the cloud. | RTSP ingest across the internet is fragile and a security liability. |
| **Cloud ↔ device path (later)** | Everything publishes to the broker; the backend's breeder engine already consumes MQTT. Legacy `POST /api/iot/*` stays off. The Pet Hub's cloud bridge connects a LAN broker to the cloud broker. | One path, already built. |
| **Secrets** | Local: `.env` (git-ignored). Later: AWS Secrets Manager, referenced by task defs. Never in code, tfvars, or user-data. | The current `main.tf` bakes the API key into user-data — must not ship. |

---

## 2. Phased delivery

Each phase is independently demoable. Rough size: **S** ≈ days, **M** ≈ 1–3 weeks, **L** ≈ 1–3 months.

**Every product phase (1–9) is done before any deploy work.** Phases 1–2 and 4–8
need **no cloud** (all `docker compose` on your laptop). Phase 3 (the public
marketing site) ships on Vercel and runs independently of the rest. Phase 9 is
device firmware (local + hardware). Phase 10 is deploy (AWS / Terraform).

### Phase 1 — Auth + kennel setup + device pairing  ·  size M  ·  ✅ merged (backend #7)

The "way in" that everything else needs. Delivered: `users`/roles + rotating refresh tokens,
hand-rolled forward-only migration runner, boot seed (owner + kennel + preset rules + pens,
auto-created on first boot in any environment), `kennels` row + `withKennel` context, first-run
setup endpoints, device pairing codes + `POST /claim` (mints per-device MQTT creds + Mosquitto
ACL sync), staff invites + user admin, dashboard added to `docker compose` behind a `dashboard`
profile.

| Task | Size |
|---|---|
| Local dev: extend `docker/docker-compose.yml` with the dashboard; add `node-pg-migrate` + convert `BREEDER_DDL` to migrations | S |
| `users` + roles (`owner` / `staff`); JWT + refresh; harden the existing `auth` middleware | M |
| Replace the `BREEDER_KENNEL_SLUG` env assumption with a real `kennels` row + `kennelContext` middleware | S |
| First-run setup endpoints + a wizard: register kennel → add pens → add dogs (sire/dam) → install preset rules → claim devices | M |
| Device claiming — pairing code / QR, `POST /devices/claim`, mints per-device MQTT credentials; a simple `devices` → Mosquitto ACL file/table sync | M |
| Staff invite + minimal user admin | S |

**Exit:** `docker compose up`, log in, complete setup, claim a simulated feeder — it appears online.

### Phase 2 — Breeder web console  ·  size L  ·  ✅ merged (dashboard #2, backend #8)

Make every merged backend capability usable. `backoffice-dashboard` (React 19 / Vite / Tailwind / React Router 7 — kept the stack).

| Task | Size | State |
|---|---|---|
| API client + auth (login / refresh / kennel context) | S | ✅ `lib/api.ts` + `lib/auth.tsx` — token in `localStorage`, single-flight refresh-on-401 |
| Live updates via **SSE** from the backend (no Redis needed for one instance) | S | ✅ backend `GET /api/breeder/stream` + `lib/stream.ts` `useStream()` (auto-reconnect, `?token=` auth) |
| **Care inbox** — triaged list, live priority, acknowledge / snooze / resolve / escalate / assign, suggested action, notification history | M | ✅ live via SSE; per-item drawer with notification history |
| **Animals + Care Plans** — list, detail, edit the plan; **Pens board** with occupancy + move-a-dog | M | ✅ care-plan editor + weight log + growth chart; pens board with per-dog move + unassigned tray |
| **Litters + puppies** — plan / whelp / puppy records + **growth charts** (reading vs expected curve) | M | ✅ multi-puppy growth chart, daily-gain + assessment flags |
| **Buyers / waitlist** — list, rank, deposit, match a buyer to a puppy | M | ✅ status + deposit toggles; rank shown |
| **Meds worklist** — due-list, register administration (given / skipped / refused), compliance view | M | ✅ "due in 24h" worklist + given/skip/refused with reason; schedule admin |
| **Rules** — list, toggle, dry-run, install presets, firing history | S | ✅ toggle + install presets + delete (dry-run/history deferred to a follow-up) |
| **Maintenance** — per-device predictions + "serviced"; **Emergency** — trigger / end + manifest; **Consumables**; **Wellness** per animal | M | ✅ Ops tab: consumables (warn-only) + maintenance + emergency + manifest. Wellness surfaced on the animal drawer — follow-up |
| Accessibility pass (keyboard, contrast, labels, reduced-motion) | M | 🔨 focus-visible rings, `motion-reduce`, `role`/`aria` on controls + dialog; full keyboard/contrast audit pending |
| Serve the dashboard from the compose stack; optionally from a box on the kennel LAN | S | ✅ `dashboard` compose profile + nginx (`proxy_buffering off` for SSE) |

**Exit:** a breeder runs a full day's operations from the console against local data + the simulator.

_Merge order: dashboard #1 → backend #7 → backend #8 → dashboard #2._

### Phase 3 — Public showcase website  ·  size L  ·  new repo `smart-pet-website`  ·  ✅ A + B merged (website #1–#5, backend #9, dashboard #3) · 🚧 C (i18n) in progress

A high-end, scroll-driven marketing site that sells puppies, auto-fed from the
breeder dashboard (published rows only). Ships on **Vercel** — not in the
`docker compose` / Terraform stack, and does not wait for Phase 10.

**Stack:** Next.js (App Router) + TypeScript + Tailwind · ISR (~5 min) + an
on-publish revalidate webhook · **GSAP ScrollTrigger + Lenis** for the
scroll choreography · Recharts (reused from the console) for growth curves ·
design system via `taste-skill` + `brandkit`. Retriever-general copy & design
(Golden now, Labrador later — breed is a field, not a theme). **Locales:
Portuguese (default) and English** — `/` is `pt`; English lives under `/en`.

**Backend delta (small, in `smart-pet-backend`):**
- `published` flag + `photos[]` (JSONB) on `animals` / `litters` / `puppies`
- `routes/public.ts` — read-only `/api/public/*` (no auth, published rows only): `kennel`, `dogs`, `litters`, `litters/:id`
- `POST /api/public/inquiries` — creates a `buyers` row (`source=website`, links `puppy_id` / `wants_litter_id` when given, `status=inquiry`) and raises a low-priority care-inbox item. **Never mutates puppy status** — a public click is a request, the owner confirms in the console.
- dashboard: a "Publish to website" toggle + a multi-URL photo field on dogs / litters / puppies

| # | Task | Owner | Size |
|---|---|---|---|
| F1 | Scaffold `smart-pet-website`, Vercel project, CI, PR previews | Claude | S |
| F2 | Design tokens via `taste-skill` / `brandkit` — palette, type scale, spacing, motion tokens (retriever-neutral) | Claude | S |
| F3 | Public API contract (`docs/public-api.md`) + `mock/*.json` fixtures matching it exactly | Claude | S |
| F4 | `lib/api.ts` typed server-side fetch layer + ISR / revalidate strategy | Claude | S |
| A1 | Scroll engine — Lenis provider, ScrollTrigger, a `<ScrollScene>` pin/scrub primitive, `prefers-reduced-motion` fallbacks | Claude | M |
| A2 | Home choreography — hero → program → featured dogs → current litter → testimonials → CTA, each scroll-driven | Claude | M |
| A3 | Litter / puppy **detail page** — layout, growth chart, status states, "Reserve this puppy" + waitlist fallback | Claude | M |
| A4 | Our Dogs page — dam / sire profiles, breed filter | Claude | S |
| A5 | SEO — metadata, OG images, JSON-LD (`LocalBusiness` + `Product`/`Offer` per available puppy), sitemap, robots | Claude | S |
| A6 | Backend `routes/public.ts` + `published` / `photos[]` migration + revalidate webhook | Claude | M |
| A7 | Dashboard — "Publish to website" toggle + photo-URL field | Claude | S |
| A8 | Accessibility + perf pass — keyboard, contrast, reduced-motion, Lighthouse, image strategy | Claude | S |
| A9 | Integration — swap mocks for the live API, empty states, launch checklist | Claude | S |
| B1 | UI primitives from tokens — `Container` `Section` `Button` `Badge` `Tag` `Card` `Divider` | Cursor | S |
| B2 | `<Media>` image component — `next/image` wrapper, blur-up, aspect-ratio, gallery + lightbox | Cursor | S |
| B3 | Header + mobile nav drawer, Footer, breadcrumb | Cursor | S |
| B4 | Inquiry / reserve form — fields, zod validation, honeypot, `POST /api/public/inquiries`, success/error states | Cursor | M |
| B5 | Static content as MDX / JSON — About, Health & Guarantee, FAQ, testimonials, program values (realistic placeholder) | Cursor | S |
| B6 | `PuppyCard` / `LitterCard` / `DogCard` — presentational, shape from F3 | Cursor | S |
| B7 | Loading skeletons, 404, error boundary | Cursor | S |
| B8 | Utils + unit tests — age/date formatting, status→label/colour maps, form-validation tests | Cursor | S |
| B9 | Responsive + polish pass on primitives; dark-section styling | Cursor | S |
| B10 | `/dev/components` preview route rendering every component against mock data | Cursor | S |
| C1 | i18n routing — Next.js `[locale]`, default `pt` (unprefixed `/`), `en` at `/en`; `html lang`; locale switcher in the header | Cursor | M |
| C2 | Message catalogs for UI chrome — nav, buttons, status labels, form, 404/error, dates (`pt-PT` / `en-IE`) | Cursor | S |
| C3 | Translate B5 static pages — About, Health & Guarantee, FAQ, testimonials, program values (PT first, then EN) | Cursor | M |
| C4 | SEO for two locales — `hreflang`, locale-prefixed sitemap, translated metadata / JSON-LD | Claude | S |

**Parallelization:** F1–F4 land first (~1–2 days) and unblock everyone. Then the
**A** column (Claude — scroll, pages, backend) and the **B** column (Cursor —
primitives, forms, content, cards) run fully concurrently against shared
**tokens + mock JSON**: Cursor never imports scroll code; Claude consumes
Cursor's components only through the prop APIs fixed in B1 / B6. Sole merge point
is **A9**. A6 / A7 (backend + dashboard) are independent and can land any time
before A9. **C (i18n) starts after A9** — routing wraps the finished pages;
do not locale-split while A and B are still landing.

Published API rows (`kennel.about`, dog bios, litter descriptions) stay
**one language** for now — whatever the breeder types in the dashboard. Bilingual
fields on `animals` / `litters` are a follow-up, not in C1–C4. The staff
console stays English.

**Testimonials** live as a Home section, not their own page. No blog.

**Exit:** a prospective owner browses the dogs and the current litter and either
reserves a specific puppy or joins the waitlist — the request lands in the
breeder's care inbox.

### Phase 4 — Notifications that reach people  ·  size M  ·  ✅ merged (backend #10, dashboard #4)

Right now alerts queue but only `log` / `webhook` deliver — "skipped 2 meals" reaches nobody.

| Task | Size |
|---|---|
| Wire the notifier adapters for the chosen channels (**email** + **SMS or a chat webhook**); provider keys in `.env` (Secrets Manager later) | M |
| Siren channel via an MQTT `relay` command to a `hub` / `door` device | S |
| Delivery receipts + retry/backoff in `engine/notifier.ts` | S |
| Per-recipient preferences UI in the console (channels, quiet hours, escalation chain) | S |
| E2E test: an escalation chain firing to real email/SMS in dev | S |

**Exit:** an unacknowledged critical alert reaches your phone and then escalates.

### Phase 5 — Buyer loop + vaccination records  ·  size L  ·  ✅ merged (backend #11 + #12, dashboard #5)

The half-built buyer loop, plus the health record the go-home pack depends on.

| Task | Size |
|---|---|
| Puppy **update pack**: photo upload + an email template + a scheduled weekly send per reserving buyer | M |
| **Buyer messaging** — waitlist broadcast ("litter due in March, 3 spots"), per-buyer updates | S |
| **Vaccination & worming schedule** per dog — protocol templates, due reminders → care inbox, certificate upload + storage | M |
| **Go-home pack assembly** — one deliverable pulling weight series + vaccination record + photos + (later) documents | M |

**Exit:** a reserving family gets an automatic weekly update; the go-home pack builds itself from real records.

### Phase 6 — Breeding calendar  ·  size L  ·  ✅ backend merged (#13) · 🚧 calendar view (Cursor)

The planning layer upstream of litters (litters themselves are already built).

| Task | Size |
|---|---|
| **Heat-cycle tracking** per dam — log seasons, predict the next, estimate the fertile window | M |
| **Planned matings** — pair dam × sire, record mating dates + progesterone results | S |
| **Due-date countdown** — auto-creates the litter shell at ~day 58; whelp confirmation flows into the existing litter record | M |
| **Calendar view** — all dams' cycles, planned/confirmed matings, due dates, go-home dates on one timeline | M |

**Exit:** the breeder runs a litter from first season through go-home in one place.

### Phase 7 — Documents & paperwork  ·  size M  ·  ✅ backend merged (#14) + slice 2 open (#15)  ·  🚧 console (Cursor)

| Task | Size |
|---|---|
| **File storage abstraction** — local disk/volume now, S3 later behind the same interface | S |
| **Pedigree** — a 3–4 generation lineage view from the sire/dam links + upload of registration papers per dog | M |
| **Sale documents** — contract / deposit receipt / health guarantee generated from a template per sale, stored against the buyer + puppy | M |
| **Microchip hand-off** — record the chip transfer to the new owner; include the docs in the go-home pack | S |

**Exit:** every sale has its paperwork attached; buyers get a complete pack.

### Phase 8 — Privacy & data-governance  ·  size M  ·  ✅ slice 1 merged (#16)  ·  🚧 slice 2 backend open (#17)  ·  console (Cursor)

Now covers vaccination certs, contracts, pedigree docs and buyer PII, not just camera footage.

| Task | Size |
|---|---|
| Retention windows for camera clips / vaccination certs / contracts / buyer records | M |
| An `access_log` table + middleware on every camera/door read and document download | M |
| GDPR `export` + `delete` for a buyer / owner / animal / litter | M |
| Written policy; data-ownership model; legal review for the target market | M |

**Exit:** you can put a real buyer's data in the system and defend how it's handled.

### Phase 9 — Real devices  ·  size L  ·  ✅ slices 1+2 backend (#19 fleet+rollout, #20 geofencing)  ·  🚧 9.3 SDK CI (sdk #1)  ·  9.4 firmware ports need a board

| Task | Size |
|---|---|
| SDK PlatformIO CI (compile the examples for `esp32dev`) + resolve the `MIGRATION.md` open items | M |
| Port **`smart-feeder`** onto the SDK (reconcile with the existing `development` MQTT firmware); then **`smart-water-dispenser`**, then **`gps-dog-collar`** (+ migrate `dogs/…` → `kennel/…/gps/…`) | L |
| Signed OTA + A/B partitions + a staged-rollout controller (`firmware` table + `POST /api/fleet/firmware`) | M |
| **Two-way audio device path** — ESP32 mic + speaker; wire to the existing relay | M |
| **GPS geofencing** — safe-zone CRUD + enter/exit detection in the collar consumer + escape alert | M |

**Exit:** one device type on the SDK, OTA-updatable, running in a real pen.

### Phase 10 — Deploy  ·  size L  ·  after every product phase (1–9) is done

The infrastructure work, deferred to last. Full detail in §6 below.

| Task | Size |
|---|---|
| Rebuild `smart-pet-terraform` (bootstrap state → network → RDS → EMQX → ECS → ALB → CDN → observability); `dev` then `prod` | L |
| GitHub → AWS OIDC + reusable CI/CD (test → image → ECR → ECS); simulator scenario in CI | M |
| `pet-iot-sensors-service` bug fixes + deploy + missing alert types | M |
| `pet-iot-camera-service` real motion + registry persistence + edge deployment + TURN | M |
| Scale: EMQX clustering, RDS Multi-AZ, autoscaling, load test with the simulator; `prod` cutover | M |

---

## 2a. Agent assignment — Phases 3 (finishing) → 10

Phase 3 exposed the real failure mode: two agents editing **one working tree**
at the same time. The fix is **repo isolation**, not just task isolation.

### Durable split

| Agent | Owns | Never touches |
|---|---|---|
| **Claude** | `smart-pet-backend` (schema, migrations, routes, engine, logic, tests). Later: `smart-pet-device-sdk` + firmware repos (Phase 9); `smart-pet-terraform` + CI (Phase 10). | `backoffice-dashboard`, `smart-pet-website` |
| **Cursor** | `backoffice-dashboard` (one console screen per feature). Now: finish `smart-pet-website` i18n (Phase 3 C1–C4). Later: Phase 9 fleet-rollout screen. | `smart-pet-backend`, firmware, terraform |

### Rules

- **One repo per agent at a time.** Feature branch → PR to `development`.
- Cursor runs in **its own checkout / git worktree** of the web repos — never the one Claude is in, and never the reverse.
- Every backend feature lands with a short **`docs/<feature>.md` API contract**. That doc is the handoff: Cursor reads it before building the matching screen (the A6 → A7 pattern that worked cleanly in Phase 3).
- The **backend PR merges before** the dashboard PR that consumes it.
- The staff console stays **English**. Only `smart-pet-website` is bilingual (`pt` default, `/en`).

### Per phase

| Phase | Claude — `smart-pet-backend` | Cursor — `backoffice-dashboard` (+ website i18n) |
|---|---|---|
| **3 — finishing** | — | **C1–C4**: `[locale]` routing (`pt` default, `/en`), message catalogs, translate the static pages, bilingual `hreflang` / sitemap / JSON-LD |
| **4 — Notifications** | notifier adapters (email + SMS or chat webhook); siren via MQTT `relay`; delivery receipts + retry/backoff in `engine/notifier.ts`; E2E escalation test | per-recipient **notification preferences** screen — channels, quiet hours, escalation chain |
| **5 — Buyer loop + vaccination** | `vaccinations` schema + protocol templates + due-reminder sweep → care inbox + certificate storage; update-pack data endpoint; go-home-pack assembly endpoint; buyer-messaging endpoints | vaccination schedule + certificate upload UI; weekly **update-pack** composer; **buyer messaging** (waitlist broadcast + per-buyer); go-home-pack view |
| **6 — Breeding calendar** | heat-cycle log + next-season prediction + fertile-window; planned matings + progesterone; due-date countdown that auto-creates the litter shell | **calendar view** (cycles / matings / due dates / go-home on one timeline); cycle-log + mating forms |
| **7 — Documents** | file-storage abstraction (disk now, S3 later, one interface); pedigree lineage query; sale-doc template generation (contract / receipt / guarantee); microchip hand-off record | pedigree 3–4-generation **lineage view**; registration-paper + document upload UI; generated-doc preview / download; hand-off checklist |
| **8 — Privacy** | retention jobs; `access_log` table + middleware on camera / door reads + document downloads; GDPR `export` + `delete` per buyer / owner / animal / litter | **data & privacy** admin screen — retention settings, access-log viewer, export / delete actions |
| **9 — Real devices** | SDK PlatformIO CI; port `smart-feeder` → `smart-water-dispenser` → `gps-dog-collar`; signed OTA + A/B partitions + staged-rollout controller (`firmware` table + `POST /api/fleet/firmware`); two-way-audio device path; GPS geofencing | **fleet / firmware** screen — device list, firmware versions, staged-rollout controls |
| **10 — Deploy** | rebuild `smart-pet-terraform`; GitHub → AWS OIDC + reusable CI/CD; `pet-iot-sensors-service` fixes; `pet-iot-camera-service` edge deploy | (idle on the console; optional `smart-pet-website` polish) |

**Status:** Phase 3 A + B are merged. Only **C (Cursor, i18n)** is outstanding —
it is the current Cursor task and Claude does not touch `smart-pet-website` while
it runs.

---

## 3. Dependency graph

```
Phase 1 (auth + setup + pairing)
   └─▶ Phase 2 (web console)
          ├─▶ Phase 3 (public website) ── Vercel, independent of the rest
          ├─▶ Phase 4 (real notifications)
          ├─▶ Phase 5 (buyer loop + vaccination records)
          │       └─▶ Phase 7 (documents) ─┐
          ├─▶ Phase 6 (breeding calendar) ─┤
          └────────────────────────────────┴─▶ Phase 8 (privacy) ─▶ real users

Phase 3 needs Phase 2's data model + the buyers route; it only adds a small
  read-only public API + a dashboard toggle, then runs on its own release cadence.
Phase 9 (real devices) needs Phase 1 for claiming; otherwise parallel from the start.
Phase 10 (deploy) is last — every non-website product phase runs on docker compose first.
Deferred: smart-pet-app (Expo) — after Phase 4.
```

**Local demo of the whole breeder product:** end of Phase 7.
**Ready for a real kennel on the LAN:** + Phase 8 + Phase 9 (one device type).
**Multi-kennel / cloud:** Phase 10.

---

## 4. Cross-cutting engineering standards (from Phase 1)

- **Migrations, not boot DDL** — `node-pg-migrate`.
- **Secrets in `.env` locally** (git-ignored), Secrets Manager later — never in code or Terraform vars.
- **Every service**: `/health` + `/ready`, structured logs, a non-root Dockerfile, `tsc --noEmit` + `vitest` green.
- **Contract is `smart-pet-mqtt`** — the C++ mirror (`spd_topics.h`) and the vendored subsets (edge-gateway, simulator) update in the same PR that changes the contract.
- **The simulator is a test dependency** — a scenario runs against an ephemeral broker + backend for the backend and edge-gateway repos.

---

## 5. Deferred & backlog

### Deferred (agreed, not now)

| Item | Picks up after |
|---|---|
| `smart-pet-app` (Expo) — API wiring, screens, EAS Build, push, offline mode | Phase 4 (notification infra ready); reuses Phase 2's API-client patterns |

### Backlog — proposed in the vision doc, **never approved**

Not planned. Do not build without a decision.

| Item | Note |
|---|---|
| Camera AI — dog-centric clip curation + bark/whine detection | Needs a real motion pipeline + a model |
| Cross-product Care Plan handoff (home ↔ kennel "bridge") | Needs a multi-tenant user model |
| Vet / sitter time-boxed share links | Needs the user model |
| Household sharing | Needs the user model |
| Multi-site / franchise (`org` layer above kennel) | The operator runs one kennel |
| Analytics / data warehouse | Design the event schema if/when approved |
| Treat-toss / play module | B2C hardware add-on |
| Tiered hardware bundles + subscription billing | Open business question |
| Consumables auto-reorder partner | Explicitly rejected — warn only |
| Battery-backup accessory | Hardware effort |
| AWS IoT Core migration | Not needed |

---

## 6. Infrastructure reference (Phase 10)

> Kept for when Phase 9 starts. Not first.

### 6.1 Target topology

```
                         Route53 (smartpet.example)
                    ┌──────────┬──────────┬──────────┬──────────┐
                    │ api.     │ mqtts.   │ cdn.     │ dashboard.│
                    ▼          ▼          ▼          ▼
                  ALB        NLB     CloudFront   CloudFront
                    │          │          │          │
        ┌───────────┘          │        S3: hls/ snapshots/ firmware/ buyer-photos/
        ▼                      ▼
   ECS Fargate            ECS: EMQX broker (Fargate + EFS for retained msgs)
   ┌──────────────┐            │
   │ backend :3000│────────────┤   (private subnets, NAT egress)
   │ sensors :3005│            ▼
   └──────┬───────┘   ElastiCache Redis (only once multi-instance)
          ▼
   RDS PostgreSQL (Multi-AZ in prod)

  Edge (on-prem, per kennel/home — NOT in Terraform):
   Pet Hub ── cloud MQTT bridge ──▶ NLB/EMQX
   camera-service ── HLS ──▶ S3 ── events ──▶ MQTT
   ESP32 devices ── MQTT ──▶ local broker ──▶ bridge
```

### 6.2 `smart-pet-terraform` layout

```
bootstrap/            # S3 state bucket + DynamoDB lock (run once, local state)
modules/
  network/            # VPC, 2×AZ public+private subnets, IGW, NAT, VPC endpoints
  database/           # RDS Postgres + SG + param group + master secret + backups
  cache/              # ElastiCache Redis (count = var.enable_redis)
  mqtt-broker/        # ECS EMQX/Mosquitto + NLB (1883/8883) + ACM + EFS
  ecs-cluster/        # cluster + capacity providers + shared roles
  ecs-service/        # REUSABLE: task def + service + ALB target group + autoscaling + logs
  alb/               # public ALB + HTTPS + ACM + WAF (prod)
  cdn/               # S3 + CloudFront + OAC (per: hls, firmware, dashboard)
  dns/ ecr/ secrets/ observability/
envs/
  dev/  { backend.tf (state key=dev),  main.tf, dev.tfvars }
  prod/ { backend.tf (state key=prod), main.tf, prod.tfvars }
.github/workflows/ tf-plan.yml  tf-apply.yml
```

### 6.3 Per-environment sizing

| Resource | `dev` | `prod` |
|---|---|---|
| RDS | `db.t4g.micro`, single-AZ | `db.t4g.small`+, Multi-AZ, deletion protection |
| Redis | off | `cache.t4g.micro` + 1 replica |
| Broker | Mosquitto, 1 task | EMQX, 2+ tasks, cross-zone NLB |
| Backend | ×1 | ×2 + autoscale 2–6 |
| ALB / CDN | HTTPS + ACM | + WAF + access logs |
| Cost | ~$60–90/mo | ~$250–450/mo |

### 6.4 CI/CD

| Trigger | Job |
|---|---|
| PR | `tsc --noEmit` + `vitest run` (+ `pio` compile for the SDK, `terraform plan` for infra) |
| Merge to `development` | image → ECR → `aws ecs update-service --force-new-deployment` for `dev`; migration task first for the backend |
| Tag `v*` | same, targeting `prod`, behind a manual approval |
| Merge to infra `main` | `tf-apply` dev; prod gated |

---

## 7. What I need from you

### Decided

| Question | Answer |
|---|---|
| Sequencing | Auth → console → **public website** → notifications → buyer loop → calendar → documents → privacy → devices → deploy. App parked. |
| Breeder-workflow scope | **All of it.** Vaccination records → Phase 5, breeding calendar → Phase 6, pedigree + contracts + receipts → Phase 7. |
| Website scope | Scroll-driven marketing site, auto-fed from the dashboard (published rows only); "Reserve this puppy" + waitlist, no prices, no payments; Next.js on Vercel; realistic **placeholder** content until real assets arrive. **Portuguese (default) + English** — `/` is `pt`, `/en` is English. |
| Notification channels | Decide at Phase 4 — adapters built generically until then. |
| Where the console runs | Your laptop (`docker compose`), browser at `localhost`. |

### Still open (not blocking yet)

| When | Decision |
|---|---|
| Phase 3 (anytime, non-blocking) | Real kennel content to replace the placeholder: story / About, health-testing details, guarantee & contract terms, 6–10 hero photos, logo (or a brief), brand colours, the domain. The build proceeds without them. When you have it, send **PT + EN** copy. |
| Phase 3 (after C1–C4) | Whether published dashboard fields (bios, litter blurbs) need a second language, or the breeder writes one locale only. |
| Phase 4 | Pick the notification channel(s) — email only / + SMS / + a Telegram/Slack/Discord webhook — and create the account, hand me the keys + a test email/phone. |
| Phase 7 | Which registry (KC / AKC / FCI / other) for pedigree + papers, and which fields matter. Your vaccination/worming protocol + a list of your dams & sires (breeds) to seed realistic defaults. |
| Phase 10 | An AWS account + a domain. |

### Your hands-on bits

| When | You do |
|---|---|
| **Now** | Install **Docker Desktop**. Nothing for Expo — not needed. |
| Phase 3 | Nothing required to build it (placeholder content). Later: send real photos / copy / logo / domain, and connect the Vercel + GitHub accounts for deploy. |
| Phase 4 | Create the notification provider account(s) once you pick channels; give me the API keys + a test email/phone. |
| Phase 7 | Send me your vaccination protocol, dam/sire list, and the registry you use. |
| Phase 10 | Provide the AWS account + domain; provider keys move to Secrets Manager. |

Nothing needs your intervention to start Phase 3 — the website builds against placeholder data.
