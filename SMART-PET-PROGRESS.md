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
| 17 — Test infrastructure | ✅ done — **Playwright E2E** (dashboard, website) on a shared `smart-pet-ci/playwright-ci.yml` reusable; **backend API conformance** ([#53](https://github.com/jubasjl76-eng/smart-pet-backend/pull/53) — `buildApp()` extracted; every OpenAPI op proven mounted + `secure` ops reject unauth, 170 checks); **firmware GoogleTest** + ASan/UBSan + `src/` line coverage; **app** jest + Maestro flows. Maestro-in-CI deferred by choice (Android emulator + EAS build — heavy, no clear payoff yet). |
| 18 — Security audit & scanning | 🔨 in progress — shared **`smart-pet-ci/security-scan.yml`** reusable ([ci#18](https://github.com/jubasjl76-eng/smart-pet-ci/pull/18)–[#21](https://github.com/jubasjl76-eng/smart-pet-ci/pull/21)): gitleaks (secrets, full history — hard fail), Semgrep + Trivy fs/config → the repo Security tab, `npm audit --omit=dev` — all report-only until `strict: true`. Scanners run from pinned Docker images. **Rolled out to all 17 repos** — `security.yml` on push / PR / weekly Monday cron; every integration branch green (no secrets found; npm-audit advisories in the dashboard + app queued for a remediation slice). |
| 19 — Firmware hardening & HIL | 🔨 in progress — SDK: **time trust** (sdk#15), **brown-out resilience** (sdk#16), **fleet kill switch** (sdk#17 + backend#62 + dashboard#25), **memory guards** (sdk#18), **size gate** (ci#32 + sdk#19), **OTA hash verify** (sdk#20 + backend#63), **fleet observability** (backend#64 + dashboard#26), **firmware repos pio-ci rollout** (smart-feeder#9, smart-water-dispenser#7, gps-dog-collar#8, ci#33). Remaining: EMQX ACL (operator), Secure Boot/HIL/OTA pipeline (hardware). |
| 20 — Traffic control, caching & resilience | 🔨 in progress — **Redis wired live** (backend#65, sensors#17, terraform#17), **rate-limit stack** (backend#66), **leader lock** (backend#67), **idempotency store** (backend#68), **SSE fan-out** (backend#69), **circuit breakers** (backend#70), **job queue + outbox** (backend#71), **table partitioning** (backend#72), **feature-flag mechanism** (backend#73, dashboard#27). |
| 21 | 📋 planned |

**Phase 17 — firmware (done):** `smart-pet-device-sdk` host tests migrated from the custom `CHECK` macro to **GoogleTest** — `test_topics` / `test_schedule` (fixtures) / `test_backoff` / `test_offline_journal` / `test_ulaw` + a new **`test_contract.cpp`** (golden topic scheme + QoS/retain policy from MQTT v2). New **`[env:native-san]`** runs the suite under ASan + UBSan. `smart-pet-ci/pio-ci.yml` `native` job now sets up PlatformIO + gcovr. ([sdk#9](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/9), [ci#15](https://github.com/jubasjl76-eng/smart-pet-ci/pull/15)) Follow-up: **`[env:native-cov]`** re-added — `test/pio_coverage.py` appends `--coverage` to `LINKFLAGS` (PlatformIO doesn't propagate it to the test-binary link) — CI reports 98.9% of `src/`. **`.wokwi/`** feeder board + boot scenario (SoftAP serial line) wired via the new `wokwi-env` input, dormant until `WOKWI_CLI_TOKEN`. ([sdk#10](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/10), [ci#17](https://github.com/jubasjl76-eng/smart-pet-ci/pull/17))

**Phase 17 — app (done):** `smart-pet-app` had no tests. Added `jest-expo@55` + jest 30 + `@testing-library/react-native@13.3` + `react-test-renderer@19.2` (RNTL 14 doesn't render under RN 0.83 yet); `jest.setup.ts` mocks secure-store / async-storage / Sentry. Tests: the owner-JWT **session state machine** (`src/lib/__tests__/session.test.ts`) + a **`<Button>`** RNTL render test. `.github/workflows/test.yml` runs typecheck + jest on every PR. **Maestro** flows authored under `.maestro/` (launch, tab-nav, settings-login) with a run-locally README — CI wiring needs an emulator + EAS (`OPERATOR-ACTIONS.md`). ([app#5](https://github.com/jubasjl76-eng/smart-pet-app/pull/5))

**Phase 17 — web CI plumbing (done):** the dashboard + website `e2e.yml`s now both `uses:` a shared `smart-pet-ci/.github/workflows/playwright-ci.yml` reusable (runner + browser install + report upload; the caller's `test:e2e` + `playwright.config` own webServer / API mocking). ([ci#16](https://github.com/jubasjl76-eng/smart-pet-ci/pull/16), [dashboard#18](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/18), [website#11](https://github.com/jubasjl76-eng/smart-pet-website/pull/11))

**Phase 17 — remaining:** only **Maestro-in-CI** — deferred by choice (needs an Android emulator + an EAS build in CI; heavy and flaky for little signal today; the flows run locally per `.maestro/README.md`). The Wokwi job is in place but stays dormant until the operator adds the free `WOKWI_CLI_TOKEN` (`OPERATOR-ACTIONS.md` G4).

---

**Phase 19 — time trust (done):** `smart-pet-device-sdk` ([sdk#15](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/15), A12 #16). New freestanding **`spd_time_util.h`** (`plausibleEpoch`, `driftSeconds`, `shouldRestoreClock` — native-tested in `test_time.cpp`). `TimeSync.restoreLastKnown()` seeds the RTC on boot from a **last-known-good epoch persisted to NVS every 15 min**, so timestamps aren't 1970 and first-sync offset is measurable. `timeTrusted()` (NTP landed *this session*) gates `tickSchedule()` — a schedule never fires on an unsynced clock; `timeUsable()` (any plausible clock) decides whether a journal entry gets a real timestamp or `0`. After the first sync, the restored-clock offset (persisted free-running estimate − real time) is reported once as **`clockOffsetS`** — a large value flags a device whose timekeeping is unreliable or that was offline a long while (the ESP32 RTC doesn't survive a power cut).

**Phase 19 — brown-out / power-loss resilience (done):** `smart-pet-device-sdk` ([sdk#16](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/16), A12 #15). New freestanding **`spd_config_codec.h`** — CRC-32 + serialize/deserialize a `Config` to one delimited, percent-escaped, CRC-tailed string; `configPlausible()` sanity gate (field lengths, `mqttPort != 0`, known `deviceType`). Native-tested (`test_config_codec.cpp` — round-trip incl. `|`/`%`/`\n` in a Wi-Fi password, CRC-tamper + truncation rejection). **`ConfigStore.save()` now writes one atomic NVS entry** (`cfg`), so a power cut mid-write can't leave a half-updated config; `load()` prefers the blob, falls back to the legacy per-key format (auto-upgraded on next boot via `lastMigrated()`), then to factory defaults (empty → provisioning portal). **`spd_brownout.h`** — a brown-out counter in `RTC_NOINIT` memory (survives the reset), bumped when `esp_reset_reason() == ESP_RST_BROWNOUT`; surfaced as `brownouts` in the status payload (a marginal PSU now looks different from a one-off dip), with `configDefaulted` flagged when the config was unreadable.

**Phase 19 — fleet kill switch (done):** A12 #17, three repos.
- **SDK** ([sdk#17](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/17)): devices subscribe to a retained **`kennel/{k}/_control`** (`{"safeMode":bool,"reason":str}`). In safe mode `tickSchedule()` doesn't fire and app command handlers (feed/dispense/open/…) are rejected with `"safe-mode"` while the safe built-ins (restart/identify/ota/schedule_set/set_interval) still run; `safeMode:true` in status + `safe_mode`/`safe_mode_cleared` events; `safeModeActive()` for the sketch. `controlTopic()` helper (native-tested).
- **backend** ([#62](https://github.com/jubasjl76-eng/smart-pet-backend/pull/62)): `fleet_control` table is the source of truth; `GET /api/breeder/fleet/control`, `POST /halt {reason?}`, `POST /resume`. `publishFleetControl()` writes the retained QoS-1 message; on MQTT (re)connect the backend re-asserts safe-mode for every halted kennel so a broker restart can't drop it. DB write is authoritative, broker publish best-effort (`brokerPublished` in the response). `fleet-control.test.ts`; conformance now 173.
- **dashboard** ([dashboard#25](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/25)): a Kill-switch card on the Fleet page — "Halt fleet" (confirm + optional reason), a red banner with the reason + "Resume fleet" while halted. en/pt.

**Phase 19 — on-device memory guards (done):** `smart-pet-device-sdk` ([sdk#18](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/18)). Freestanding **`spd_health_util.h`** — `heapVerdict(free, largestBlock)` → `ok`/`low`/`critical` (thresholds 24 KB / 12 KB free, 8 KB contiguous block) + `stackLow()`, native-tested (`test_health.cpp`). **`spd_health.h`** — `HealthMonitor` polls `heap_caps` free / min / largest-block + `uxTaskGetStackHighWaterMark`; a **debug build** (`-DSPD_DEBUG` or `CORE_DEBUG_LEVEL ≥ 4`) runs `heap_caps_check_integrity_all()` every 30 s and `abort()`s on corruption so the crash path reports it. `spd_device.h`: polls each loop; status carries `heapFree`/`heapMin`/`stackMin` + a `degraded` flag; a `health` event on each ok↔low↔critical change; **under critical pressure the app's optional `statusFill_` is skipped** — keep reporting, don't risk an OOM. `health()` accessor for sketches.

**Phase 19 — firmware size gate (done):** `smart-pet-ci/pio-ci.yml` gains a **`size-check`** input ([ci#32](https://github.com/jubasjl76-eng/smart-pet-ci/pull/32)) — per env, parse flash/RAM from the build log, diff vs a committed **`firmware-size.json`**, and write a table to the job summary (soft warn at +2 KB flash / +512 B RAM; `size-strict` makes it blocking). Also builds `src/` with **`-fstack-usage`** and **fails** if any project function has a single stack frame over `stack-budget-bytes` (default 2048) — catches an accidental large stack array. Live in the SDK ([sdk#19](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/19)): baseline seeded for feeder/door/scale/audio (`door` is at 93% flash — noted). *(`puncover` is browser-interactive, unsuited to CI — the job-summary table + `-fstack-usage` cover the same ground.)*

**Phase 19 — OTA provenance (done):** the artifact-integrity half. **SDK** ([sdk#20](https://github.com/jubasjl76-eng/smart-pet-device-sdk/pull/20)): `spd_ota.h` streams the download through `mbedtls_sha256` and **refuses the image on a hash mismatch** vs the `sha256` in the `ota` command — the `.bin` comes over plain HTTP from S3/CDN so this is the integrity boundary until Secure Boot. The failure reason (`sha-mismatch` / `http-<code>` / `short-read` / …) rides the `ota` ack. Freestanding `spd_ota_util.h` (`toHexLower`, `sha256HexEqual` — case-insensitive, tolerates `0x`/whitespace), native-tested. **backend** ([#63](https://github.com/jubasjl76-eng/smart-pet-backend/pull/63)): `014_ota_provenance.sql` adds `signing_key_id` + `provenance` (JSONB) to `firmware`; `POST /api/breeder/fleet/firmware` accepts them; the OTA command now carries `signingKeyId` alongside `sha256` + `signature`. **Deferred to Secure Boot:** device-side *signature* verify (needs a baked public key) and the SLSA attestation on the published `.bin` (needs the firmware build+publish pipeline + S3).

**Phase 19 — fleet observability (done):** `GET /api/breeder/fleet/health` ([backend#64](https://github.com/jubasjl76-eng/smart-pet-backend/pull/64)) — firmware version histogram (per device-type, online/total), rollout progress (on-target / behind vs the live target, reusing `deviceTarget`/`deviceFwStatus`), and **crashes-by-version** over a 30-day window (`device-crash` exceptions, fw parsed from `dedup_key`) with a crash-free device count. New **Health tab** on the dashboard Fleet page ([dashboard#26](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/26)): the crash-free %, version bars, rollout progress bars, the crash table, and a per-device-type **"Roll back to &lt;version&gt;"** that starts a 100% rollout of a prior build (reuses `POST /rollouts`). en/pt.

**Phase 19 — firmware repos pio-ci rollout (done):** the 3 ported firmware repos (`smart-feeder` [#9](https://github.com/jubasjl76-eng/smart-feeder/pull/9), `smart-water-dispenser` [#7](https://github.com/jubasjl76-eng/smart-water-dispenser/pull/7), `gps-dog-collar` [#8](https://github.com/jubasjl76-eng/gps-dog-collar/pull/8)) had only static analysis in CI (Phase 18) — no `pio run` ever actually built them. Wiring in `pio-ci.yml` (`size-check` on) surfaced real bugs static analysis never touches:
- **missing forward declarations** from the original `.ino`→`.cpp` port — Arduino IDE auto-generates prototypes for `.ino`, PlatformIO doesn't for a plain `.cpp`. `smart-water-dispenser` needed one for every function in the file; `gps-dog-collar` needed one for `publishLocation()`.
- **`smart-water-dispenser`'s scheduler called dead `hour()`/`minute()`** (TimeLib-style globals) with no such library ever included or seeded — schedules could never have fired even had it compiled. Replaced with ESP32's built-in NTP (`configTime()` once Wi-Fi connects, `getLocalTime()` in `checkSchedule()`) — no new dependency.
- **`smart-feeder` blew the stack budget**: three `StaticJsonDocument<2048>` + a 2048 B `char[]` as plain locals (one function stacked two of these) against an 8 KB ESP32 loop-task stack. Moved to `static` — safe, single-threaded Arduino code, no RTOS tasks or ISRs touch them.
- **a real bug in `pio-ci.yml` itself**: `pio run | tee /tmp/pio.log` had no `set -o pipefail`, so a genuine compile failure was silently reported as a green job — masked the bugs above on the first round of PRs. Fixed with `set -o pipefail` ([ci#33](https://github.com/jubasjl76-eng/smart-pet-ci/pull/33)), which also fixed the stack-budget scanner looking in the wrong build directory whenever `project-dir` isn't `"."`.

All three now build for real on every push, with `firmware-size.json` baselines seeded from the first genuinely green run.

**Phase 19 — remaining.** All doable-now work is done. Prod EMQX ACL must let a device *subscribe* to `kennel/{k}/_control` (outside its `kennel/{k}/{type}/{id}/#` subtree) — noted in `OPERATOR-ACTIONS.md`. **Blocked on hardware / operator:** Secure Boot + Flash Encryption rollout (design doc done, `security/secure-boot-flash-encryption.md` — pending sign-off + a pilot device); the HIL bench (self-hosted runner + one of each device); the firmware `.bin` build/sign/publish pipeline + SLSA attestation (needs S3).

---

**Phase 20 — feature-flag mechanism (done):** the Phase 12 seed (`feature_flags` table + a 30s-cached `GET /api/config` read via `src/services/flags.ts#getFlags()`) had no way to actually set a flag short of touching the DB directly, and no server-side gating helper — neither had been exercised by anything in the codebase. `smart-pet-backend` [#73](https://github.com/jubasjl76-eng/smart-pet-backend/pull/73): `src/breeder/routes/flags.ts` (mounted `/api/breeder/flags`, behind the breeder guard — same as retention/the kill switch) — `GET /` lists every flag, `PUT /:key` creates or toggles one (`key` restricted to lowercase/digits/hyphens, omitting `description` keeps the existing one), `DELETE /:key` removes it; every set/delete invalidates the read cache (visible immediately, not after the 30s TTL) and is logged to the access log. `services/flags.ts` gained `isFlagEnabled(key)` for server-side gating (`false` for an unknown key, never throws). `backoffice-dashboard` [#27](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/27): a new **Flags** tab on the Ops page (alongside Consumables/Maintenance/Emergency, same list-cards-with-an-action pattern) — add/toggle/delete a flag from the console. Nothing in the codebase is gated on a flag yet — this is the mechanism, ready for the next feature that wants a kill switch during its own rollout; `docs/feature-flags.md` explains the deliberate scoping — no percentage/per-kennel targeting, since this deployment is one kennel per instance and a canary at device-fleet granularity is what the OTA rollout mechanism already does; add targeting only if a real use case needs gating *within* one running instance.

**Phase 20 — table partitioning (done):** `smart-pet-backend` [#72](https://github.com/jubasjl76-eng/smart-pet-backend/pull/72) — `access_log` and `exceptions` range-partitioned by month (`015_partition_access_log.sql` / `016_partition_exceptions.sql`): rename the existing table aside, create the partitioned replacement with a composite PK including the partition column (a Postgres requirement), create partitions covering the existing data's range through 2 months ahead plus a `DEFAULT` catch-all, copy the data over, drop the old table — idempotent and safe against an empty table. `access_log`'s `BIGSERIAL` sequence is renamed alongside the table and advanced past whatever got copied so a new row's id can't collide with a copied one. `exceptions` drops `notifications.exception_id`'s foreign key — a FK into a partitioned table must reference a composite key including the partition column, and nothing ever `DELETE`s from `exceptions` today, so the `ON DELETE CASCADE` it carried had never fired; the relationship is now an application-level convention instead of a DB constraint. `src/db/partitions.ts`: `ensureMonthPartition`/`ensureUpcomingPartitions` (create ahead of time) and `dropExpiredMonthPartitions` (drop a whole expired month when it's single-kennel, with an optional `notSafeWhere` SQL fragment for a domain-specific "don't drop this row yet" guard). `retentionSweep()` (`privacy.ts`) tries the fast partition-drop first for `access_log` and (new) `exception`, then runs the same row-level `DELETE` as before for whatever a month-granularity drop can't cover (the partial boundary month, the default partition). Exceptions retention is genuinely new — nothing ever cleaned them up before — and only ever removes `status='resolved'` rows, so a still-open alert can't vanish just because it's old; `'exception'` added to the retention-settings data-class allowlist (opt-in, same as the others). A `pg-boss` monthly cron (`src/jobs/partitionMaintenance.ts`, 1st of the month 03:00 UTC, plus once at boot) keeps both tables' upcoming partitions created ahead of time. **Scoped out:** "readings/telemetry" (the plan's third named table) — no high-volume history table exists in this schema today (GPS is current-state-only columns on `animals`; `weight_readings` is low-frequency/manual); if one is added later it should adopt this same pattern. New `partitions.test.ts` and `partitionMaintenanceJob.test.ts`; `privacy.test.ts` now runs the two new migrations, proving the DO-block DDL (dynamic partition creation, sequence rename/advance, FK drop) actually works against a real Postgres-compatible engine (PGlite), not just typechecks.

**Phase 20 — job queue + outbox (done):** `smart-pet-backend` [#71](https://github.com/jubasjl76-eng/smart-pet-backend/pull/71) — `pg-boss` (Postgres-backed, zero new infra) via `src/jobs/queue.ts`: its own `pgboss` schema, migrated automatically on `start()`, wired into the boot/shutdown chain. Fleet OTA fan-out (`fleetSweep()` in `fleet.ts`) migrated from pushing inline to enqueuing a `fleet-ota-push` job per candidate device, with a worker (`otaPushHandler`) doing the actual publish behind real retry/backoff (`retryLimit: 5`, exponential) and a `fleet-ota-push-dlq` dead-letter queue — instead of "swallow the error, hope next tick catches it". The firmware snapshot is captured in the job payload at enqueue time, so a retry re-sends exactly what was decided even if the live rollout has since moved on; `singletonKey` (kennel+device) stops a second sweep from queuing a duplicate pending push to the same device. The manual `POST /devices/:id/ota` push-now endpoint stays synchronous by design — an operator clicking it expects an immediate result. **Scoped out, with the reasoning written into the docs each touches:** notifications / go-home-pack / weekly buyer emails (`docs/notifications.md`) stayed on the existing `notifications`-table outbox — already transactional-outbox-shaped, drained by the Phase 20 leader lock, and re-deriving that already-working retry logic on `pg-boss` would break the synchronous "run now" contract several ops endpoints rely on, for a mostly architectural win. GDPR export/delete (`docs/phase8-privacy.md`) stayed synchronous — small single-subject operations with nothing to batch — and `retentionSweep` stayed a periodic idempotent bulk `DELETE` with no external call and no retry need. New `jobsQueue.test.ts` runs `pg-boss` for real against an in-process PGlite instance via its native `pglite` backend profile (no external Postgres needed in CI) — proving a sent job reaches its worker, and that a failing job retries then dead-letters.

**Phase 20 — circuit breakers (done):** `smart-pet-backend` [#70](https://github.com/jubasjl76-eng/smart-pet-backend/pull/70) — `src/circuitBreaker.ts`'s `circuitBreaker(name, fn, opts)` wraps `opossum` with sane defaults (10s timeout, 50% error threshold, 30s reset) and self-registers each breaker for `/metrics`. Applied to every outbound call the hardening plan named: **Resend + Twilio** (`channels.ts` — wraps only the `fetch` calls; the existing try/catch → `ChannelResult` conversion handles a breaker-open rejection and a real HTTP failure identically), **MQTT publish** (`feederMqtt.ts` — `publishCommand` and `publishFleetControl` previously each hand-rolled their own `client.publish` Promise wrapper; now share one `mqttPublishBreaker` via `mqtt.js`'s `publishAsync`), and the **website revalidate webhook** (`revalidate.ts` — stays fire-and-forget/never-throws; the breaker just stops it eating a fetch + timeout on every website write once the endpoint is known-dead). No `.fallback()` registered anywhere — an open-circuit rejection looks like a real call failure to each caller, which already had its own degrade path. New `circuit_breaker_state{name}` gauge on `/metrics` (0 closed / 0.5 half-open / 1 open), same `collect()`-callback pattern as the existing `pg_pool_connections` gauge. **S3** was in the plan's list but is scoped out — `getStorage()` only implements a local-disk driver today, nothing to wrap yet.

**Phase 20 — cross-instance SSE fan-out (done):** `smart-pet-backend` [#69](https://github.com/jubasjl76-eng/smart-pet-backend/pull/69) — `src/breeder/stream.ts`'s `emitStream()` (the care-inbox/device-state SSE stream) always emits on its own local `EventEmitter` bus first (unchanged single-instance behavior), and now also `PUBLISH`es to a shared Redis channel when `REDIS_URL` is set. Each instance `SUBSCRIBE`s on a dedicated duplicated Redis connection (ioredis puts a connection into subscriber-only mode once it issues `SUBSCRIBE`, so it can't share the app's main client) and re-emits what other instances published onto its own local bus; each publish carries a random per-process `ORIGIN` id so an instance ignores its own echo instead of double-delivering to its own connected clients. **No dashboard change needed** — `backoffice-dashboard`'s `useStream` already reconnects against the general load-balanced API base rather than a pinned instance, so a client landing on any instance after a reconnect now sees every kennel's events, not just the ones that instance happened to raise locally. New `breeder-stream-fanout.test.ts` mocks a Redis pub/sub pair to prove the self-origin filter and cross-instance delivery; the existing single-instance `breeder-stream.test.ts` (`REDIS_URL` unset) passes unchanged.

**Phase 20 — idempotency store (done):** `smart-pet-backend` [#68](https://github.com/jubasjl76-eng/smart-pet-backend/pull/68) — `src/middleware/idempotency.ts`'s `idempotent()` middleware. Redis-backed (24h TTL) with an in-memory `Map` fallback when `REDIS_URL` is unset; a repeated `Idempotency-Key` on the same route replays the cached response (marked with an `Idempotent-Replayed: true` response header) instead of re-running the handler; no header → pass-through, no-op. Applied to the four routes the hardening plan named that aren't naturally idempotent on their own: **`POST /api/devices/claim`** (regenerates the device's MQTT secret every call — a bare retry would silently rotate credentials a device already saved), **`POST /api/devices/{id}/feed`** (a retry shouldn't double-dispense), **`POST /api/public/inquiries`** (a retry shouldn't create a duplicate buyer row), **`POST /api/breeder/fleet/devices/{id}/ota`** (a retry shouldn't re-offer an in-flight OTA). Closes out the `IdempotencyKey` parameter `src/openapi/index.ts` has documented since Phase 14 but never enforced — same "client already expects it, server needed to catch up" shape the rate-limit stack slice was. `ponytail:` no reservation/lock phase — two requests carrying the same key arriving truly concurrently, before either finishes, can both reach the handler; a narrow race, not the common client-retried-after-timeout case this protects, documented as a known limitation with its upgrade path in the module comment.

**Phase 20 — leader-election lock (done):** `smart-pet-backend` [#67](https://github.com/jubasjl76-eng/smart-pet-backend/pull/67) — `src/leaderLock.ts`'s `withLeaderLock(key, ttlMs, fn)`: Redis `SET key val PX ttl NX`. `REDIS_URL` unconfigured (dev/local, single instance) → always acquires — nothing to coordinate with. Configured → exactly one instance wins per window; the TTL (tick interval minus a 5s margin) expires before the next tick, so leadership re-elects naturally each round with no renewal or explicit release. A Redis error fails open (runs anyway) — a rare double-run is safer than every instance silently skipping every sweep. Wired into the breeder engine's `setInterval` callback wrapping `engineTick()` (notifier drain + consumable/med/vaccination/update-pack/breeding/retention/fleet sweeps + offline detection) — `engineTick()` itself stays lock-free and directly callable (tests still call it directly, unaffected).

**Phase 20 — application rate-limit stack (done):** `smart-pet-backend` [#66](https://github.com/jubasjl76-eng/smart-pet-backend/pull/66) — `src/middleware/rateLimit.ts`, four route-class limiters via `express-rate-limit` + `rate-limit-redis`: **`authLimiter`** (5/min/IP, `/api/auth/*`), **`publicLimiter`** (30/min/IP, `/api/public/*`), **`inquiryLimiter`** (100/hr/IP, layered on top of `publicLimiter` for `POST /api/public/inquiries`), **`breederLimiter`** (600/min per authenticated user, `/api/breeder/*`). Redis-backed via the Redis wiring above — every instance shares one counter — with an in-memory fallback when `REDIS_URL` is unset. The response contract (`429` + `Retry-After` + `RateLimit-Limit`/`-Remaining`/`-Reset` + a `{ error }` JSON body) matches the `RateLimited` component `src/openapi/index.ts` has documented since Phase 14, and what `@jubasjl76-eng/api-client`'s `RateLimitedError` has already expected since then — the client side was done two phases ago, this PR made the server side real. Replaced the hand-rolled in-memory 5/hour/IP limiter on `POST /api/public/inquiries`, which had carried its own `ponytail:` comment predicting exactly this upgrade ("move to Redis if the backend ever runs more than one instance"). `pet-iot-sensors-service` was deliberately scoped out — its HTTP surface is MQTT-ingest + read-only ops routes (`/health`, `/ready`, `/metrics`, `/api/status`), no auth or public-write endpoint to rate-limit.

**Phase 20 — Redis wired live (done):** `modules/cache` (Phase 12, ElastiCache) was already `enabled = true` in staging/prod with `REDIS_URL` reaching the backend's ECS task env, but nothing on the app side ever read it. **`smart-pet-backend`** ([#65](https://github.com/jubasjl76-eng/smart-pet-backend/pull/65)) and **`pet-iot-sensors-service`** ([#17](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/17)) both gain `src/redis.ts`: `REDIS_URL` unset (dev/local — `modules/cache`'s `enabled = false`) → `redis` is `null` and every future consumer (rate limiter, SSE fan-out, leader lock, idempotency store — later Phase 20 slices) falls back to in-process/single-instance behavior; set → a real `ioredis` client (`lazyConnect`, bounded retry). `/ready` now PINGs Redis when configured — `redis` in the response body is `null` when unconfigured (not a failure, never blocks readiness in dev/local) vs `true`/`false` when it is; graceful shutdown closes the connection alongside the DB pool / MQTT client. **`smart-pet-terraform`** ([#17](https://github.com/jubasjl76-eng/smart-pet-terraform/pull/17)) fixes a real gap: sensors-service's security group had been on `module.cache.allowed_security_group_ids` since Phase 12, but its ECS `environment_vars` never actually carried `REDIS_URL` — added to `envs/dev`/`staging`/`prod`. **`pet-iot-edge-gateway`** and **`pet-iot-camera-service`** are deliberately out of scope — they're edge-deployed, not ECS/VPC-connected (`smart-pet-terraform`'s `modules.json` only lists `backend` and `sensors` as `ecs-service` instances), so there's no private ElastiCache subnet for them to reach.

---

**Phase 18 — scanner foundation (done):** every repo is public, so GitHub code-scanning (SARIF → Security tab) is free — no GHAS cost. New reusable **`smart-pet-ci/.github/workflows/security-scan.yml`** ([ci#18](https://github.com/jubasjl76-eng/smart-pet-ci/pull/18), [ci#19](https://github.com/jubasjl76-eng/smart-pet-ci/pull/19)): `secrets` (gitleaks, `fetch-depth: 0` — **hard fail** on any hit), `sast` (Semgrep `p/default` + `p/secrets` + `p/owasp-top-ten` → SARIF), `deps` (Trivy `fs` vuln+secret → SARIF, plus `npm audit --omit=dev --audit-level=high` **gate** when `node: true`), `iac` (Trivy `config` over Dockerfiles / Terraform when `iac: true`). Semgrep + Trivy run from **pinned Docker images** (`semgrep/semgrep:1.97.0`, `aquasec/trivy:0.74.0`) — no Action-version drift, and it sidesteps the pip-semgrep `pkg_resources` crash on Python 3.12. `strict: false` by default: Semgrep / Trivy / `npm audit` findings populate the Security tab / job log but don't block PRs until each repo's baseline is triaged (`npm audit` uses `continue-on-error: ${{ !strict }}` — [ci#21](https://github.com/jubasjl76-eng/smart-pet-ci/pull/21)). Caller grants `security-events: write` (a called workflow can only narrow perms).

**Phase 18 — rollout (done):** `security.yml` added to **all 17 repos** — services + web + app + `smart-pet-mqtt` on `development`; libs (`api-client`, `shared`), `smart-pet-simulator`, `smart-pet-device-sdk`, `smart-pet-ci` on `main`; firmware (`smart-feeder` `iac: true`, `smart-water-dispenser`, `gps-dog-collar`); `smart-pet-terraform` `iac: true`. `node: true` where a `package-lock.json` exists, `iac: true` where a Dockerfile or `.tf` exists. Weekly cron minute spread per repo. Every repo's Security workflow is green on its integration branch; **gitleaks found no secrets** anywhere. Real `npm audit` advisories surfaced in **backoffice-dashboard** (`react-router-dom`, `shell-quote` critical, `ws`, `yaml`) and **smart-pet-app** (`@babel/core`, `@xmldom/xmldom`, `axios` — mostly transitive via Expo tooling) — non-blocking, queued for a remediation slice.

**Phase 18 — npm audit remediation (done):** **backoffice-dashboard** → `npm audit fix` (axios 1.13→1.20, react-router-dom →7.18.3, + transitive bumps) plus dropped **`@react-navigation/native`** (unused in `src/`, dragged in the whole React Native / Metro tree) → **0 vulnerabilities**, build green ([dashboard#20](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/20)). **smart-pet-app** → `npm audit fix` cut runtime advisories 37 → 20, typecheck + jest green ([app#7](https://github.com/jubasjl76-eng/smart-pet-app/pull/7)); the residual 20 are all Expo SDK 55 build-time tooling (`@expo/config-plugins` & friends) where npm's only "fix" is `expo@46` — a 9-major downgrade — not shipped in the app bundle, tracked in **`smart-pet-docs/security/exceptions.md`** (EX-0001/0002, expiry 2026-12-10 / next SDK bump).

**Phase 18 — CodeQL (done):** reusable **`smart-pet-ci/.github/workflows/codeql.yml`** ([ci#22](https://github.com/jubasjl76-eng/smart-pet-ci/pull/22), [ci#24](https://github.com/jubasjl76-eng/smart-pet-ci/pull/24)) — buildless (`build-mode: none`) analysis, matrix over a `languages` JSON input, SARIF → Security tab. Wired into **15 repos** on push / PR / weekly cron: `javascript-typescript` × 11 (backend, dashboard, website, app, camera, edge, sensors, mqtt, api-client, shared, simulator), `c-cpp` × 4 (device-sdk, smart-feeder, smart-water-dispenser, gps-dog-collar — buildless C/C++ needs no PlatformIO toolchain; confirmed extracting `.cpp` sources). Terraform has no CodeQL support (Trivy `config` covers it); smart-pet-ci self-scans via Semgrep only. **First run: 0 CodeQL alerts** anywhere (default query suite). *(Enabling GitHub's one-click "default setup" via the API 404'd on this OAuth token — the committed reusable is the equivalent and gives explicit C/C++ control.)*

**Phase 18 — helmet + CSP (done):** **`helmet`** on all three Express services — `smart-pet-backend` ([#56](https://github.com/jubasjl76-eng/smart-pet-backend/pull/56)), `pet-iot-camera-service` ([camera#14](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/14)), `pet-iot-sensors-service` ([sensors#15](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/15)): JSON APIs get `default-src 'none'` CSP, HSTS + `nosniff` + frameguard from helmet defaults, `X-Powered-By` dropped, `Cross-Origin-Resource-Policy: cross-origin` so the dashboard / app (separate origins) — and the camera's `/streams` HLS — stay readable; `/docs` (backend + camera) gets a looser per-route CSP for the Scalar UI (`+helmet.test.ts` on the backend). **Web CSP + HSTS** — `backoffice-dashboard` via `nginx.conf` `add_header` on the SPA documents ([dashboard#22](https://github.com/jubasjl76-eng/backoffice-dashboard/pull/22)); `smart-pet-website` via `next.config.ts` `headers()` on all routes, `'unsafe-eval'` + `ws:` added in dev only for HMR ([website#14](https://github.com/jubasjl76-eng/smart-pet-website/pull/14)). Both: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy`. `script-src` keeps `'unsafe-inline'` for now (Vite has none; Next App Router injects bootstrap inline) — verified both built apps render clean under the enforced policy in a real browser. `pet-iot-edge-gateway` is raw `http` on the LAN — headers N/A. Follow-ups: self-host Scalar to drop the `/docs` CDN + `'unsafe-inline'`; nonce-based CSP middleware on the website; SRI on any external `<script>`.

**Phase 18 — gitleaks full-history sweep (done):** deep scan of **every ref, full history** of all 18 repos (`gitleaks git --log-opts="--all --full-history"`, 8.30.1, default ruleset). **17 / 18 clean** — no live credential ever committed anywhere. `smart-pet-backend` had 2 benign hits: an expired (2026-04-11) example JWT for a defunct Mongo `userId` in a pre-hardening `TESTING.md` (**file deleted**, historical commit pinned in `.gitleaksignore`), and a `generic-api-key` false-positive on the string `'009_access_log.sql'` in a test fixture (`// gitleaks:allow`). Report: **`smart-pet-docs/security/history-sweep-2026-09.md`** ([backend#57](https://github.com/jubasjl76-eng/smart-pet-backend/pull/57)). No `git filter-repo` rewrite — not warranted for a dead token; the policy (rotate → rewrite → invalidate clones) applies only if a *live* secret is ever found.

**Phase 18 — multi-tenant isolation (done):** `smart-pet-backend/semgrep/kennel-scope.yml` ([#58](https://github.com/jubasjl76-eng/smart-pet-backend/pull/58)) — flags any `query`/`queryOne`/`execute` under `src/breeder/` whose SQL hits a tenant table with **no `kennel_id` predicate and no `*id` lookup** (the audited load-a-kennel-checked-parent-then-traverse pattern is exempt). Audited all 34 initial hits: every one is correctly scoped; 4 dynamic-`WHERE` / engine-sweep sites carry a `// nosemgrep` + reason. **0 findings** on the tree. Wired via the reusable's new `semgrep-config` input ([ci#25](https://github.com/jubasjl76-eng/smart-pet-ci/pull/25)) — repo-local rules **block** (`--error`, no SARIF), registry packs stay report-only; shared Semgrep image bumped `1.97 → 1.176` for `nosemgrep` parity ([ci#26](https://github.com/jubasjl76-eng/smart-pet-ci/pull/26)). Companion **`kennel-isolation.test.ts`**: kennel A's owner gets `404` for kennel B's animal over the real router stack — verified red when the `AND kennel_id` is removed.

**Phase 18 — SBOM + provenance (done):** every container image now ships a **CycloneDX SBOM** + **SLSA build provenance** bound to its digest and pushed to the registry as OCI referrers (`gh attestation verify` / `cosign`). `smart-pet-ci/deploy-ecs.yml` ([ci#27](https://github.com/jubasjl76-eng/smart-pet-ci/pull/27)) — new `attest` input (default on): `anchore/sbom-action` → CycloneDX, `actions/attest-build-provenance` + `actions/attest-sbom` on the ECR push; backend + sensors `deploy.yml` grant `attestations: write` ([#59](https://github.com/jubasjl76-eng/smart-pet-backend/pull/59), [sensors#16](https://github.com/jubasjl76-eng/pet-iot-sensors-service/pull/16)). `pet-iot-camera-service/release.yml` does the same for its GHCR image on a version tag, with **all actions SHA-pinned** ([camera#16](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/16) — Semgrep flagged mutable action tags via `required_conversation_resolution`). npm packages (git-tag deps) and firmware `.bin` are out of scope here — firmware provenance pairs with the Phase 19 OTA signing pipeline.

**Phase 18 — weekly security report (done):** `smart-pet-ci/.github/workflows/security-report.yml` + `scripts/security-report.mjs` ([ci#28](https://github.com/jubasjl76-eng/smart-pet-ci/pull/28)) — Monday 08:00 UTC (+ manual) pulls every repo's code-scanning / Dependabot / secret-scanning alerts, rolls them into `security/YYYY-Www.md`: org totals, week-over-week delta (parsed from the prior report's machine-readable line), an **SLA-breach list** (Crit > 7d, High > 30d), and a per-repo table. Commits + pushes to `smart-pet-docs`. No-ops until the operator sets **`SECURITY_REPORT_TOKEN`** (`OPERATOR-ACTIONS.md` F4 — a cross-repo PAT, since a workflow's own token only sees its repo). First cycle committed manually: **[`security/2026-W37.md`](security/2026-W37.md)** — 0 critical, 1 high, 0 secrets. Dependabot column shows `—` until the token is set. Slack summary + AWS Security Hub folded in later.

**Phase 18 — simulator Dockerfile (done):** the one high from W37 — `smart-pet-simulator` ran as `root` (Trivy `DS-0002` + Semgrep `missing-user`). `chown -R node:node /app` after the build + `USER node` before the entrypoint ([simulator#7](https://github.com/jubasjl76-eng/smart-pet-simulator/pull/7)). Post-merge scan: **0 open code-scanning alerts across all 18 repos.**

**Phase 18 — SHA-pin GitHub Actions (done):** every third-party `uses:` across all repos is pinned to a commit SHA with a `# vN` comment (a tag can be silently repointed — cf. the `tj-actions` / `trivy-action` compromises). 23 unique actions resolved; **8 repos** changed — `smart-pet-ci` (36 refs across the 7 reusable workflows — [ci#29](https://github.com/jubasjl76-eng/smart-pet-ci/pull/29)), plus `backoffice-dashboard`, `smart-feeder`, `smart-pet-api-client`, `smart-pet-app`, `smart-pet-shared`, `smart-pet-terraform`, `smart-pet-docs`. Our own `jubasjl76-eng/smart-pet-ci/*@main` reusable refs stay on `main` by design (freezing them would defeat the update-once model). The other ~10 repos have no third-party `uses:` — they only call the reusables.

**Phase 18 — doable-now batch (done):**
- **Dependabot vulnerability alerts** enabled on all 18 repos (were disabled). The weekly report's Dependabot column now populates — **251 open** org-wide, concentrated in **backoffice-dashboard (85)** and **smart-pet-app (91)**, almost all dev/build-tooling transitives (vite/eslint/playwright, jest-expo/metro/babel) that `npm audit --omit=dev` correctly ignores; Renovate + Dependabot PRs chip at these continuously. 0 code-scanning, 0 secret-scanning.
- **Firmware static gates** — reusable `smart-pet-ci/.github/workflows/firmware-static.yml` ([ci#30](https://github.com/jubasjl76-eng/smart-pet-ci/pull/30), [ci#31](https://github.com/jubasjl76-eng/smart-pet-ci/pull/31)): **cppcheck** (gates on `severity="error"` via XML parse — `--error-exitcode` fires on any issue in cppcheck 2.13) + **Flawfinder** (SARIF → Security tab, gates at risk level ≥ 4). Wired into `smart-pet-device-sdk` (`src test`), `smart-feeder`, `smart-water-dispenser`, `gps-dog-collar`. One cppcheck `containerOutOfBounds` false positive in `spd_topics.h` suppressed inline. All green.
- **Secure Boot v2 + Flash Encryption design doc** — [`security/secure-boot-flash-encryption.md`](security/secure-boot-flash-encryption.md): threat model, RSA-3072 Secure Boot v2, AES-256-XTS Flash Encryption, key custody (Secrets Manager + 2-of-3 offline split), dev-vs-prod eFuse policy, recovery story, provisioning (protocomm + PoP), and a Phase 19 rollout plan. 3 open decisions (D1–D3) + a sign-off checklist (C9 exit criterion #7 — pending review).

**Phase 18 — free minors (done):**
- **GitHub private vulnerability reporting** enabled on all 18 repos — the "Report a vulnerability" button now exists everywhere.
- **`SECURITY.md`** added to the 6 product-facing repos (backend, dashboard, website, app, device-sdk, mqtt) — points at PVR + the SLA / `exceptions.md`. The internal service / lib repos rely on the PVR button.
- **SRI on the `/docs` Scalar script** — pinned to `@scalar/api-reference@1.68.0/dist/browser/standalone.js` + `sha384` integrity + `crossorigin`, in `smart-pet-backend` ([#60](https://github.com/jubasjl76-eng/smart-pet-backend/pull/60)) and in `@jubasjl76-eng/shared` **0.2.1** ([shared#5](https://github.com/jubasjl76-eng/smart-pet-shared/pull/5)) → re-pinned in `pet-iot-camera-service` ([camera#17](https://github.com/jubasjl76-eng/pet-iot-camera-service/pull/17)).
- **OSV-Scanner** — **not adopted**: it has no `platformio.ini` parser (the gap it was meant to fill), and its npm coverage duplicates Trivy `fs` + Dependabot. Firmware lib supply-chain stays on the C5 approach (pinned `platformio.ini` + Espressif advisory watch).

**Phase 18 — next (all blocked on the operator / AWS):** DAST (ZAP `-f openapi` + Nuclei) vs staging; AWS Security Hub / GuardDuty / IAM Access Analyzer baseline + scoped OIDC deploy role + ECR Enhanced Scanning; edge WAF rate-limiting; the weekly report's 2nd cycle (needs `SECURITY_REPORT_TOKEN`); external pen test (once customer data is live). Deferred: clang-tidy via a PlatformIO compile DB (needs the toolchain download).

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
