# Smart Pet — Build Progress

**Date:** 2026-09-09 · **Owner:** jubasjl76-eng

## 🏷️ Release v1.0.0 — prod cutover (2026-09-09)

Phases 1–10 complete. `development` promoted to `main` and tagged `v1.0.0` in
every repo.

| Repo | Release PR | `v1.0.0` tag |
|---|---|---|
| smart-pet-backend | [#24](https://github.com/jubasjl76-eng/smart-pet-backend/pull/24) | `e7c42e0` |
| backoffice-dashboard | [#13](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/13) | `28f8ff3` |
| smart-pet-website | [#7](https://github.com/jubasjl76-eng/smart-pet-website/pull/7) | `710f338` |
| smart-pet-mqtt | [#2](https://github.com/jubasjl76-eng/smart-pet-mqtt/pull/2) | `10c6cf4` |
| pet-iot-edge-gateway | [#2](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/2) | `d8635d6` |
| pet-iot-camera-service | [#3](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/3) | `89a567b` (fires `release.yml` → GHCR image) |
| pet-iot-sensors-service | [#3](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/3) | `c019313` (merge resolved a `.gitignore` add/add) |
| smart-pet-device-sdk | — already on `main` | `726501b` |
| smart-pet-ci | — already on `main` | `3c2f22e` |
| smart-pet-terraform | — already on `main` | `1fed633` |
| smart-feeder | — already on `main` | `7ef1711` |
| smart-water-dispenser | — already on `main` (`development` stale) | `f7747e4` |
| gps-dog-collar | — already on `main` (`development` stale) | `ca3e3d1` |
| smart-pet-simulator | — no `development` branch | `5b349b2` |

Still the user's one-time ops step: AWS `bootstrap` → `envs/dev` → `envs/prod`
apply, then set repo vars `AWS_ROLE_ARN` / `DEPLOY_ROLE_ARN` / `AWS_REGION` to
arm the deploy pipelines.

## 🛠️ Hardening track — Phases 11–21 (started 2026-09-09)

Post-`v1.0.0` platform-engineering track: repo boundaries, environments +
secrets, DX, API contract + codegen, error tracking, observability, test
infra, security audit, firmware hardening, traffic/caching/resilience, HA + DR.
Full plan: [`SMART-PET-HARDENING-PLAN.md`](SMART-PET-HARDENING-PLAN.md)
(FINALIZED 2026-09-09).

| Phase | Status |
|---|---|
| 11 — Repo structure & code boundaries | ✅ **DONE** (Renovate App live; branch protection on all 14/14) |
| 12 — Environment strategy & config mgmt | ✅ **DONE** (config contract in all 4 services, `/health`+`/ready`, graceful shutdown, migration advisory lock, feature flags + `/api/config`, `envs/staging` + `modules/cache`, four-tier deploy + GitHub Environments, SOPS+age scaffold, docs) |
| 13 — Developer experience & local dev | ✅ core done — `smart-pet-dev` (Taskfile+compose+MOCKS+devcontainer), shared dev-config in `smart-pet-ci/config/` + `sync-dev-config.sh`, `smart-pet-backend` reference adoption. Per-repo lefthook rollout + `CONTRIBUTING.md` = mechanical follow-up (`sync-dev-config.sh <repo>`). |
| 14 — API contract & documentation | ✅ done — full backend + camera route surface on the zod OpenAPI registry (141 paths); MQTT AsyncAPI + `@jubasjl76-eng/mqtt-contract` topic convergence; api-client adopted by the dashboard transport; Starlight docs site built (repo push pending). Deferred: C++ codegen from AsyncAPI (low ROI). |
| 15 — Error tracking (Sentry) | ✅ code done — every app instrumented (4 Node services + dashboard + website + app), firmware crash path + backend consumer, CI release on deploy. Dormant until the operator creates a Sentry org + DSNs (`OPERATOR-ACTIONS.md` A1/A2). |

**Phase 14 — done:**
- 1 — `smart-pet-backend` OpenAPI registry (`src/openapi/`), `GET /openapi.json` + `/docs` (Scalar), `/api/v1` + deprecated-alias headers, `docs/api-versioning.md`, `auth` routes migrated onto zod ([#32](https://github.com/jubasjl76-eng/smart-pet-backend/pull/32)).
- 2 — `smart-pet-mqtt` **AsyncAPI 3.1** (`asyncapi.yaml`), CI-validated, v2.2.0 ([#6](https://github.com/jubasjl76-eng/smart-pet-mqtt/pull/6)).
- 3a — `openapi.json` committed + `npm run openapi:dump` + freshness test ([#33](https://github.com/jubasjl76-eng/smart-pet-backend/pull/33)).
- 3b — **new repo `smart-pet-api-client`** → `@jubasjl76-eng/api-client@0.1.1`. `openapi-typescript` codegen from the backend's `openapi.json` (committed `src/schema.ts`, daily `regen` PR on drift) + `createSmartPetClient()` `openapi-fetch` wrapper: bearer auth + retry (jittered backoff on 429/5xx/network, `Retry-After`, idempotent + keyed only) + `RateLimitedError`.
- 3c — `@jubasjl76-eng/shared@0.2.0` — `@jubasjl76-eng/shared/openapi` `createOpenApiRegistry()` (the zod OpenAPI registry, packaged for reuse) ([shared#1](https://github.com/jubasjl76-eng/smart-pet-shared/pull/1)).
- 3d — `pet-iot-camera-service` OpenAPI: `/openapi.json` + `/docs`, `/cameras` CRUD + `/ice-servers` on the registry ([camera#7](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/7)).
- 3e — backend `rules` (7) + `inbox` (10) + `medications` (7) routes onto the zod registry; `openapi.json` now **27 paths** ([#34](https://github.com/jubasjl76-eng/smart-pet-backend/pull/34), [#35](https://github.com/jubasjl76-eng/smart-pet-backend/pull/35)).
- 3f — **rest of the backend route surface** onto the registry, batches 3–12 ([#36](https://github.com/jubasjl76-eng/smart-pet-backend/pull/36)–[#45](https://github.com/jubasjl76-eng/smart-pet-backend/pull/45)): breeder `geo` · `fleet` · `documents` · `privacy` · `vaccinations` · `breeding` · `buyerComms` · `animals` · `litters` · `ops` · `devices` · `website` · `public`; owner `devices` · `schedules` · `events` (doc-only, express-validator kept) · `setup` · `users`. `need()` replaced by zod on every migrated write route. `openapi.json` now **141 paths**; every exported sweep/helper (`ingestPosition`, `fleetSweep`, `retentionSweep`, `vaccinationSweep`, `breedingSweep`, `updatePackSweep`, `deriveLitterStatus`) left intact. Only the 4 tiny inline `src/index.ts` endpoints (`/api/config`, `/api/pet`, `/api/stats`, `/api/admin/ping`) remain undocumented.

- 3g — **rest of the tail:** remaining 13 camera routes on the registry ([camera#8](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/8)); backend `src/mqtt/contract.ts` sources the feeder topic scheme + QoS from `@jubasjl76-eng/mqtt-contract` (payload layer kept local — v1 wire format) ([#46](https://github.com/jubasjl76-eng/smart-pet-backend/pull/46)); dashboard transport routes through `createSmartPetClient` (retry/backoff/`RateLimitedError`), `lib/api.ts` surface unchanged ([dashboard#15](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/15)); dead `pet-iot-sensors-service` proxy router removed ([sensors#8](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/8)); **`smart-pet-docs` git repo + Starlight site** built (`site/`, GH Pages workflow) — repo push pending a manual `gh repo create`.

**Phase 14 — deferred:** C++ structs/topics for the SDK from `asyncapi.yaml` — low ROI; `spd_topics.h` is mostly hand-written logic, only the device-type list + QoS policy are contract-derived.

**Phase 15 — done:** `@sentry/node` in **all 4 Node services** — shared `src/instrument.ts` (first import, no-op without a DSN), exported `scrub()` `beforeSend` (auth / `x-api-key` / cookies, unit-tested), `src/version.ts`, Sentry vars in each config contract + `.env.example`. Express services (`backend`, `sensors`, `camera`) use `setupExpressErrorHandler`; `edge-gateway` (raw `http`) uses `Sentry.captureException` in the route dispatcher + start-failure catch. ([backend#47](https://github.com/jubasjl76-eng/smart-pet-backend/pull/47), [gateway#7](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/7), [sensors#9](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/9), [camera#9](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/9))

**Phase 15 — UI (all merged):** `@sentry/react` in the **dashboard** ([#16](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/16) — `Sentry.ErrorBoundary`, URL-token redaction, `@sentry/vite-plugin` gated on `SENTRY_AUTH_TOKEN`); `@sentry/nextjs` in the **website** ([#9](https://github.com/jubasjl76-eng/smart-pet-website/pull/9) — per-runtime `instrumentation` files, `global-error.tsx`, `withSentryConfig`); `@sentry/react-native` in the **app** ([#4](https://github.com/jubasjl76-eng/smart-pet-app/pull/4) — `Sentry.wrap`, Expo config plugin, pinned to `~7.11.0` for SDK 55).

**Phase 15 — firmware + CI:** `smart-pet-device-sdk` publishes one `crash` event after a panic / watchdog / brown-out reset ([sdk#7](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/7) — `spd_crash.h`, `esp_reset_reason()`); the backend engine forwards it to `Sentry.captureEvent` (fingerprinted by device-type + reason) + a critical `device-crash` care-inbox item ([backend#48](https://github.com/jubasjl76-eng/smart-pet-backend/pull/48), [#49](https://github.com/jubasjl76-eng/smart-pet-backend/pull/49)). `smart-pet-ci/deploy-ecs.yml` creates a Sentry release + stamps `SENTRY_RELEASE` on the task on every deploy ([ci#14](https://github.com/jubasjl76-eng/smart-pet-ci/pull/14), wired into backend + sensors `deploy.yml`).

**Phase 15 — remaining:** only the ops step — a Sentry org + a DSN per project + the `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` org secret (`OPERATOR-ACTIONS.md` A1/A2). Optional: Node source-map upload; a dedicated `SENTRY_FIRMWARE_DSN`.
| 16 — Observability | 🔨 in progress — **`GET /metrics` on all 4 services** ([backend#50](https://github.com/jubasjl76-eng/smart-pet-backend/pull/50), [gateway#8](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/8), [sensors#11](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/11), [camera#10](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/10)). `prom-client`: default process metrics + `http_request_duration_seconds` histogram (bounded route label) + per-service gauges — `pg_pool_connections` (backend), `dependency_up{dep=mqtt\|backend}`, `offline_queue_depth` (gateway), `cameras_registered` / `streams_active` (camera). Open unless `METRICS_TOKEN` set. |
| 17–21 | 📋 planned |

**Phase 16 — trace propagation (done):** W3C Trace Context on the MQTT envelope — `@jubasjl76-eng/mqtt-contract@2.3.0` adds optional `traceparent` / `tracestate` + `copyTrace()` ([mqtt#7](https://github.com/jubasjl76-eng/smart-pet-mqtt/pull/7)); the **backend** injects on `publishCommand` + extracts in the engine's `onMessage` (`src/mqtt/trace.ts`, no-op without an active trace) ([#51](https://github.com/jubasjl76-eng/smart-pet-backend/pull/51)); the **edge-gateway** injects on `buildCommand` and the cloud↔local bridge round-trips the field for free ([gateway#9](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/9)); the **device SDK** echoes the command's `traceparent` on its ack ([sdk#8](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/8)). Links a `command → ack/status/event` round trip once Sentry tracing is turned up.

**Phase 16 — structured logging (done):** `src/log.ts` (`pino`) in all 4 Node services — JSON on staging/prod, `pino-pretty` in dev, level from `LOG_LEVEL`, `service` + `version` base, `traceId` / `spanId` via a `traceMixin` when an OTel span is active, `redact` on auth/secrets. Boot path + MQTT surface + error handlers migrated off `console.*` (backend also the engine tick + DB init); the rest moves opportunistically. ([backend#52](https://github.com/jubasjl76-eng/smart-pet-backend/pull/52), [sensors#12](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/12), [camera#11](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/11), [gateway#10](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/10))

**Phase 16 — remaining:** Grafana Cloud dashboards-as-code in `smart-pet-terraform` (needs the account — `OPERATOR-ACTIONS.md` E1); DB-pool tuning + circuit-breaker metrics (with Phase 20's `opossum`); runbooks + status page; cost budgets; Sentry replay/vitals review; finish the `console.*` → `log` sweep in the leaf modules.

**Phase 12 — slice 1 done (2026-09-09):** new repo **`smart-pet-shared`** → `@jubasjl76-eng/shared@0.1.0` (published + `shared-v0.1.0` tag, branch-protected). The typed config contract: `loadConfig(schema)` (parse `process.env` against one zod schema; prints every problem + `process.exit(1)`), `redact()`, env coercion helpers. Git-tag consumable like `mqtt-contract`.

**Phase 12 — done:** (1) `smart-pet-shared` config package. (2) `smart-pet-backend` config contract ([#28](https://github.com/jubasjl76-eng/smart-pet-backend/pull/28), merged). (3) config + `/ready` + graceful shutdown — `pet-iot-sensors-service` [#6](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/6), `pet-iot-edge-gateway` [#6](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/6), `pet-iot-camera-service` [#6](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/6).

**Phase 12 — all slices done:**
- 1 `smart-pet-shared` → `@jubasjl76-eng/shared@0.1.0`.
- 2 backend config contract ([#28](https://github.com/jubasjl76-eng/smart-pet-backend/pull/28)). 2b `/ready` + feature flags + `/api/config` + migration advisory lock ([#29](https://github.com/jubasjl76-eng/smart-pet-backend/pull/29)).
- 3 config + `/ready` + graceful shutdown — sensors [#6](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/6), edge-gateway [#6](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/6), camera [#6](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/6).
- 4 `smart-pet-terraform` `envs/staging` + `modules/cache` + ALB → `/ready` ([#12](https://github.com/jubasjl76-eng/smart-pet-terraform/pull/12); `validate`-only, apply deferred).
- 5a `smart-pet-ci` `deploy-ecs` `environment` input + SOPS+age scaffold ([#8](https://github.com/jubasjl76-eng/smart-pet-ci/pull/8)). 5b four-tier `deploy.yml` + `.env.example` — backend [#30](https://github.com/jubasjl76-eng/smart-pet-backend/pull/30), sensors [#7](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/7). **GitHub Environments** `dev`/`staging`/`prod` created on backend + sensors (`prod` reviewer-gated).
- 6 docs — `smart-pet-docs/ENVIRONMENTS.md`, `smart-pet-device-sdk/docs/firmware-secrets.md` ([#6](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/6)).

**Deferred to the user / later:** set `DEPLOY_ROLE_ARN` + `AWS_REGION` per GitHub Environment after the AWS `bootstrap`→`dev`→`staging`→`prod` apply; Vercel/EAS env-var renames when the website/app are next touched; `src/config.ts` + `src/config/jwt.ts` fold into `config/index.ts` (backend follow-up); leaf `process.env` reads (SEED_*, TTLs, notification keys) migrate to `config.X` opportunistically.

**Phase 11 — done so far:**
- `REPOSITORIES.md` (repo map + boundary contract), `adr/0001-polyrepo-with-contract-packages.md`.
- `smart-pet-mqtt` → **`@jubasjl76-eng/mqtt-contract`** v2.1.1, published to GitHub Packages + tagged `mqtt-contract-v2.1.1` ([#3](https://github.com/jubasjl76-eng/smart-pet-mqtt/pull/3), [#4](https://github.com/jubasjl76-eng/smart-pet-mqtt/pull/4) merged). Consumed as a git-tag dep (`git+https://…#mqtt-contract-v2.1.1`) — GitHub Packages npm needs a token even for public pkgs.
- `smart-pet-ci`: shared Renovate preset `renovate/default.json` ([#3](https://github.com/jubasjl76-eng/smart-pet-ci/pull/3) merged).
- Consumer swaps (vendored copy → dependency): `smart-pet-simulator` ([#2](https://github.com/jubasjl76-eng/smart-pet-simulator/pull/2)), `pet-iot-edge-gateway` ([#3](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/3)) — both also gained a `node-ci` workflow (had none).

- `renovate.json` + `.github/CODEOWNERS` — **merged in all 15 repos** (backend/lib/firmware + `backoffice-dashboard` / `smart-pet-website` / `smart-pet-app`). All hardening-track work is Claude's — no Cursor delegation.
- `smart-pet-ci/scripts/apply-branch-protection.sh` — baseline ruleset for every integration branch — **merged** (smart-pet-ci#5).

**Phase 11 — DONE.**
- **Renovate GitHub App** installed on `jubasjl76-eng`, "All repositories" access (2026-09-09). First dependency PRs land within ~1h of install.
- **Branch protection** applied to **all 14/14** integration branches via `apply-branch-protection.sh` (PR required, `ci / ci` on node repos, `fmt` on terraform, no force-push/delete, `enforce_admins: false`). `smart-pet-website` + `smart-pet-simulator` were made public to enable it. All 15 repos now public.

`smart-pet-backend` / `pet-iot-camera-service` / `pet-iot-sensors-service` adopt the v2 contract in **Phase 14** (no vendored copy — backend has an older feeder-locked `src/mqtt/contract.ts`; camera/sensors hand-roll topic strings).

Implementation status for every feature in
[`SMART-PET-PRODUCT.md`](SMART-PET-PRODUCT.md). This file tracks *what's built*;
the product doc describes *what it is*; [`SMART-PET-DEV-PLAN.md`](SMART-PET-DEV-PLAN.md)
sequences the rest.

Status legend:

| Mark | Meaning |
|---|---|
| ✅ | **Merged** to `development` (services) or `main` (new repos) — typechecked + unit-tested |
| 🔨 | Partial — foundation merged, needs a follow-up to work end-to-end |
| 📋 | Approved & specified, not started |
| ❌ | Rejected / out of scope (see product doc §6) |

**Landed so far:** early slices + **Phases 1, 2, 3 (A+B), 4, 5, 6 (backend), 7 (backend), 8 (backend), 9 slices 1+2 (fleet + rollout #19, GPS geofencing #20)** merged to `development`. In flight: Phase 3 C (i18n) + Phase 6 calendar view + Phase 7/8 consoles on Cursor; **Phase 9.3** SDK PlatformIO CI open (`smart-pet-device-sdk` [#1](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/1)); 9.4 firmware ports need a board. See the delivery log in §4 for the phase → PR map.

---

## 1. Repository build state

| Repo | Role | State |
|---|---|---|
| [smart-pet-backend](../smart-pet-backend) | Unified API + breeder platform | ✅ Phases 1–3 merged to `development` (PRs #6–#9). **Claude's repo** for Phases 4–8. |
| [smart-pet-mqtt](../smart-pet-mqtt) | Protocol contract v2 + TS client | ✅ merged — `development` @ `c22b39f` |
| [smart-pet-device-sdk](../smart-pet-device-sdk) | Shared ESP32 firmware base | ✅ repo live (private) — `main` @ `9ed1199`. Freestanding core host-tested; Arduino layer not yet flash-built |
| [smart-pet-simulator](../smart-pet-simulator) | Virtual kennel / QA harness | ✅ repo live (private) — `main` @ `48155da` |
| [pet-iot-edge-gateway](../pet-iot-edge-gateway) | Pet Hub | ✅ merged — `development` @ `631f0b3` |
| [pet-iot-camera-service](../pet-iot-camera-service) | Camera + two-way audio | ✅ merged — `development` @ `d01f9f9` (+ baseline repair) |
| [smart-feeder](../smart-feeder) | Feeder device | ⏸ SDK port not started — `development` already has a bespoke MQTT firmware; needs a reconciliation PR (`MIGRATION.md` in the SDK) |
| [smart-water-dispenser](../smart-water-dispenser) | Water device | 📋 `WaterModule` ready in the SDK; firmware not ported |
| [gps-dog-collar](../gps-dog-collar) | GPS collar | 📋 needs `dogs/…` → `kennel/…/gps/…` topic migration + SDK port |
| [pet-iot-sensors-service](../pet-iot-sensors-service) | Sensor ingest + alerts | 📋 scaffold — unchanged (has known dep + route-order bugs) |
| [backoffice-dashboard](../backoffice-dashboard) | Staff / breeder web console | ✅ Phase 2 + Phase 3 A7 merged (PRs #1–#3). **Cursor's repo** for the per-feature screens in Phases 4–9. |
| [smart-pet-website](../smart-pet-website) | Public marketing / puppy-sales site | ✅ Phase 3 A + B merged (PRs #1–#5). 🚧 **Cursor** finishing C (i18n: `pt` default, `/en`). English console; bilingual public site only. |
| [smart-pet-app](../smart-pet-app) | Owner mobile app | ⏸ deferred by request |
| [smart-pet-terraform](../smart-pet-terraform) | AWS infra | 📋 single toy `main.tf` — full rebuild is Phase 10 of the dev plan |
| [smart-pet-ci](../smart-pet-ci) | Shared reusable GitHub Actions workflows | ✅ repo live (private) — `main`. `node` / `pio` / `terraform` reusable workflows + per-repo caller stubs. **One-time:** `git mv workflows .github/workflows` (needs `workflow` scope) + enable private-repo Actions access. Wiring per repo pending. |

### Merged PRs (all into `development`)

| Repo | PR | Merged | Title | Checks |
|---|---|---|---|---|
| smart-pet-backend | [#6](https://github.com/jubasjl76-eng/smart-pet-backend/pull/6) | 2026-09-08 | Breeder platform (Slice 1) + MQTT-contract baseline repair | `tsc` clean · 83 tests · 37 files, +4338 −270 |
| smart-pet-mqtt | [#1](https://github.com/jubasjl76-eng/smart-pet-mqtt/pull/1) | 2026-09-08 | MQTT protocol v2: topic scheme, typed payloads, CommandRouter | `tsc` clean · 19 tests · 13 files |
| pet-iot-edge-gateway | [#1](https://github.com/jubasjl76-eng/pet-iot-edge-gateway/pull/1) | 2026-09-08 | Pet Hub: local HTTP API, offline schedule runner, v2 topics, cloud bridge | `tsc` clean · 12 tests |
| pet-iot-camera-service | [#1](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/1) | 2026-09-08 | Two-way audio: WebRTC signalling relay + baseline repair | `tsc` clean (was 19 errors) · 6 tests |

New repos (`smart-pet-device-sdk`, `smart-pet-simulator`) were created private and pushed to `main`.

### Open PRs (Phase 1–2, awaiting merge)

| Repo | PR | Title | Checks |
|---|---|---|---|
| smart-pet-backend | [#7](https://github.com/jubasjl76-eng/smart-pet-backend/pull/7) | Phase 1 — auth + refresh tokens, kennel setup wizard, device pairing, local stack | `tsc` clean · 107 tests |
| smart-pet-backend | [#8](https://github.com/jubasjl76-eng/smart-pet-backend/pull/8) | Phase 2 (backend) — SSE stream for the breeder console | `tsc` clean · 107 tests · stacked on #7 |
| backoffice-dashboard | [#1](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/1) | Dockerfile + nginx for the local compose stack | `vite build` clean |
| backoffice-dashboard | [#2](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/2) | Phase 2 — breeder web console | `build` + `lint` clean · stacked on #1 |

---

## 2. Feature implementation status

Keyed to the product doc's catalogue (§4).

### Devices & firmware

| Feature | Status | Notes |
|---|:--:|---|
| Unified firmware base (device SDK) | ✅ | `smart-pet-device-sdk`. Freestanding core (topics / schedule / backoff / offline-journal) host-tested — 53 assertions, `-Wall -Wextra -Wpedantic` clean. Arduino layer (WiFi provisioning, NTP, MQTT+LWT, OTA, orchestrator) written to ESP32/PubSubClient/ArduinoJson-v7 convention, **not yet compiled on a toolchain** — open items in `MIGRATION.md`. |
| On-device schedule cache | ✅ | SDK `spd_schedule.h` + `spd_device.h`, persisted to NVS. |
| On-device offline journal | ✅ | SDK `spd_offline_journal.h`, serialised to NVS, replayed as an `offline_recovered` event. |
| Feeder module | ✅ | SDK `modules/FeederModule.h` + example sketch. |
| Water module | ✅ | SDK `modules/WaterModule.h`. |
| Smart pen / run door | ✅ | SDK `modules/DoorModule.h` (servo latch / maglock, reed, fail-safe, audit) + example; backend consumes `door` commands + rules. |
| Smart scale bowl / weight station | ✅ | SDK `modules/ScaleModule.h` (HX711) + example; backend `weight_readings`. |
| Multi-dog identification (BLE) | ✅ | SDK `modules/PresenceScanner.h` publishes `…/presence`; backend attributes intake + raises `wrong-pen`. |
| Environment sensor module | ✅ | SDK `modules/EnvSensorModule.h`. |
| Firmware OTA + fleet management | 🔨 | OTA hook + `ota` command in the SDK; signing, staged rollout, A/B partitions, device CI matrix still to add — DEV-PLAN Phase 9. |
| Two-way audio hardware (ESP32 mic/speaker) | 🔨 | Signalling relay is merged (below); the device-side audio path is not — DEV-PLAN Phase 9. |
| Treat-toss / play module | ❌ | Proposed, not approved — backlog. |

### Connectivity & Pet Hub

| Feature | Status | Notes |
|---|:--:|---|
| Pet Hub | ✅ | `pet-iot-edge-gateway` merged. |
| Local device API (`:3004`) | ✅ | `src/http/` — health (fixes the Docker healthcheck + a README that documented endpoints that never existed), status, devices, events, schedules CRUD, commands. Node `http`, no new dependency. |
| Offline schedule runner | ✅ | `src/schedules/` — fires feed/dispense on the LAN clock; 5-min window + 30-min de-dup; `schedule-core.ts` pure + unit-tested. |
| LAN command queue | ✅ | `local_commands` SQLite table + runner; delivered over MQTT, resolved on the device ack. |
| Cloud MQTT bridge | ✅ | `src/bridge/` — mirrors `kennel/{id}/#` ↔ a cloud broker, loop-safe; optional via `CLOUD_MQTT_URL`. |
| Canonical v2 topics on the hub | ✅ | `src/protocol.ts` (vendored subset); legacy `…/heartbeat` still tolerated during migration. |
| Offline / power-cut behaviour | ✅ software | SDK journal + hub `offline_journal` table + endpoint. Battery-backup accessory (hardware) is backlog. |

### Breeding-kennel operations

| Feature | Status | Notes |
|---|:--:|---|
| Per-dog Care Plan | ✅ | backend `care_plans`; `PUT /api/breeder/animals/:id/care-plan`. |
| Animals & pens | ✅ | `animals` / `pens` routes with occupancy + move. |
| Litter & whelping records | ✅ | `litters` routes; `POST /litters/:id/whelp`. |
| Puppies | ✅ | `litters/:id/puppies` with growth assessment + daily gain. |
| Buyer & waitlist management | ✅ | `litters/buyers*` — rank, deposits, puppy↔buyer match. |
| Public puppy-sales website | 📋 | New repo `smart-pet-website` (Next.js/Vercel, scroll-driven). Auto-fed from published dashboard rows via a small `/api/public/*` read-only API; "Reserve this puppy" + waitlist create a `buyers` row + care-inbox item. **Portuguese (default) + English.** DEV-PLAN Phase 3 (C1–C4 after A9). |
| Puppy buyer "update pack" | 🔨 | `GET …/litters/puppies/:pupId/update-pack` returns the data; photo attach + scheduled send is DEV-PLAN Phase 5. |
| Medication log | ✅ | `medications` routes + `logic/medications.ts` — staff register administration; due-list; compliance; missed-dose sweep → care inbox. |
| Automated play / enrichment scheduling | ✅ | `ops/enrichment*` + `logic/enrichment.ts` — round-robin rotation + activity minutes. |
| Multi-site / franchise view | ❌ | Proposed, not approved — backlog. |
| Digital check-in / booking | ❌ | Boarding concepts — replaced by litters + buyers (product doc §5). |

### Health & wellbeing

| Feature | Status | Notes |
|---|:--:|---|
| Weight & growth curves | ✅ | `logic/growth.ts` (Gompertz expected curve, deviation flags, daily-gain, weight-loss, adult trend); `POST /animals/:id/weights`, `GET /animals/:id/growth`. Puppies + adults, both products. |
| Attributed intake & wrong-dog detection | ✅ | `POST /animals/intake` + `intake_events`; mismatch → `wrong-pen` critical exception. |
| Activity & wellness insights | ✅ | `logic/wellness.ts`; `GET /animals/:id/wellness` — non-diagnostic trend observations. |
| Camera AI — dog-centric clips + bark detection | ❌ | Proposed, not approved — backlog. |

### Safety & access

| Feature | Status | Notes |
|---|:--:|---|
| Emergency mode | ✅ | `ops/emergency/{trigger,end,status,manifest}` + `emergency_events` — unlocks pen doors over MQTT, evac manifest, priority-100 exception, `drill` mode. |
| Pen door access control | ✅ | SDK `DoorModule` + backend `door` commands + rules; audit reason on every actuation. |
| Predictive maintenance | ✅ | `logic/maintenance.ts` + `device_health_counters` + engine; `ops/maintenance*`; raises `maintenance-due` before failure; "serviced" resets. |
| GPS geofencing & safe zones | 📋 | Collar publishes location; safe-zone CRUD + enter/exit detection + escape alert not built — DEV-PLAN Phase 9 (collar consumer). Map/UI is deferred with the app. |

### Owner app (B2C)

| Feature | Status | Notes |
|---|:--:|---|
| Two-way audio — talk to your dog | 🔨 | `pet-iot-camera-service` merged — `AudioRelay` + `/api/cameras/:id/audio/*` (session / signal / poll / talk / play), TTL-expiring sessions. **App UI + ESP32 audio path not built** (DEV-PLAN Phase 9 for the device; app UI deferred). |
| Feed Now + schedules · water monitoring · live camera · home environment · notifications | ⏸ | Deferred with the app. Backend endpoints exist. |
| Household sharing · vet/sitter share links · bridge-to-a-kennel | ❌ | Proposed, not approved — backlog. |
| Accessibility & low-connectivity mode | 🔨 | Console (PR #2): focus-visible rings, `motion-reduce`, `role`/`aria` on controls + dialog. Full keyboard/contrast audit + app pass still pending. |
| Away Mode · feeding interlocks | ❌ | Rejected (product doc §6). |

### Automation & intelligence

| Feature | Status | Notes |
|---|:--:|---|
| Rules / automation engine | ✅ | `logic/rules.ts` + `engine/rulesEngine.ts` + `rules` routes — 7 trigger types, 8 condition ops, 4 action types, per-rule cooldown, dry-run, firing history. |
| Preset rules | ✅ | `POST /api/breeder/rules/install-presets` — 7 parameterised starters. |
| Engine loop | ✅ | `engine/index.ts` — MQTT subscriber (`kennel/+/+/+/+`) + 60-sec sweep (escalations, notification drain, consumable sweep, missed-med sweep, offline detection). |

### Notifications & alerting

| Feature | Status | Notes |
|---|:--:|---|
| Care inbox / exception queue | ✅ | `exceptions` service + `inbox` routes — live priority re-rank, acknowledge / snooze / resolve / escalate / assign / reopen, dedup, suggested action, per-item notification history. |
| Notification service | 🔨 | `notifications` + `notification_prefs` + `engine/notifier.ts` — quiet hours + escalation chains merged; `log` + `webhook` channels real; `sms` / `email` / `push` / `siren` are **adapter stubs** pending providers — DEV-PLAN Phase 4. |
| Dedicated alerting service (own component) | 🔨 | Core logic is in the notifier; provider integrations + delivery receipts are DEV-PLAN Phase 4. Splitting it into its own deployable is optional. |

### Supplies

| Feature | Status | Notes |
|---|:--:|---|
| Consumables low-stock warning | ✅ | `logic/consumables.ts` + `consumables` routes + engine sweep — on-hand vs threshold, run-out projection from real dispensed intake, warning only. |
| Consumables auto-reorder | ❌ | Rejected (product doc §6). |
| Tiered bundles + subscription | ❌ | Open business question (product doc §6) — not a build item. |

### Platform

| Feature | Status | Notes |
|---|:--:|---|
| Canonical MQTT contract v2 | ✅ | `smart-pet-mqtt` merged — 8 device types, typed payloads for every leaf (incl. `presence`, `audio`), `CommandRouter` (message → typed handler → auto `ack`). C++ mirror in the SDK; vendored subsets in the hub + simulator. |
| Virtual-kennel simulator | ✅ | `smart-pet-simulator` — feeder/water/door/sensor/gps/scale state machines + 6 scenarios (`happy-path`, `feeder-jam`, `offline-device`, `temp-spike`, `low-battery`, `wrong-dog`) + Docker (Mosquitto + sim). 15 tests. **Not yet wired into any repo's CI.** |
| Data & analytics warehouse | ❌ | Proposed, not approved — backlog. |
| Privacy & data-governance model | 🚧 | Backend built (access log #16, retention + GDPR #17). Draft `PRIVACY-POLICY.md` in docs — needs solicitor review. |
| Cloud infrastructure (Terraform) | 📋 | Approved. Current `smart-pet-terraform` is a single toy `main.tf` (open SG, EC2-only, no RDS/broker, API key in user-data). Full rebuild is DEV-PLAN Phase 10. |
| CI/CD | 📋 | No pipelines yet. DEV-PLAN §3. |

---

## 3. Baseline repairs merged with this work

The branches were cut from `origin/development`; some didn't compile. These fixes
were prerequisites, not features — now on `development`.

**smart-pet-backend** (PR #6, commit `12edcc9`)
- `mqtt/contract.ts` — added the exports (`parseStatusPayload`, `isDeviceOnline`, `deriveIsFoodLow`, `lastFeedToMs`, `isForbiddenTopic`, `buildLwtPayload`, `buildScheduleSet`) that `statusIngest.ts` / `feedNow.ts` and their tests already imported
- `feederMqtt.ts` — added the `FeederBus` test seam (`createMemoryBus` / `notifyStatus` / `setFeederBus`), kept the live path
- `deviceAuth.ts` — `parseDeviceBasic` splits on the last colon (device usernames are `device:<id>`)
- `authController.ts` — `register` inserts then reads back; never mints `staff`
- dropped stale `@types/express-validator@2`; excluded dead Mongoose models + an unused `app.ts` from the build

**pet-iot-camera-service** (PR #1)
- `@types/fluent-ffmpeg` `^2.1.29` → `^2.1.27` (2.1.29 doesn't exist on npm — this broke `npm install` entirely)
- `health/index.ts` — `import '../services/backendClient.ts'` → `.js`
- `services/backendClient.ts` — `import { AxiosInstance }` (the `axios` namespace was unresolved)
- `api/index.ts` — coerce `req.params.*` (Express 5 `@types` type them `string | string[]`)

**pet-iot-edge-gateway** (PR #1)
- `storage/index.ts` — replaced `require('fs')` (undefined in ESM) with an import

---

## 4. What's left (committed)

**Product first, running locally (`docker compose`); deploy last.** Full sequence
in [`SMART-PET-DEV-PLAN.md`](SMART-PET-DEV-PLAN.md). Summary:

| Phase | Scope | Cloud? |
|---|---|---|
| **1** | ✅ **merged** — auth + owner/staff roles; `kennels` row; setup wizard; device claiming/pairing; docker-compose + migration runner (backend #7, dashboard image #1) | no |
| **2** | ✅ **merged** — `backoffice-dashboard` wired to `/api/breeder/*` (care inbox, care plans, pens, litters, buyers, meds, rules, ops); SSE live updates (dashboard #2, backend SSE #8) | no |
| **3** | ✅ **A + B merged** — `smart-pet-website` (Next.js/Vercel, scroll-driven, auto-fed from published rows); `/api/public/*` + `published`/`photos[]` + dashboard "Website" screen (website #1–#5, backend #9, dashboard #3). 🚧 **C (i18n, Cursor):** `pt` default + `/en`. | Vercel only |
| **4** | ✅ **merged** — notification channels (email/SMS/siren) + retry/backoff + prefs screen. **backend #10, dashboard #4** | no |
| **5** | ✅ **merged** — vaccination & worming records + buyer messaging + weekly update pack + go-home pack. **backend #11 + #12, dashboard #5** | no |
| **6** | ✅ **backend merged (#13)** — heat cycles, mating detail + progesterone, `/calendar` feed, season/whelping reminders. 🚧 Cursor: calendar view | no |
| **7** | ✅ **backend merged (#14) + slice 2 open (#15)** — storage interface + uploads + pedigree; generated sale docs (contract / deposit receipt / health guarantee / microchip hand-off) from editable templates; go-home pack `documents[]`. 🚧 Cursor: documents panel + pedigree view + generate/template UI (not started). | no |
| **8** | 🚧 Privacy — **slice 1 merged (#16):** `access_log` + `logAccess()` + `GET /privacy/access-log`. **slice 2 backend open (#17):** `retention_settings` + `retentionSweep`, `GET /privacy/export`, `POST /privacy/delete` (erasure w/ 409 guards). Draft `PRIVACY-POLICY.md` in docs. **Cursor:** data & privacy admin screen (not started). | no |
| **9** | 🚧 Real devices. **slices 1+2 merged (#19, #20):** fleet + rollout controller; GPS geofencing (`/api/breeder/geo`). **9.3 open** (`smart-pet-device-sdk` #1): GitHub Actions matrix (`pio run -e feeder\|door\|scale` + native tests), ESP32Servo dep, per-env `build_src_filter` fix, BLE core-3.x shim — CI file parked at `ci/github-ci.yml` (token lacks `workflow` scope). **9.4** (firmware ports + two-way audio) needs a board. **Cursor:** fleet / firmware + map screen. | no |
| **10** | Deploy — `smart-pet-terraform` rebuild, EMQX/RDS/ECS/CDN, CI/CD (reuse `smart-pet-ci` workflows); sensors + camera to prod. **Claude:** all of it. **Cursor:** idle / website polish. | **yes** |

### Delivery log

Each phase splits into Claude's backend PR(s) + Cursor's dashboard PR. Large
phases ship as two smaller backend PRs ("slices"). Every backend feature carries
a `smart-pet-backend/docs/<feature>.md` contract that Cursor builds against.

| Phase | Backend PRs | Dashboard PR | Contract doc |
|---|---|---|---|
| 4 Notifications | [#10](https://github.com/jubasjl76-eng/smart-pet-backend/pull/10) | [#4](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/4) | `docs/notifications.md` |
| 5 Vaccination | [#11](https://github.com/jubasjl76-eng/smart-pet-backend/pull/11) | [#5](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/5) | `docs/phase5-vaccinations.md` |
| 5 Buyer loop | [#12](https://github.com/jubasjl76-eng/smart-pet-backend/pull/12) | (in #5) | `docs/phase5-buyer-comms.md` |
| 6 Breeding calendar | [#13](https://github.com/jubasjl76-eng/smart-pet-backend/pull/13) | pending | `docs/phase6-breeding.md` |
| 7 Documents (slice 1) | [#14](https://github.com/jubasjl76-eng/smart-pet-backend/pull/14) ✅ | pending | `docs/phase7-documents.md` |
| 7 Documents (slice 2) | [#15](https://github.com/jubasjl76-eng/smart-pet-backend/pull/15) ✅ | pending | `docs/phase7-documents.md` |
| 8 Access log (slice 1) | [#16](https://github.com/jubasjl76-eng/smart-pet-backend/pull/16) ✅ | pending | `docs/phase8-privacy.md` |
| 8 Retention + GDPR (slice 2) | [#17](https://github.com/jubasjl76-eng/smart-pet-backend/pull/17) ✅ | pending | `docs/phase8-privacy.md` |
| 9 Fleet + rollout (slice 1) | [#19](https://github.com/jubasjl76-eng/smart-pet-backend/pull/19) ✅ | pending | `docs/phase9-fleet.md` |
| 9 GPS geofencing (slice 2) | [#20](https://github.com/jubasjl76-eng/smart-pet-backend/pull/20) ✅ | pending | `docs/phase9-geofencing.md` |
| 9.3 SDK PlatformIO CI | sdk [#1](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/1) | n/a | `MIGRATION.md` (in sdk repo) |

**Agent split (from Phase 3's collision):** Claude owns `smart-pet-backend` (+ firmware, terraform); Cursor owns `backoffice-dashboard` (+ finishing `smart-pet-website` i18n). One repo per agent, separate checkouts/worktrees, backend PR merges before the dashboard PR that consumes it. Full table: `SMART-PET-DEV-PLAN.md` §2a.

All four breeder-workflow additions are **in** (per your call): vaccination records → Phase 5, breeding calendar → Phase 6, pedigree + contracts → Phase 7.

Local demo of the whole breeder product: end of Phase 7. Real kennel on the LAN:
+ Phase 8 + Phase 9 (one device). Multi-kennel / cloud: Phase 10.

**Deferred:** `smart-pet-app` (Expo) — connected later; no Expo work needed now. Backend kept app-ready.

### Backlog — proposed, never approved (do **not** build without a decision)

These came from the vision-doc idea backlog and were **not selected**:

- Camera AI — dog-centric clips + bark/whine detection
- Cross-product Care Plan handoff (home ↔ kennel "bridge")
- Vet / sitter time-boxed share links
- Household sharing (invite + scoped membership)
- Multi-site / franchise (`org` layer above kennel)
- Analytics / data warehouse
- Treat-toss / play module
- Tiered hardware bundles + subscription billing *(open business question)*
- Consumables auto-reorder partner *(explicitly rejected — warn only)*
- Battery-backup accessory *(hardware effort)*
- AWS IoT Core migration *(not needed; EMQX serves the contract)*
