# Smart Pet — Repository Map & Boundary Contract

**Date:** 2026-09-09 · **Owner:** jubasjl76-eng · Authoritative for repo
ownership, branches, release triggers, and cross-repo dependencies. Formalises
`SMART-PET-DEV-PLAN.md` §2a and `SMART-PET-HARDENING-PLAN.md` A7. Changes here
need a PR review.

## Model

**Polyrepo.** ~14 GitHub repos under `github.com/jubasjl76-eng/`. The two-agent
workflow (Claude / Cursor) depends on **physical repo isolation** — one agent
per repo at a time, feature branch → PR to that repo's integration branch. See
ADR-0001 for the monorepo-vs-polyrepo decision.

Shared code is **not** copied between repos. It ships as a versioned
`@jubasjl76-eng/*` package (GitHub Packages, private). Consumers depend on a
semver range; Renovate raises the bump PRs.

> Scope is `@jubasjl76-eng/*` because GitHub Packages requires the npm scope to
> match the owning account. If a `smart-pet` GitHub org is created later, the
> packages rename to `@smart-pet/*` (mechanical find-replace + one republish).

## Repositories

### Node services — integration branch `development`

| Repo | Role | Owner | Release trigger |
|---|---|---|---|
| `smart-pet-backend` | Unified API + breeder platform | Claude | merge `development` → deploy `dev`; `v*-rc.N` → `staging`; `v*` → `prod` (reviewed) |
| `pet-iot-edge-gateway` | Pet Hub — LAN API + cloud MQTT bridge | Claude | same pipeline (edge-deployed in practice) |
| `pet-iot-sensors-service` | Sensor ingest + alert drafting (thin proxy to backend) | Claude | merge `development` → deploy `dev` |
| `pet-iot-camera-service` | Camera + two-way audio | Claude | **edge only** — `v*` tag → GHCR image; not in ECS |
| `backoffice-dashboard` | Staff / breeder web console (React 19 / Vite) | **Cursor** | image on merge `development` → `dev`; served via CloudFront |
| `smart-pet-website` | Public marketing site (Next.js) | **Cursor** | Vercel — PR previews; prod on merge `development` |

### Libraries, infra, firmware — integration branch `main`

| Repo | Role | Owner | Release trigger |
|---|---|---|---|
| `smart-pet-mqtt` → **`@jubasjl76-eng/mqtt-contract`** | MQTT topic/payload contract + TS client + (P14) AsyncAPI | Claude | `package.json` version bump merged to `main` → publish to GitHub Packages |
| `smart-pet-shared` → **`@jubasjl76-eng/shared`** | typed config contract (P12); zod domain schemas + formatters (P14+) | Claude | `package.json` version bump merged to `main` → publish + `shared-v*` tag |
| `smart-pet-api-client` → **`@jubasjl76-eng/api-client`** | generated `openapi-fetch` client from `smart-pet-backend/openapi.json` + retry/backoff wrapper | Claude (CI-regenerated) | `package.json` version bump merged to `main` → publish + `api-client-v*` tag; a daily `regen` PR on spec drift |
| `smart-pet-device-sdk` | ESP32 firmware base (C++17 headers + Arduino layer) | Claude | consumed by firmware repos via a `#<commit>` pin; `v*` tag |
| `smart-pet-ci` | Reusable GitHub Actions workflows | Claude | consumed `@main`; changes land on `main` |
| `smart-pet-terraform` | AWS infra (module + `envs/{dev,staging,prod}`) | Claude | merge `main` → `tf apply` dev; staging/prod gated |
| `smart-pet-simulator` | Virtual kennel / QA harness + web control panel | Claude | `v*` tag; a first-class local-dev + CI test dependency |
| `smart-pet-dev` | One-command local dev: `Taskfile` + `compose.yaml` for the whole stack | Claude | none (dev tooling); cloned next to the product repos |
| `smart-feeder` · `smart-water-dispenser` · `gps-dog-collar` | Device firmware (on the SDK) | Claude | `v*` tag → signed `.bin` + staged fleet rollout |
| `smart-pet-app` | Owner mobile app (Expo / RN) — **deferred** | Cursor | EAS Build / EAS Update when de-deferred |

### Not a git repo

| Path | Role |
|---|---|
| `smart-pet-docs/` | Plans, ADRs, runbooks, this file. Plain folder — edits saved to disk, **no git**. |

## Rules

1. **One agent per repo at a time.** Feature branch → PR to the integration
   branch. Never two agents in one working tree (the Phase 3 failure mode).
   The **owner** column is for **product-feature** work. The
   **hardening track (Phases 11–21) is entirely Claude's, in every repo**
   including the Cursor-owned ones; when a hardening PR is open against a
   Cursor repo, Cursor pauses product work there until it merges.
2. **Contract PR merges first.** A change to `@jubasjl76-eng/mqtt-contract` (or, from
   P14, the OpenAPI spec) merges and publishes **before** the consumer PR that
   bumps to the new version. Consumers never vendor a copy to get ahead.
3. **Every backend feature ships a `docs/<feature>.md` contract** in the same PR
   — the handoff Cursor reads before building the matching screen.
4. **The staff console stays English.** Only `smart-pet-website` is bilingual
   (`pt` default, `/en`).
5. **CODEOWNERS per repo** encodes the owner column above; branch protection
   requires the CI checks + one review.
6. **Renovate** manages dependency bumps: `@jubasjl76-eng/*` grouped + automerged on
   green CI; external deps pinned, grouped, manual review.
7. **Commit trailer** `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`;
   **PR body trailer** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Dependency graph (build-time)

```
@jubasjl76-eng/mqtt-contract ──┬─▶ smart-pet-backend
                           ├─▶ pet-iot-edge-gateway
                           ├─▶ pet-iot-sensors-service
                           ├─▶ pet-iot-camera-service
                           ├─▶ smart-pet-simulator
                           └─▶ (C++ codegen) smart-pet-device-sdk

@jubasjl76-eng/shared ─────────┬─▶ all Node services (config contract)
                           ├─▶ backoffice-dashboard
                           └─▶ smart-pet-website

@jubasjl76-eng/api-client ─────┬─▶ backoffice-dashboard
(gen from backend OpenAPI)  └─▶ smart-pet-app

smart-pet-device-sdk ──────┬─▶ smart-feeder
(#<commit> pin)             ├─▶ smart-water-dispenser
                           └─▶ gps-dog-collar

smart-pet-ci (@main) ──────▶ every repo's .github/workflows
```
