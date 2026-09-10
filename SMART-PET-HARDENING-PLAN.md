# Smart Pet — Hardening & Platform-Engineering Plan (Phases 11–21)

**Date:** 2026-09-09 · **Owner:** jubasjl76-eng · **Status:** FINALIZED 2026-09-09 · Phase 11 in progress

`v1.0.0` shipped every product phase (1–10). The product works; the **platform
around it does not exist yet**. There is no error tracking, no APM, no
distributed tracing, no E2E tests, no security scanning, no SBOMs, no
mobile-app test story, and the firmware has host unit tests + a Wokwi boot smoke
and nothing else.

This plan is the "make it operable and defensible" track: **eleven phases**
(11–21) that add repository-boundary structure, a unified environment + secrets
model, developer-experience tooling, API contract tooling, telemetry,
observability, test infrastructure, a full security-audit pipeline, firmware
hardening, a traffic-control + caching + resilience layer, and a high-
availability + disaster-recovery + load-validation pass. It does **not** add
product features. The **structure / environment / DX foundations (11–13) land
before or alongside** the contract, telemetry, test, and security work; the
**traffic + resilience infrastructure (20–21)** follows, building on the cache
tier and staging environment that Phase 12 introduces. Each phase is
independently shippable; the cheapest, highest-leverage work lands first.

Baseline confirmed 2026-09-09: `smart-pet-backend` has `vitest` only. No
`@sentry/*`, `helmet`, `swagger`/`openapi`, `pino`, `prom-client`,
`playwright`/`cypress` anywhere. `smart-pet-website` uses `zod@4`.
`smart-pet-ci` has `node-ci` / `pio-ci` / `terraform-ci` / `deploy-ecs`
reusable workflows and no security workflow.

---

## Part A — Architectural recommendations by domain

Each domain: the recommendation, the alternatives weighed, and why. Selections
optimise for **long-term maintainability**, **developer experience**, and
**cost/operational overhead** for a two-agent team running ~14 repos.

### A1. API & Documentation

**Current:** every backend feature ships a hand-written `docs/<feature>.md`
contract. No machine-readable spec. `/api/*` is unversioned. `smart-pet-mqtt`
is the MQTT contract with a hand-maintained C++ mirror (`spd_topics.h`) and two
vendored TS subsets (edge-gateway, simulator) that must be updated in lockstep.

**Recommendation — schema-first, one source of truth per surface:**

| Surface | Tool | Output |
|---|---|---|
| REST API | **Zod schemas + `zod-to-openapi`** on every route; serve `/openapi.json` + **Scalar** UI at `/docs` | runtime validation **and** the spec from one definition |
| MQTT contract | **AsyncAPI 3** spec in `smart-pet-mqtt` | topic/payload docs; codegen target for the C++ mirror + vendored subsets |
| Typed clients | **`openapi-typescript` + `openapi-fetch`** generated in CI from `/openapi.json` | drift-free client for dashboard + Expo app; retires hand-written `lib/api.ts` |
| Architecture docs | **Starlight (Astro)** site built from `smart-pet-docs/` | published reference; ADR section |
| Decisions | **ADRs** (`docs/adr/NNNN-*.md`) | the "Guiding decisions" table becomes real ADRs |

**Alternatives weighed:**

- **`tsoa`** (decorators + controllers generate routes + OpenAPI) — rejected. It
  forces a controller/decorator architecture; the backend is hand-rolled
  `Router()` + `ah()`/`bad()`/`need()` and a rewrite is not justified.
- **Hand-written OpenAPI YAML** — rejected. Always drifts; the `docs/*.md`
  problem in a new syntax.
- **`express-openapi-validator`** (spec-first, validates requests against a
  YAML spec) — viable, but you still hand-maintain the spec. Zod-first gives the
  spec *and* the validation you need anyway.
- **Fern / Stainless** for SDK + docs generation — good, but downstream of
  having a spec. Revisit once `/openapi.json` is stable and you want polished
  multi-language SDKs. Stainless is commercial; Fern has an OSS tier.
- **Swagger UI** vs **Redoc** vs **Scalar** for rendering — Scalar: actively
  developed, better DX, built-in "try it", first-class Express middleware.

**Versioning:** introduce `/api/v1/` **now**, while there is exactly one
consumer generation. URL-path versioning, not header — cache-friendly, obvious
in logs and traces, trivial for a small team. Keep unversioned paths as aliases
to `v1` for one deprecation window. Publish a deprecation policy: a route is
supported for N minor releases after `Deprecation` + `Sunset` response headers
appear, tracked in the changelog.

**Why this holds up:** Zod is already in the ecosystem (`smart-pet-website`,
`pet-iot-sensors-service`). One schema definition feeds validation, the spec,
the generated clients, and (via `zap-api-scan -f openapi`) the security DAST.
AsyncAPI does the same for MQTT and gives a codegen path that finally kills the
manual C++/TS contract-sync burden called out in dev-plan §4.

---

### A2. Error Tracking & Telemetry

**Current:** none. CloudWatch logs only. A crash in the dashboard, the Expo app,
or a device is invisible.

**Recommendation — Sentry across the whole stack, EU data region:**

| Target | SDK | Captures |
|---|---|---|
| Backend (Node/Express) | `@sentry/node` | exceptions, traces, profiling |
| Dashboard (React/Vite) | `@sentry/react` | errors, session replay, web vitals |
| Website (Next.js) | `@sentry/nextjs` | SSR + client + edge errors, vitals |
| Mobile (Expo/RN) | `@sentry/react-native` + config plugin | native crashes, JS errors, release health |
| Firmware (ESP32) | *no SDK* — MQTT crash telemetry → Sentry API | panic/reset reason, coredump summary, heap low-water, per-version crash-free rate |

**Firmware approach (there is no embedded Sentry SDK):** on boot the device
reads `esp_reset_reason()` and, if a panic/watchdog reset, publishes a
`crash` event on MQTT with firmware version, uptime-before-crash, free-heap
low-water, and a coredump digest. ESP-IDF's **coredump-to-flash** partition is
retrieved on next OTA check and symbolicated offline with `espcoredump.py` +
`addr2line` against the archived `.elf`. A small backend consumer forwards these
to Sentry as synthetic events tagged `device_id` + `fw_version`, giving
**release health per firmware version** (crash-free device %, top panic
reasons) — the same dashboard shape as web/mobile.

**Alternatives weighed:**

- **Rollbar / Bugsnag** — comparable; Bugsnag has strong RN support. Sentry
  wins on: errors + tracing + profiling + replay + release health in *one*
  product, a real free tier, an **EU data region** (matters given the Phase 8
  privacy posture), and a self-host option.
- **Self-hosted GlitchTip** (Sentry-SDK-compatible, lighter) — the cost hedge.
  Note as the fallback if Sentry SaaS volume pricing bites; SDKs do not change.
- **Datadog Error Tracking** — only sensible if Datadog is also the APM, which
  it is not (see A4).

**Release tracking:** every CI pipeline sets `SENTRY_RELEASE` = git SHA (or
`v*` tag), uploads sourcemaps (web/mobile) and firmware debug files, and
associates commits. "Which release introduced this regression" becomes
automatic.

---

### A3. Testing Infrastructure

#### Web E2E — **Playwright**

**Current:** `vitest` unit only; dashboard has no tests, website has a few
`vitest` utils.

| | Playwright | Cypress |
|---|---|---|
| Browsers | Chromium + Firefox + WebKit (real) | Chromium family; WebKit experimental |
| Parallelism | built-in, free | needs Cypress Cloud ($) for real sharding |
| Speed | faster | slower |
| Network / SSE interception | first-class | workable |
| Debugging | trace viewer | time-travel UI (excellent) |
| Component testing | first-party | first-party |
| Vendor | Microsoft, OSS | Cypress.io, OSS core + paid cloud |

**Pick Playwright.** No legacy Cypress to preserve, so choose the tool with
lower long-term cost (free parallelism), true multi-browser, and better SSE
handling — the dashboard's live console rides on Server-Sent Events. Run E2E
against the existing `docker compose` stack + `smart-pet-simulator` in CI: a
seeded owner, a full stack, and a scriptable device fleet already exist, which
is most of the E2E setup cost paid already. One Playwright project each for
`backoffice-dashboard` and `smart-pet-website`.

#### Mobile E2E — **Maestro** now, **Detox** later if needed

**Current:** none (app deferred; `expo@55` / `react-native@0.83` scaffold).

| | Maestro | Detox | Appium |
|---|---|---|---|
| Model | black-box, declarative YAML | gray-box, hooks the RN bridge | black-box, WebDriver |
| Flakiness | built-in auto-wait/retry | bridge-synced (very stable) | needs manual waits (flaky) |
| Speed | fast | fast | slow |
| Setup cost | minimal | fiddly (esp. iOS + new arch) | heavy |
| Real-device farm | Maestro Cloud | via 3rd-party | native (BrowserStack/Sauce) |
| Best for | reliable smoke + critical flows, fast to author | deep deterministic regression suites | real-device compliance matrix, non-RN targets |

**Pick Maestro for E2E smoke + critical flows.** The app is greenfield and
small; Maestro gets reliable flows (login → pair device → feed now → see status)
in an afternoon with near-zero maintenance. **Add Detox later** only when the
app grows enough to need fast, granular, bridge-synced regression runs. **Skip
Appium** unless a real-device compliance matrix becomes a contractual
requirement. Component/integration layer: **React Native Testing Library +
Jest** (render + interaction, no device).

#### Firmware testing — layered SIL → Wokwi → HIL

**Current:** host-native unit tests on the freestanding C++17 headers
(`test/run_native.sh`), PlatformIO matrix build, a Wokwi boot-smoke scenario
(`wait-serial: "[wifi] provisioning AP up:"`), CI `wokwi` job self-skips
without a token.

| Layer | Tool | Scope |
|---|---|---|
| Host unit (SIL) | **GoogleTest** via PlatformIO `test_framework` + `gcov`/`lcov` | freestanding core: `spd_topics`, `spd_schedule`, `spd_backoff`, `spd_offline_journal`, `spd_ulaw` |
| Sanitised host build | **ASan + UBSan + Valgrind** on the native test binary | overflow, use-after-free, leaks, uninitialised reads |
| Contract | generate device structs/topics from the AsyncAPI spec, assert `spd_topics.h` matches | kills the manual C++ mirror sync |
| Simulation | **Wokwi CLI** scenarios extended past boot: receive a `feed` command, assert servo GPIO, assert a `status` publish | CI-runnable HIL-lite (needs `WOKWI_CLI_TOKEN` — budget it) |
| Hardware (HIL) | Raspberry Pi + one of each device on a **self-hosted GH runner** labelled `hil`; CI flashes on `v*`, a pytest harness drives real MQTT | real sensor/actuator behaviour, timing, RF |

GoogleTest over Unity for the C++17 headers (Unity is C-oriented; keep it in
mind for any pure-C driver). HIL is the "hardware bench calibration" already
deferred in the plan — formalise it once one device runs in a real pen.

---

### A4. Observability & Monitoring

**Current:** a Terraform `observability` module (CloudWatch dashboards/alarms).
Structured logs are a *stated* standard, not enforced. No APM, no tracing, no
uptime checks, no custom metrics, no SLOs.

**The one decision that matters most: instrument with OpenTelemetry, not a
vendor SDK.** Every Node service gets the **OTel SDK** with auto-instrumentation
for `http`, `express`, `pg`, `mqtt`. You emit once and can route anywhere; no
telemetry-layer lock-in.

**Backends for the OTel data:**

| Option | Cost/overhead | Verdict |
|---|---|---|
| **Sentry** (errors + tracing) **+ Grafana Cloud** (logs + metrics + dashboards + synthetics) | two vendors, both real free tiers, self-host exit (GlitchTip + LGTM) | **recommended** |
| Grafana Cloud alone (Tempo + Loki + Mimir) | one vendor, OTel-native | fine, but you are buying Sentry anyway for A2 |
| Datadog / New Relic | best single pane; pricing punishes growth | rejected for this scale |
| CloudWatch only | already there; weak tracing, painful log search, thin dashboards | insufficient |

**Specifics:**

- **Logging:** structured JSON via **pino** on all Node services; every line
  carries `trace_id` (pino + OTel context) so logs ↔ traces correlate. Ship to
  Loki via an OTel collector / Grafana Alloy sidecar.
- **Metrics:** `/metrics` (Prometheus format, `prom-client`) per service. Custom:
  MQTT messages ingested/sec by type, command→ack latency, care-inbox exception
  rate by severity, rules-engine tick duration, notification delivery success,
  OTA rollout progress, DB pool saturation, device fleet offline %.
- **Distributed trace across MQTT:** put a W3C `traceparent` in the
  `smart-pet-mqtt` message envelope. A "Feed now" click then traces
  dashboard → backend → MQTT → device ack → backend → SSE as **one trace**.
- **Uptime / synthetics:** blackbox checks on `api./health`, dashboard, website,
  and an MQTT connect probe. **Grafana Cloud Synthetic Monitoring** or
  self-hosted **Uptime Kuma** on a small box.
- **Alerting on SLOs, not raw metrics:** API p99 latency, API error rate, MQTT
  ingest lag, DB connections, fleet offline %, crash-free device rate. Route
  through **Grafana OnCall** (free, OSS, has schedules + escalation) or
  **Better Stack** (cheap, hosted on-call).
- **Dashboards as code:** Grafana JSON in git, provisioned by the Terraform
  Grafana provider — the `observability` module grows to cover this.
- **RUM:** Sentry (web + mobile) already covers real-user monitoring / web
  vitals / release health. No separate tool.

---

### A5. Security & Compliance Scanning

**Current:** nothing automated. `npm audit` is flagged "optional". The Terraform
OIDC deploy role is PowerUser + IAMFullAccess (over-broad, already noted). A
past incident baked an API key into `main.tf` user-data. No SAST, DAST, secret
scanning, container scanning, IaC scanning, or SBOMs.

**Layered pipeline (all OSS-first, all emit SARIF → GitHub Security tab):**

| Layer | Tool(s) | Notes |
|---|---|---|
| Dependencies | **Dependabot** (native) + **`npm audit` gate** + **OSV-Scanner** (polyglot: npm, PlatformIO libs, Python HIL) + optional **Socket.dev** (malicious-package / typosquat) | OSV-Scanner is one scanner across the whole repo set |
| SBOM | **CycloneDX** per build (`@cyclonedx/cyclonedx-npm`, Trivy for images) attached to releases | fast "are we affected by X" triage; enterprise-readiness |
| SAST (services) | **CodeQL** (JS/TS) deep + **Semgrep** fast PR pass with project rules ("no raw SQL outside `src/database`", "every route behind `auth`") | CodeQL weekly + PR; Semgrep seconds per PR |
| SAST (firmware) | **CodeQL** (C/C++) + **clang-tidy** (`cert-*`, `bugprone-*`, `security-*`, `clang-analyzer-*`) + **cppcheck** (`--enable=all` + MISRA add-on) + **Flawfinder** | CI gate in `pio-ci.yml` |
| Secrets | **GitHub Secret Scanning + Push Protection** org-wide + **Gitleaks** CI gate + one historical sweep of all repos | exactly the `main.tf` key-leak class |
| Containers | **Trivy** (image vulns + IaC misconfig + secrets + SBOM in one tool) pre-ECR-push, fail on fixable HIGH/CRITICAL; **ECR Enhanced Scanning** (Inspector) on `prod` for continuous rescan | Trivy over Grype+Syft for one-tool simplicity |
| IaC / cloud | **Checkov** (or `trivy config`) on `smart-pet-terraform` + AWS **Security Hub** + **GuardDuty** + **IAM Access Analyzer** in `prod` | scanners can't see runtime; these can |
| DAST | **OWASP ZAP** baseline in CI vs the compose stack + full active scan vs the **`staging`** deploy pre-release, **spec-driven** via `/openapi.json`; **Nuclei** templates vs `staging` on a schedule | authenticated coverage of every endpoint once A1 ships the spec; staging is the A8 tier |
| Firmware supply chain | pin platform `@` commit (done) + OSV-scan `platformio.ini` libs + subscribe to the Espressif security advisory feed (no automated feed for the Arduino core) | |
| Device security | **Secure Boot v2** (RSA-3072 signed bootloader + app) + **Flash Encryption** + TLS-only MQTT in `prod` + per-device creds + broker ACL per topic subtree + credential rotation | Secure Boot is a one-way eFuse operation — **design before mass flashing** |

**Automated security report:** a scheduled reusable workflow
(`smart-pet-ci/.github/workflows/security-report.yml`) runs the full battery
weekly across all repos, collates SARIF + audit output into one
Markdown/HTML report (severity counts, week-over-week deltas, SLA breaches),
posts it to a channel, and commits it to
`smart-pet-docs/security/YYYY-Www.md`. **Remediation SLAs:** Critical 7 days,
High 30, Medium 90, Low best-effort — tracked in the report. Full detail in
**Part C**.

---

### A6. Firmware-Specific Tooling

**Current:** PlatformIO matrix build, host unit tests, Wokwi boot smoke, `#`-pinned
SDK + lib versions. No static analysis, no memory tooling, no size gates, no OTA
provenance.

| Concern | Tooling | Where |
|---|---|---|
| Static analysis | cppcheck (+MISRA), clang-tidy (cert/bugprone/security), CodeQL C++, Flawfinder | `pio-ci.yml` new `static-analysis` job, all gates |
| Code-health dashboard | **SonarCloud** if repos are public (free, tracks debt/hotspots over time + quality gate); otherwise skip self-hosted Sonar and rely on the CodeQL + clang-tidy + cppcheck trio | one pane for firmware health |
| Memory — host | **ASan + UBSan** on native tests; **Valgrind** for leaks/uninitialised | catches issues in all host-testable code |
| Memory — device | free-heap + heap low-water + `uxTaskGetStackHighWaterMark` per task published as telemetry (feeds A4); `heap_caps_check_integrity` + heap tracing in debug builds | the BLE+WiFi+MQTT stack already overflowed a partition once |
| Static stack/flash budget | `-fstack-usage` worst-case path sum; **`puncover`** flash/RAM per-symbol report | PR comment with the delta vs base |
| Size regression gate | CI fails if the app partition or `.bss`+`.data` crosses a threshold | the `min_spiffs.csv` pain, automated |
| OTA tracking | extend the existing fleet controller (`firmware` table, `deviceBucket`/`deviceTarget`/`deviceFwStatus`, staged %): per-device last-attempt/result/error, rollback count, `esp_ota_mark_app_valid` confirmation, version-distribution histogram, OTA failure rate, crash-free-by-version | backend + dashboard fleet screen |
| OTA provenance | signed manifest records signing-key id + artifact SHA-256 in the `firmware` row; device verifies hash before apply; **SLSA build provenance** (`actions/attest-build-provenance`) on the `.bin` published to S3 `firmware/` | supply-chain integrity for what runs in customers' homes |
| Build automation | `pio-ci.yml` gains: static-analysis job, size-report job, artifact `.elf`+`.map`+coredump ELF for symbolication, signed `.bin`+manifest to CDN on `v*`, pinned `pio` version for reproducibility, `git describe`+timestamp+SBOM-hash baked into the image and reported on boot | |

---

### A7. Repository Structure & Code Boundaries

**Current:** ~14 polyrepos under `jubasjl76-eng/`. Per-repo integration branch
(`development` for services, `main` for firmware/SDK/infra). The two-agent model
(dev-plan §2a) depends on **repo isolation** — Phase 3 failed when two agents
edited one working tree. Contract sharing today is manual: `smart-pet-mqtt` is
TS source; the C++ mirror (`spd_topics.h`) and two vendored TS subsets
(edge-gateway, simulator) are hand-copied in lockstep. `docs/<feature>.md` is the
backend → dashboard handoff.

**Monorepo vs polyrepo — the assessment:**

| For monorepo (Nx / Turborepo / Bazel) | Against, *specific to this project* |
|---|---|
| Atomic cross-repo changes (contract + all consumers in one PR) | The agent-isolation model **is** the repo boundary. A monorepo reintroduces the "two agents, one tree" failure Phase 3 hit; getting back to safety needs worktrees + path CODEOWNERS + affected-graph CI — work to regain what polyrepo gives free. |
| One lint/test/CI config | `smart-pet-ci` reusable workflows already solved duplicated CI. |
| Frictionless code sharing, no publish step | Firmware (PlatformIO, per-repo `#`-commit pins, Wokwi, HIL) gets nothing from a JS monorepo tool — you'd have a JS monorepo *plus* separate firmware repos regardless. |
| One dependency graph | Four independent release cadences (Vercel continuous / backend on `development` merge / firmware on `v*` staged / Terraform on infra `main`) fight a shared version. |
| | `v1.0.0` already shipped — migration is cost now, with the product live. |

**Recommendation: stay polyrepo; add the connective tissue.**

1. **Published, versioned contract packages** to GitHub Packages (private npm
   registry): `@jubasjl76-eng/mqtt-contract` (from `smart-pet-mqtt`),
   `@jubasjl76-eng/api-client` (generated from `/openapi.json` — Phase 14),
   `@jubasjl76-eng/shared` (zod schemas, shared TS types, the status/date/label
   formatters currently duplicated across dashboard + website). Consumers pin a
   range; Renovate bumps them. ~80% of the monorepo's sharing benefit, cost = one
   `npm publish` step.
2. **Schema is the source of truth; codegen replaces hand-copying.** OpenAPI
   (REST) + AsyncAPI (MQTT) drive CI codegen of: the TS client, TS MQTT types,
   **C++ structs + topic strings for the SDK**, and the vendored subsets. The
   manual `spd_topics.h` / edge-gateway / simulator sync in dev-plan §4 becomes
   `npm run codegen`, committed in the contract repo's release PR.
3. **Protobuf — evaluated, not recommended.** The system is JSON over MQTT and
   JSON over HTTP end to end; payloads are small and must stay eyeball-debuggable
   (the sim panel + `mosquitto_sub` workflow depends on it); ArduinoJson v7 is
   already on the device. Protobuf adds a compiler, an opaque wire format, and
   nanopb on the device to save bytes that are not the bottleneck. Keep JSON;
   get type-safety from types generated off the JSON Schema in the specs.
4. **Optional partial workspace, later.** `backoffice-dashboard` +
   `smart-pet-website` + the `@jubasjl76-eng/*` packages *could* become one
   **Turborepo / pnpm-workspace** repo — they share tokens, the API client, and
   formatters, and are both Cursor product-owned (Claude does the workspace
   move as hardening work → no collision risk).
   Turborepo over Nx for a 3-package cluster (less config). A fork in the road,
   not a Phase 11 requirement.
5. **Cross-repo dependency management: Renovate** (over Dependabot — better
   internal-package grouping + automerge of `@jubasjl76-eng/*` on green CI). Shared
   `renovate.json` preset in `smart-pet-ci`. Pin external deps, range internal.
6. **`REPOSITORIES.md`** in `smart-pet-docs` — formalises dev-plan §2a: what each
   repo owns, its integration branch, release trigger, CODEOWNERS, and the
   "contract PR merges first, consumers bump after" rule.

---

### A8. Environment Strategy & Configuration Management

**Current:** Local (compose) + `dev` + `prod` (Terraform `envs/`). **No
staging.** Secrets: `.env` git-ignored locally; AWS Secrets Manager via task-def
`secret_refs` in cloud; GitHub OIDC → scoped-ish AWS roles. Website env vars on
Vercel; mobile `EXPO_PUBLIC_*` + `eas.json`; firmware build flags + provisioning
portal + per-device MQTT creds minted on claim.

**Recommendation — four tiers, one config contract:**

| Tier | Purpose | Infra | Data | Deploy trigger |
|---|---|---|---|---|
| **Local** | daily dev | compose on the laptop | seeded / ephemeral | n/a |
| **Dev** | always-on integration | `envs/dev` (single-NAT, t4g.micro) | synthetic, resettable | merge to `development` |
| **Staging** *(new)* | prod-shaped pre-prod verification + the DAST target + RC firmware against a real cloud broker | **`envs/staging`** — prod topology, smaller sizing (EMQX ×2, ALB+WAF, Multi-AZ off) ~$120–180/mo | anonymised prod-like | release-candidate tag `v*-rc.N` |
| **Prod** | live | `envs/prod` (Multi-AZ, WAF, autoscale) | real; strict access | tag `v*` + required reviewers |

**Staging is the key addition** — it is Part C's active-DAST target, the
Playwright pre-prod smoke target, and the staged-firmware cloud-broker target.

**Config contract:** every service declares config in one typed schema (zod, in
`@jubasjl76-eng/shared`) split into (a) **public build-time** (API base URL, feature
flags — committable per-env), (b) **runtime non-secret** (pool sizes, timeouts,
tick intervals — per-env files), (c) **secrets** (never git, never logs,
runtime-injected). `config/index.ts` validates on boot and **refuses to start**
on a missing/invalid var — the backend already does this for `JWT_SECRET`;
generalise it to every service.

**Secrets — layered by surface:**

| Surface | Mechanism | Rationale |
|---|---|---|
| Local dev | `.env` from `.env.example`; team-shared secrets via **SOPS + age** (or `1Password` `op run`) | no plaintext secrets pasted around; `sops exec-env` / `op run --` inject |
| Git-committed non-prod config | **SOPS + age** `*.enc.yaml` per env, decrypt key in CI | `dev`/`staging` non-critical config lives in git, PR-reviewable, auditable |
| Cloud runtime | **AWS Secrets Manager** via ECS task-def `secrets:` (existing `secret_refs`), rotation on, least-priv read policy per service | already the direction; formalise rotation |
| CI → AWS | **GitHub OIDC** short-lived role assumption (in place) | no long-lived AWS keys |
| CI → 3rd parties (Sentry, Resend, Twilio, Wokwi, Grafana) | **org-level GH Actions secrets, scoped to GH Environments** (`prod` secrets only in the `prod` environment with required reviewers) | environment gating controls who can deploy with prod creds |
| Vercel (website) | Vercel env vars per environment; `NEXT_PUBLIC_*` client / plain server; **same names as the config contract** | Vercel is outside AWS; keep naming aligned |
| Mobile (Expo/EAS) | **EAS Secrets** for build-time; `EXPO_PUBLIC_*` only for genuinely public values; runtime secrets fetched post-auth from the backend, never bundled | anything in the app bundle is public |
| Firmware | **no secrets in the image**: WiFi creds → NVS via the provisioning portal; MQTT per-device creds minted on `POST /devices/claim` → encrypted NVS; signing **public** key baked in, private key in CI (Secrets Manager); OTA URL is a build flag | Flash Encryption (Phase 19) protects NVS at rest |

**Vault?** Evaluated. Best-in-class for dynamic/leased secrets but an HA service
to operate. For an all-AWS two-agent team, **Secrets Manager covers runtime with
far less overhead** and **SOPS+age covers git-committed config with no service to
run**. Revisit Vault only on outgrowing Secrets Manager (many non-AWS consumers,
per-request dynamic DB creds, cross-cloud).

**CI/CD injection standard:** OIDC for cloud; GH Actions secrets scoped to GH
**Environments** (`dev` auto → `staging` on RC tag → `prod` with reviewers); the
SOPS decrypt key is the *only* static secret in CI; no secret is ever `echo`ed
or passed as a build-arg that lands in an image layer (`--secret` mounts /
runtime env only).

---

### A9. Developer Experience & Local Dev Setup

**Current:** the compose stack (Postgres + Mosquitto + backend + dashboard), the
new simulator web panel (`:4100`), per-repo `npm run dev` hot reload (tsx watch /
Vite HMR / Next Fast Refresh). **Gaps:** no pre-commit hooks, no shared
lint/format config, ad-hoc per-repo ESLint/Prettier, no devcontainer, no
one-command full bring-up, no documented hardware-mock story.

**Recommendation:**

1. **One-command local bring-up.** A root `Taskfile.yml` + a root
   `compose.yaml` with `include:` per service, profiled: `task up` (full),
   `task up:core` (db + mqtt + backend + dashboard + sim), `task down`,
   `task reset` (wipe volumes + reseed), `task logs`. Replaces the "6 commands in
   6 tabs" list.
2. **Devcontainers** (`.devcontainer/`) per repo on a **shared base image** with
   the pinned toolchain (Node 22, pnpm, the PlatformIO venv for firmware,
   terraform, `gh`/`sops`/`age`/`mosquitto-clients`). "Works on my machine" ==
   CI == a new contributor in 5 minutes. Consumed by VS Code, JetBrains, and
   GitHub Codespaces.
3. **Hardware/embedded mocks — formalise what exists.** `smart-pet-simulator` +
   the web panel are the device mock; make the simulator a first-class local-dev
   dependency with documented manual + scenario modes. Add an **in-process MQTT
   broker fixture** (`aedes`) for unit tests that need a broker without Docker,
   and a **fake RTSP source** (ffmpeg looping a test clip) for the camera
   service's motion/HLS paths. Document in `MOCKS.md`.
4. **Hot reload — already good; document per-repo.** tsx watch (services), Vite
   HMR (dashboard), Next Fast Refresh (website), Expo Fast Refresh + EAS Update
   (app), `pio run -t upload -t monitor` + the Wokwi VS Code extension
   (firmware). Nothing to change; add a "dev loop" section to each README.
5. **Pre-commit + lint/format — one shared, enforced config:**

| Concern | Tool | Source |
|---|---|---|
| Git hooks | **Lefthook** (single binary, polyglot, no Node dep for firmware repos) over Husky+lint-staged | shared `lefthook.yml` preset |
| JS/TS lint | **ESLint 9 flat config** — `@jubasjl76-eng/eslint-config` | published package |
| JS/TS format | **Prettier** — `@jubasjl76-eng/prettier-config` (Biome noted as a future lint+format consolidation, ecosystem still thinner) | published package |
| C/C++ | **clang-format** (`.clang-format`) + **clang-tidy** (shares config with Phase 18 SAST) | in the SDK, pulled into firmware repos via a CI step |
| Python (HIL, scripts) | **Ruff** (lint + format, one binary, replaces Black/Flake8/isort) | shared `ruff.toml` |
| Terraform | `terraform fmt` + **tflint** | partly in CI already |
| Commit messages | **commitlint** (conventional commits — the repo already uses `feat(scope):`) + `Co-Authored-By` trailer check | shared config |
| Markdown | markdownlint + the **em-dash ban** as a custom rule (standing constraint) | shared |

Pre-commit: format (auto-fix) → lint (changed) → commitlint → gitleaks (staged)
→ fast typecheck. Pre-push: affected unit tests. Keep pre-commit **< 5s** or it
gets bypassed; heavy checks stay in CI.

6. **`.editorconfig`** in every repo (LF, final newline, indent) for non-hook
   editors.
7. **`CONTRIBUTING.md`** per repo (or one in `smart-pet-docs` + stubs): setup,
   the dev loop, branch/PR rules, the codegen step, running the mocks.

---

### A10. Traffic Control, Rate Limiting & Abuse Prevention

**Current:** none. `/api/public/*` (website browsing + `POST /api/public/inquiries`,
which writes DB rows + a care-inbox item per call) is unauthenticated and
unthrottled — the obvious abuse target. `/api/auth/login` + refresh are
unthrottled (credential-stuffing risk). MQTT has per-device creds + ACLs but no
per-device publish rate limit (a compromised device can flood the topic tree).

**Layered defence, cheapest layer first:**

| Layer | Mechanism | Stops |
|---|---|---|
| Edge | **CloudFront + AWS WAF** rate-based rules (per-IP request rate) + managed rule groups (common exploits, bot control) + optional geo-block; **Cloudflare** proxied in front of the website for free L3/4 DDoS + bot management | volumetric floods before they reach the ALB |
| Gateway | ALB has no native rate limit → the WAF layer is the coarse per-IP ceiling. **AWS API Gateway** only if a partner API with usage plans + API keys is ever needed (not now — extra hop + cost) | coarse per-IP |
| Application | **`express-rate-limit` + `rate-limit-redis`** (ElastiCache store), token-bucket per route class: strict `/api/auth/*` (~5/min/IP + lockout backoff), moderate `/api/public/*` (~30/min/IP, ~100/hr/IP for inquiries), generous per-user `/api/breeder/*` (~600/min). **`rate-limiter-flexible`** if sliding-window / composite per-user+per-IP keys / Redis-down insurance mode are wanted | targeted abuse, credential stuffing, inquiry spam, expensive-endpoint hammering |
| MQTT | **EMQX** built-in per-client message-rate + connection-rate limits + max inflight + max packet size; disconnect + alarm on breach | a buggy or compromised device flooding |
| Business logic | idempotency keys on mutating public endpoints; short-window per-buyer inquiry dedupe so one buyer cannot create 100 care-inbox items | logic-level amplification |

**Redis-backed, not in-memory:** prod backend is **×2, autoscale 2–6** — in-memory
counters would let each instance grant the full quota (N× the real limit).
ElastiCache is a hard dependency at that scale anyway (A11). `rate-limit-redis`
is one `INCR`+`EXPIRE` (or a Lua token-bucket) — negligible overhead.

**Response contract:** `429` + `Retry-After` + IETF draft `RateLimit-Limit` /
`RateLimit-Remaining` / `RateLimit-Reset` headers + a consistent JSON error body.

**Client-side `429` / transient-failure handling** (in the generated
`@jubasjl76-eng/api-client`, shared by web + mobile):

- On `429`: honour `Retry-After` (seconds or HTTP-date); else **exponential
  backoff with full jitter** — `sleep = random(0, min(cap, base·2^attempt))`,
  base 500 ms, cap 20 s, max 3–4 attempts. Retry only idempotent methods
  (GET/PUT/DELETE) and POSTs carrying an `Idempotency-Key`.
- Same backoff on `502/503/504` and network errors; honour `Retry-After` on `503`.
- **Client-side circuit breaker** (A12): after N consecutive failures to a host,
  stop trying for a cooldown so a struggling backend is not hammered by every
  open tab.
- Dashboard: extend the existing single-flight-refresh pattern to dedupe bursts
  of concurrent identical requests.
- Mobile: same wrapper; exponential backoff on the offline-replay queue.
- **SSE / MQTT reconnect:** the dashboard `useStream` and the SDK `spd_backoff.h`
  already auto-reconnect — audit both for **jittered** exponential backoff (not
  fixed interval), a cap, and reset-on-success.

---

### A11. Infrastructure, Load Balancing & High Availability

**Current (from the Phase 10 Terraform build):** public **ALB** (HTTPS/ACM,
host + path routing, WAF on prod, deletion protection on prod) → ECS Fargate
backend (×1 dev, ×2 + autoscale 2–6 prod) + sensors. **NLB** (cross-zone, TCP
1883 + optional TLS 8883, EFS-backed retained store) → EMQX/Mosquitto on Fargate
(×1 dev, ×2 prod). **CloudFront + S3 + OAC** for hls / firmware / dashboard /
assets / buyer-photos. **RDS Postgres** Multi-AZ in prod. **Route53 + ACM**.
nginx inside the dashboard container (SSE buffering off). Camera service runs
**at the edge**, not in ECS.

**Assessment: the topology is right; the gaps are HA depth, a cache tier, and a
few placement details.**

| Concern | Now | Recommendation |
|---|---|---|
| Web / API LB | ALB, host+path, WAF (prod) | **Keep ALB** — correct L7 choice on AWS (native ACM, WAF, OIDC, health checks). Add: HTTP/2 on, idle timeout above the SSE keepalive, access logs to S3, low `deregistration_delay`, cross-zone on. **Cloudflare (proxied DNS) in front of the website**; do not double-proxy the API without measuring. |
| MQTT LB | NLB, cross-zone, conditional TLS | **Keep NLB** — L4 preserves long-lived MQTT TCP sessions (ALB cannot do MQTT). Make **TLS 8883 the default** in staging+prod; add NLB access logs + a real broker health check. **EMQX cluster ≥2 with session persistence** so a node loss does not drop every device. The **EFS retained store is a contention point** — evaluate EMQX's clustered store / RocksDB backend instead at scale. |
| Reverse proxy | nginx in the dashboard container | Fine. **Do not add a standalone nginx/HAProxy tier** — ALB + one-container-per-Fargate-task is enough; a shared proxy only earns its place with MQTT-aware L7 routing later. |
| App cache | **none** (SSE was chosen to dodge Redis at single-instance) | **ElastiCache Redis becomes required at prod ×2.** Uses: rate-limit store (A10), refresh-token denylist, hot lookups (`withKennel` context, rules, device roster) with short TTL + explicit bust, **cross-instance SSE fan-out** (Redis pub/sub — removes the "one instance only" SSE limit), the engine-sweep leader lock (A12), the idempotency store. `cache.t4g.micro` + 1 replica (Multi-AZ) prod; in-memory fallback local/dev. **Memcached rejected** — pub/sub + sorted sets + persistence are all used here. |
| CDN — static | CloudFront + S3 (dashboard, assets); website on Vercel | Keep. Content-hashed filenames + long `Cache-Control` + `stale-while-revalidate` + Brotli + HTTP/3 for the dashboard bundle. Website: keep Vercel ISR + the on-publish revalidate webhook. |
| CDN — OTA firmware | S3 `firmware/` behind CloudFront (planned) | **A distinct distribution problem.** Add: HTTP **range-request / resumable OTA** (the SDK already assumes an unreliable link — `spd_offline_journal.h`), immutable per-version paths (`firmware/<type>/<version>/app.bin`), a short-TTL `latest.json` per type+channel, signed manifest + hash verify (A6), and treat the staged-rollout % as a **CDN cache-warm** curve. A dedicated OTA backend (hawkBit) or R2 for egress only at 10k+ devices. |
| HA — compute | ECS ×2 + autoscale (prod) | Add: ≥2-AZ task spread, `minimumHealthyPercent`/`maximumPercent` for zero-downtime deploys, **ECS deployment circuit breaker** (auto-rollback), autoscale on **request-count-per-target + a custom MQTT-ingest-lag metric**, not CPU alone. |
| HA — data | RDS Multi-AZ (prod) | Add: a **read replica** for exports / growth-chart aggregation / GDPR export so heavy reads miss the primary; **RDS Proxy** for connection multiplexing (matters at backend ×6 — A12); verify automated backups + PITR. |
| HA — MQTT | EMQX ×2 (prod) | Cluster health + split-brain policy; a documented "broker down" degradation (devices journal locally, replay on reconnect — the backend must **dedupe replayed messages** by id/timestamp). |
| HA — edge (camera) | one box per kennel | Not HA by nature (on-prem). Acceptable — **document it**: camera/audio is best-effort; the HA path is feeder + sensors + alerts via the cloud broker. |
| Multi-region / DR | none | Out of scope for v1 traffic; **write the DR plan now** (A12 #19): cross-region RDS snapshot copy, S3 CRR for `firmware/` + `buyer-photos/`, Terraform + `envs/` is the recovery mechanism, documented RTO/RPO. |

---

### A12. Architectural gaps — full-stack sweep

The explicit "what did we miss" pass, layer by layer. Items are tagged with the
phase that absorbs them.

**Backend / data**

1. **DB pool is unmanaged.** Raw `pg.Pool` defaults (10). At backend ×6 that is
   60 connections against `db.t4g.small` (~340 max, minus failover + replica +
   proxy overhead). Tune `max` from `max_connections / instances` with headroom;
   set `idleTimeoutMillis`, `connectionTimeoutMillis`, `statement_timeout`; add
   **RDS Proxy**; export pool gauges (waiting / idle / total) to `/metrics`.
   → **P12** (config) + **P16** (metrics) + **P20** (RDS Proxy).
2. **In-process schedulers assume one instance.** `engineTick()`, `fleetSweep()`,
   `retentionSweep()` run on `setInterval` in *every* backend process — at ×2+
   they double-fire (double notifications, double OTA pushes, racey retention
   deletes). Fix: a **leader-election lock** (Redis `SET NX PX` renewed, or a
   Postgres advisory lock) so exactly one instance sweeps; better, extract the
   sweeps into a **dedicated worker service** (one task, no ALB). → **P20**
   (the lock is the fast interim; ships with the prod ×2 cutover).
3. **No job queue / outbox.** Notifications, OTA fan-out, go-home-pack assembly,
   weekly buyer emails, GDPR export/delete are synchronous or `setInterval`.
   Fix: a **transactional outbox** table + a worker draining it with
   retry/backoff/DLQ. Tool: **pg-boss** (Postgres-backed, zero new infra, fits
   the stdlib-first ethos) over BullMQ (needs Redis) over RabbitMQ/SQS/**Kafka**
   (**Kafka explicitly not needed** — no streaming/replay/analytics
   requirement; the MQTT broker already is the device event bus). → **P20**.
4. **No idempotency layer** on mutating endpoints (device claim, inquiry, feed
   command, OTA trigger) — a retried POST double-acts. `Idempotency-Key` header →
   a Redis/Postgres (key → response) store with TTL. → **P14** defines the
   header, **P20** implements the store.
5. **No circuit breakers** around outbound calls (Resend, Twilio, MQTT publish,
   the revalidate webhook, S3). A provider outage blocks or retries forever.
   **`opossum`** around each, with a fallback (queue the notification, skip the
   webhook, degrade) + breaker state on `/metrics`. → **P16 / P20**.
6. **`/ready` vs `/health` not separated.** Only `/health` exists; dev-plan §4
   mandates both. `/health` = liveness; `/ready` = deps reachable (DB `SELECT 1`,
   MQTT connected, Redis ping) and the **ALB routes only when ready**; a
   `/startup` gate covers slow first boot (migrations). → **P12 / P16**.
7. **Graceful shutdown.** On SIGTERM (deploy / scale-in): stop new conns, drain
   in-flight, close pool + MQTT + Redis, flush telemetry, exit within the ECS
   `stopTimeout`. Present in camera/sim; **standardise across all services**.
   → **P12 / P16**.
8. **Migration deploy safety.** The runner is forward-only + idempotent + a
   pre-deploy RunTask (good). Missing: an **advisory lock** so two concurrent
   deploys do not both migrate, and an **expand/contract** policy so a migration
   co-exists with old instances during a rolling deploy. → **P12**.

**Frontend**

9. **Dashboard error boundary + offline UX** beyond Phase 2: a top-level error
   boundary → Sentry, an SSE-dropped banner, optimistic-UI rollback on failed
   mutations. → **P15**.
10. **No feature-flag mechanism** for rolling out P14–P21 (and future product).
    Lightweight `flags` table + `/api/config` + a typed hook; **Unleash** (OSS)
    only if it grows. → **P12** seeds it.
11. **CSP / security headers**: `helmet` on the API, strict CSP + HSTS +
    `frame-ancestors` on the web apps, SRI on external scripts. → **P18**.

**Mobile** (when the app is de-deferred; flagged now)

12. **Offline-first data layer** — the priority for a pet-care app on patchy
    garden/kennel wifi: local store (SQLite / WatermelonDB / MMKV) + queued
    mutations + a conflict policy + a sync engine. The backend is "app-ready";
    the app has no sync design. → **app phase**.
13. **Push notifications** (Expo Push → APNs/FCM) — Phase 4 built server-side
    notification infra but no device-push channel. → **app phase**.
14. **Certificate pinning** for the mobile API client. → **P18 / app phase**.

**Firmware**

15. **Brown-out / power-loss resilience** — a mid-write NVS corruption on a power
    blip. NVS commit discipline + a config CRC + factory-default fallback +
    `esp_brownout` handler. A/B OTA covers firmware, not config. → **P19**.
16. **Time trust** — feed schedules need wall-clock; `spd_time.h` does SNTP but a
    device booting offline has no time. Persist last-known-good, refuse schedule
    execution until time is trusted, add drift telemetry (the Ponytail
    "calibration knob" note). → **P19**.
17. **Fleet kill switch** — no fast global halt if a bad rule/firmware causes
    over-feeding. A retained `kennel/{k}/_control` safe-mode topic the SDK
    honours (stop actuators, keep reporting) + a dashboard "halt fleet" action.
    → **P19** (pairs with the fleet screen).
18. **Provisioning security** — SoftAP/BLE first-setup sends WiFi creds in the
    clear. Use protocomm + proof-of-possession, QR-based. → **P18 / P19**.

**Infra / ops**

19. **Backup & DR — undocumented.** RTO/RPO per data class (Postgres RPO ≤ 5 min
    via PITR, RTO ≤ 1 hr; S3 versioning + CRR; firmware immutable + replicated);
    automated cross-region snapshot copy; a **quarterly restore drill** (an
    untested backup is a hope); a runbook (`smart-pet-docs/runbooks/dr.md`).
    → **P21**.
20. **Key rotation** — one `JWT_SECRET` today; move to a keyset with `kid` +
    grace window; MQTT device-cred rotation; firmware signing-key rotation +
    revocation. → **P12** seeds, **P18** formalises.
21. **Cost monitoring** — AWS Budgets + anomaly alerts + per-env cost-allocation
    tags. Cheap insurance against a runaway bill (rate-limit bypass, log-volume
    explosion). → **P16**.
22. **Runbooks + on-call + status page** — incident-response doc, sev
    definitions, escalation, a status page (static S3 page driven by the uptime
    checks). → **P16**.
23. **DB data lifecycle** — partition the high-volume tables (`access_log`,
    readings/telemetry, `exceptions`) by month so the Phase 8 retention sweep is
    `DROP PARTITION`, not a bloating mass `DELETE`. → **P20**.
24. **Load testing** — deferred from the old Phase 10. Formalise: **k6** for the
    HTTP API + a scaled simulator run (~10k virtual devices) for MQTT, against
    **staging**, with p99 + error-rate pass/fail thresholds. → **P21**.
25. **Pagination / payload limits** — list endpoints need consistent cursor
    pagination + a hard max page size + `express.json({ limit })` + a global
    request-size cap, or a large kennel OOMs a response. Partially there
    (`limit` params) — enforce it uniformly. → **P14**.
26. **Multi-tenant isolation is app-enforced only** — one missed
    `WHERE kennel_id` leaks across kennels. Add a **Semgrep rule** that every
    breeder query is kennel-scoped + a test; consider Postgres **Row-Level
    Security** as a backstop. → **P18** (rule) + optional **P20** (RLS).

---

## Part B — Revised project plan

`v1.0.0` = Phases 1–10 done. New work is a **hardening track, Phases 11–21**,
re-sequenced so the **structure / environment / DX foundations (11–13) land
before or alongside** the contract, telemetry, test, and security rollouts, and
the **traffic / resilience infrastructure (20–21)** builds on the cache tier and
staging that 12 introduces. Each phase is independently shippable.

```
FOUNDATIONS (run in parallel, ~1 month)
  Phase 11  Repository structure & code boundaries  ─┐
  Phase 12  Environment strategy & config mgmt      ─┤
  Phase 13  Developer experience & local dev        ─┘
                     │  (11 → @jubasjl76-eng/* packages; 12 → staging + config contract + ElastiCache stub;
                     │   13 → shared lint/hook presets)
                     ▼
  Phase 14  API contract & documentation   ─┐   (codegen lands in 11's package layout;
  Phase 15  Error tracking & release health ─┤    14 also defines the 429 / Idempotency-Key contract)
  Phase 16  Observability & monitoring      ─┘        │
                     │                               ▼
                     │                     Phase 17  Test infrastructure
                     │                               │  (contract tests need 14; DAST + load tests → staging)
                     ▼                               ▼
  Phase 18  Security audit & scanning  ◀──────────────┘   (edge WAF rate-limiting lives here)
  Phase 19  Firmware hardening & HIL   (deep firmware half of 16 + 18 + A6)
                     │
                     ▼
  Phase 20  Traffic control, caching & resilience   (Redis/ElastiCache, rate-limit stack, job queue,
                     │                                leader lock / worker, circuit breakers, RDS Proxy,
                     │                                idempotency store, /ready, table partitioning)
                     ▼
  Phase 21  High availability, DR & load validation  (EMQX cluster depth, OTA CDN hardening, read replica,
                                                      cross-region backup + DR drill, k6 + 10k-device load test)
```

**Why this order:** the repo-boundary decision (11) determines *where* generated
clients, shared schemas, and lint presets live — everything downstream imports
them. Staging (12) is the DAST target, the pre-prod smoke target, and the load-
test target, so it must exist before Phase 17/18/21; 12 also stands up the
ElastiCache module (stub in dev, live in staging/prod) that Phase 20's rate
limiting, cross-instance SSE, and leader lock all depend on. The shared hook +
format config (13) is what makes the Phase 17/18 gates enforceable without
per-repo bespoke setup. 20 comes after 18 because the rate-limit **edge** layer
(WAF rate-based rules) ships as a security control in 18, while 20 adds the
**application** layer that needs Redis. 21 is the final HA + capacity pass
before real traffic. 11–13 are cheap,
parallelisable, and mostly one-time.

---

### Phase 11 — Repository structure & code boundaries · size M

| Task | Repo | Size |
|---|---|---|
| Decision record: polyrepo + published contract packages (per A7); write `REPOSITORIES.md` (ownership, integration branch, release trigger, CODEOWNERS, "contract PR first" rule) | `smart-pet-docs` | S |
| Stand up a private GitHub Packages npm registry; publish `@jubasjl76-eng/mqtt-contract` from `smart-pet-mqtt` (versioned, changelog) | `smart-pet-mqtt`, `smart-pet-ci` | M |
| Create `@jubasjl76-eng/shared` — zod schemas, shared TS types, the status/date/label formatters currently duplicated in dashboard + website | new small repo or `smart-pet-mqtt` monorepo-lite | M |
| Replace the **vendored `smart-pet-mqtt` copies** with a dependency on `@jubasjl76-eng/mqtt-contract`: `smart-pet-simulator` + `pet-iot-edge-gateway` (both carried a "Source of truth" subset) — **done**. `backoffice-dashboard` / `smart-pet-website` if they consume topic types (Claude, on a feature branch). `smart-pet-backend` keeps its older feeder-locked `src/mqtt/contract.ts` — its migration to the v2 contract is **Phase 14** (with the AsyncAPI spec + codegen + a test harness). `pet-iot-camera-service` / `pet-iot-sensors-service` hand-roll their own narrow topic logic (no vendored copy) — tidy those in Phase 14 too. | those repos | M |
| `renovate.json` shared preset (internal-package grouping + automerge on green, external pinning) applied org-wide | `smart-pet-ci` | S |
| CODEOWNERS per repo; branch-protection + required-checks baseline via a script | all | S |

**Exit:** contract types come from a versioned package, not a hand-copy;
`REPOSITORIES.md` is the boundary contract; Renovate manages internal + external
bumps.

### Phase 12 — Environment strategy & configuration management · size M

| Task | Repo | Size |
|---|---|---|
| Typed config contract (`@jubasjl76-eng/shared`): public / runtime-non-secret / secret categories; `config/index.ts` that validates and refuses to boot on missing vars, generalised to every service | `@jubasjl76-eng/shared` + 4 service repos | M |
| `envs/staging` — prod topology, reduced sizing (EMQX ×2, ALB+WAF, Multi-AZ off); `backend.tf` state key `staging` | `smart-pet-terraform` | M |
| GH **Environments** (`dev` auto → `staging` on `v*-rc.N` → `prod` on `v*` with required reviewers); move third-party secrets to org-level, environment-scoped | `smart-pet-ci`, all deploy workflows | M |
| **SOPS + age** for git-committed non-prod config (`*.enc.yaml` per env); decrypt key as the only static CI secret; `.env.example` refresh + a `sops exec-env` local wrapper | all service repos | M |
| AWS Secrets Manager: rotation on for DB + app secrets; least-privilege per-service read policy; audit task defs for any plaintext; move `JWT_SECRET` to a `kid` keyset with a grace window (A12 #20) | `smart-pet-terraform`, `smart-pet-backend` | M |
| Align Vercel env-var names + EAS Secrets names to the config contract; document the firmware secret model (NVS, per-device creds, signing keys) in `docs/firmware-secrets.md` | `smart-pet-website`, `smart-pet-app`, SDK | S |
| **`modules/cache` (ElastiCache Redis)** — off in dev (in-memory fallback), `cache.t4g.micro` + replica in staging/prod; wired into task defs as `REDIS_URL`. Consumed later by P20 (rate limit, SSE fan-out, leader lock, idempotency) | `smart-pet-terraform` | S |
| Separate **`/ready`** (deps reachable: DB `SELECT 1`, MQTT, Redis) from `/health` (liveness); ALB target-group health check → `/ready`; standard **graceful-shutdown** handler (drain, close pool/MQTT/Redis, flush telemetry) across all services (A12 #6, #7) | 4 service repos | M |
| Migration runner: **advisory lock** so concurrent deploys do not both migrate; document the expand/contract (backwards-compatible) migration policy (A12 #8) | `smart-pet-backend` | S |
| Feature-flag seed: a `flags` table + `/api/config` + a typed client hook (A12 #10) | `smart-pet-backend`, `@jubasjl76-eng/shared` | S |

**Exit:** four tiers (Local / Dev / Staging / Prod) with one config contract;
no plaintext secret in git, an image layer, or a task def; staging is deployable;
`/ready` gates ALB routing; the cache module exists (dormant until P20).

### Phase 13 — Developer experience & local dev · size M

| Task | Repo | Size | Status |
|---|---|---|---|
| Root `Taskfile.yml` + `compose.yaml`; `task up` / `up:core` / `down` / `reset` / `logs` / `sim` / `health` | **new `smart-pet-dev` repo** | M | ✅ |
| `.devcontainer/devcontainer.json` **base** (Node 22, Python 3.11, terraform, gh, pnpm, lefthook, PlatformIO, `age`, `mosquitto-clients`, `clang-format`) | `smart-pet-ci/config/` | M | ✅ base; per-repo copy is follow-up |
| Shared dev-config: `eslint.config.mjs` (flat), `prettier.config.mjs`, `commitlint.config.mjs`, `lefthook.yml`, `.clang-format`, `ruff.toml`, `.editorconfig`, `.markdownlint.jsonc` | `smart-pet-ci/config/` + `scripts/sync-dev-config.sh` | M | ✅ ([#9](https://github.com/jubasjl76-eng/smart-pet-ci/pull/9), [#10](https://github.com/jubasjl76-eng/smart-pet-ci/pull/10)) |
| Adopt Lefthook + presets; pre-commit format → lint (staged) → commitlint → gitleaks → fast `tsc`; pre-push tests; every step no-ops if its tool is missing; **no bulk reformat** | all | M | 🔨 `smart-pet-backend` ([#31](https://github.com/jubasjl76-eng/smart-pet-backend/pull/31)); rest via `sync-dev-config.sh` |
| `MOCKS.md` — simulator (the device mock), `aedes` in-process broker fixture, looping-ffmpeg RTSP for the camera | `smart-pet-dev` | S | ✅ |
| per-repo `CONTRIBUTING.md` (setup, dev loop, codegen step, mocks) | all | S | 📋 follow-up |

**Exit:** `task up` brings up the stack ✅; the shared config exists and one
repo proves the adoption ✅; the rest of the repos run `sync-dev-config.sh`
opportunistically (config = shared, adoption = mechanical).

### Phase 14 — API contract & documentation · size M

| Task | Repo | Size |
|---|---|---|
| Zod request/response schemas on all `/api` routes (schemas from `@jubasjl76-eng/shared`); `zod-to-openapi`; serve `/openapi.json` + Scalar at `/docs` | `smart-pet-backend` | M |
| `/api/v1/` prefix; unversioned → v1 aliases; `Deprecation`/`Sunset` header helper + policy doc | `smart-pet-backend` | S |
| AsyncAPI 3 spec for the MQTT contract in `smart-pet-mqtt`; publish docs | `smart-pet-mqtt` | M |
| CI codegen from the specs → `@jubasjl76-eng/api-client` (TS, `openapi-fetch`), TS MQTT types, **C++ structs + topic strings for the SDK**; adopt in the dashboard, retire hand-written `lib/api.ts`; delete the manual `spd_topics.h` mirror | `smart-pet-ci` + consumers | M |
| Migrate `smart-pet-backend` off its feeder-locked `src/mqtt/contract.ts` to `@jubasjl76-eng/mqtt-contract` (feeder command/ack/status path, `feederMqtt`, `statusIngest`, the breeder engine's `normaliseMessage`, geo `ingestPosition`, fleet OTA); tidy `pet-iot-camera-service` / `pet-iot-sensors-service` inline topic strings onto the contract | `smart-pet-backend`, those repos | M |
| Starlight docs site from `smart-pet-docs/`; ADR section; convert "Guiding decisions" to ADRs | docs site | S |
| Same OpenAPI + Scalar for `pet-iot-sensors-service`, `pet-iot-camera-service` | those repos | S |
| **Contract-level traffic rules** in the spec + the generated client: `429` + `Retry-After` + `RateLimit-*` response shape; `Idempotency-Key` header on mutating endpoints; **cursor pagination + hard max page size** on all list endpoints + a global request-size cap (A10, A12 #4, #25) | `smart-pet-backend`, `@jubasjl76-eng/api-client` | M |
| Generated client retry/backoff middleware: honour `Retry-After`, else exponential backoff with full jitter (base 500 ms, cap 20 s, ≤4 tries), idempotent methods + keyed POSTs only; typed `RateLimitedError`; client-side circuit breaker (A10, A12 #5) | `@jubasjl76-eng/api-client` | M |

**Exit:** OpenAPI + AsyncAPI are the contract; downstream types are generated,
not copied; the docs site is live; every client speaks the `429` / idempotency /
pagination contract.

### Phase 15 — Error tracking & release health · size S–M

| Task | Repo | Size |
|---|---|---|
| Sentry project (EU region), org + per-repo config, DSNs via the Phase 12 secret model | all | S |
| `@sentry/node` on backend + sensors + camera + edge-gateway; trace sampling; PII scrubbing aligned with Phase 8 | 4 repos | M |
| `@sentry/react` (dashboard, + replay + vitals), `@sentry/nextjs` (website), `@sentry/react-native` + config plugin (Expo app) | 3 repos | M |
| Firmware `crash` MQTT event (reset reason, heap low-water, coredump digest) + backend consumer → Sentry API; archive `.elf` per release for symbolication | SDK + firmware + `smart-pet-backend` | M |
| CI: `SENTRY_RELEASE` = SHA/tag, upload sourcemaps / debug files, associate commits — every pipeline | `smart-pet-ci` | S |

**Exit:** an unhandled error anywhere — including a device panic — appears in
Sentry, attributed to a release.

### Phase 16 — Observability & monitoring · size M–L

| Task | Repo | Size |
|---|---|---|
| OTel SDK + auto-instrumentation (`http`, `express`, `pg`, `mqtt`) on all Node services | 4 service repos | M |
| pino JSON logging with `trace_id` correlation; replace ad-hoc `console.*` | 4 service repos | M |
| `/metrics` (`prom-client`) + the custom metric set (MQTT ingest by type, ack latency, exception rate by severity, tick duration, OTA progress, pool saturation, fleet offline %) | 4 service repos | M |
| `traceparent` in the `smart-pet-mqtt` envelope; propagate through the backend consumer + device SDK | `smart-pet-mqtt`, `smart-pet-backend`, SDK | M |
| Grafana Cloud (Loki + Mimir + Tempo) via an OTel collector / Alloy sidecar in the ECS task defs | `smart-pet-terraform` | M |
| Dashboards as code (Grafana provider in Terraform); SLO dashboards per service + a fleet dashboard | `smart-pet-terraform` | M |
| Synthetic uptime checks (api `/health`, dashboard, website, MQTT connect) | Grafana Cloud / Uptime Kuma | S |
| SLO alert rules; on-call routing (Grafana OnCall or Better Stack) | `smart-pet-terraform` | M |
| Device memory telemetry (free heap, task stack high-water) on the telemetry path | SDK + firmware | S |
| **DB pool gauges** (waiting / idle / total) + **circuit-breaker state** (`opossum` around Resend / Twilio / MQTT publish / revalidate webhook / S3) on `/metrics`, with graceful fallbacks (A12 #1, #5) | 4 service repos | M |
| **AWS Budgets + cost-anomaly alerts** + per-env cost-allocation tags (A12 #21) | `smart-pet-terraform` | S |
| **Runbooks + incident-response doc** (sev definitions, escalation) + a **status page** (static S3 page driven by the uptime checks) (A12 #22) | `smart-pet-docs`, `smart-pet-terraform` | S |

**Exit:** a "Feed now" click is one distributed trace across HTTP + MQTT +
device; SLO dashboards + paging alerts + cost alerts + a status page live for
`staging` and `prod`.

### Phase 17 — Test infrastructure · size L

| Task | Repo | Size |
|---|---|---|
| Playwright + CI vs the `task up` stack + simulator; critical-path suite (login, setup, claim device, care-inbox triage, feed round-trip, SSE liveness) | `backoffice-dashboard` | M |
| Playwright for the marketing site (nav, locale switch, inquiry form, SEO tags, Lighthouse budget) | `smart-pet-website` | M |
| Maestro flows for the Expo app (login → pair → feed now → status; offline) + Maestro CI | `smart-pet-app` | M |
| RN Testing Library + Jest component/integration layer | `smart-pet-app` | S |
| Firmware host tests → GoogleTest + `lcov`; ASan/UBSan/Valgrind native build in CI | SDK | M |
| Wokwi scenarios extended to the command loop (receive `feed`, assert GPIO, assert `status`) per device; `WOKWI_CLI_TOKEN` | SDK + firmware | M |
| Contract test: generated device structs vs the AsyncAPI spec; Supertest API conformance vs `/openapi.json` | SDK + `smart-pet-backend` | S |
| `smart-pet-ci`: reusable `e2e-playwright.yml`, `mobile-maestro.yml`; extend `pio-ci.yml` with coverage + sanitiser jobs | `smart-pet-ci` | M |

**Exit:** every product repo has an E2E or HIL-lite suite on PRs; a red suite
blocks merge.

### Phase 18 — Security audit & scanning · size L

Full detail in **Part C**. Deliverables:

- SAST (CodeQL + Semgrep), dependency (Dependabot/Renovate + OSV-Scanner +
  `npm audit` gate), secrets (native + Gitleaks + history sweep), containers
  (Trivy + ECR Enhanced), IaC (Checkov), DAST (ZAP spec-driven vs **staging** +
  Nuclei) — reusable workflows, all SARIF.
- SBOM (CycloneDX) per build + SLSA provenance, attached to releases.
- AWS posture: Security Hub + GuardDuty + IAM Access Analyzer; **scope the OIDC
  deploy role** down from PowerUser + IAMFull; SOPS/Secrets-Manager audit.
- **Edge rate limiting** (the cheap layer of A10): AWS WAF rate-based rules on
  CloudFront + the ALB, managed rule groups (common exploits, bot control),
  optional Cloudflare in front of the website. The Redis-backed **application**
  rate-limit layer is Phase 20.
- **`helmet` on the API + strict CSP / HSTS / `frame-ancestors` on the web apps**;
  SRI on external scripts; mobile cert pinning (A12 #11, #14).
- **Multi-tenant isolation**: a Semgrep rule that every breeder query is
  kennel-scoped + a test; Postgres Row-Level Security evaluated as a backstop
  (implementation → Phase 20 if adopted) (A12 #26).
- Firmware: cppcheck + clang-tidy + CodeQL C++ + Flawfinder gates; Secure Boot v2
  + Flash Encryption **design doc** (rollout = Phase 19); **secure provisioning**
  (protocomm + proof-of-possession, QR-based — A12 #18); TLS-only MQTT +
  ACL-per-subtree + per-device publish rate limits in `prod`.
- Weekly automated security report + remediation SLA tracking.
- Remediate every Critical/High the first run surfaces.
- Schedule an external pen test once real customer data + devices are live
  (pairs with the Phase 8 legal review).

**Exit:** every repo has a green (or SLA-tracked) Security tab; a weekly report
lands in `smart-pet-docs/security/`; no Critical older than 7 days.

### Phase 19 — Firmware hardening & HIL · size L

| Task | Repo | Size |
|---|---|---|
| Secure Boot v2 + Flash Encryption: provisioning procedure, key custody, dev vs prod eFuse policy, recovery story; pilot one device type | SDK + firmware | L |
| OTA provenance: signed manifest with key-id + artifact SHA in the `firmware` row; device-side hash verify; SLSA attestation on the S3 `.bin` | `smart-pet-backend`, SDK, `smart-pet-ci` | M |
| Size-regression CI gate + `puncover` PR size report + `-fstack-usage` budget check | `smart-pet-ci`, SDK | M |
| HIL bench: self-hosted `hil` runner, one of each device, CI flash-on-`v*`, pytest MQTT harness asserting real actuator/sensor behaviour | new infra + `smart-pet-ci` | L |
| On-device memory guards: heap integrity checks in debug builds, task stack budgets, OOM-safe degradation | SDK + firmware | M |
| **Brown-out / power-loss resilience** — NVS commit discipline, config CRC + factory-default fallback, `esp_brownout` handler (A12 #15) | SDK + firmware | M |
| **Time trust** — persist last-known-good time, refuse schedule execution until time is trusted, clock-drift telemetry (A12 #16) | SDK + firmware | S |
| **Fleet kill switch** — retained `kennel/{k}/_control` safe-mode topic the SDK honours (stop actuators, keep reporting) + a dashboard "halt fleet" action (A12 #17) | SDK, `smart-pet-backend`, `backoffice-dashboard` | M |
| Fleet observability screen: version histogram, rollout progress, OTA failure rate, crash-free-by-version, rollback controls | `backoffice-dashboard` | M |

**Exit:** a device will not run unsigned firmware; OTA artifacts are attested end
to end; a hardware bench gates firmware releases; a bad rollout can be halted
fleet-wide in one action.

### Phase 20 — Traffic control, caching & resilience · size L

Depends on Phase 12's `modules/cache` (ElastiCache). Lands with or just before
the prod ×2 cutover.

| Task | Repo | Size |
|---|---|---|
| **Redis wired live** (staging/prod): connection module in `@jubasjl76-eng/shared`, health in `/ready`, in-memory fallback for local/dev | 4 service repos | S |
| **Application rate-limit stack** — `express-rate-limit` + `rate-limit-redis` (or `rate-limiter-flexible`), per-route-class token buckets: strict `/api/auth/*`, moderate `/api/public/*` (+ per-buyer inquiry dedupe), generous per-user `/api/breeder/*`; `429` + `Retry-After` + `RateLimit-*` (matches the P14 contract) | `smart-pet-backend`, `pet-iot-sensors-service` | M |
| **Cross-instance SSE fan-out** via Redis pub/sub — removes the single-instance limitation; verify `useStream` reconnect + resume | `smart-pet-backend` | M |
| **Leader-election lock** (Redis `SET NX PX` renewed, or a Postgres advisory lock) so exactly one instance runs `engineTick` / `fleetSweep` / `retentionSweep`; OR extract them into a **dedicated worker service** (one task, no ALB) (A12 #2) | `smart-pet-backend` | M |
| **Job queue + transactional outbox** — `pg-boss` (Postgres-backed) draining notifications / OTA fan-out / go-home-pack / weekly buyer emails / GDPR export+delete, with retry/backoff/DLQ (A12 #3) | `smart-pet-backend` | L |
| **Idempotency store** — `Idempotency-Key` → (key → response) in Redis/Postgres with TTL, on device claim / inquiry / feed / OTA trigger (A12 #4) | `smart-pet-backend` | M |
| **Circuit breakers** (`opossum`) around Resend / Twilio / MQTT publish / revalidate webhook / S3, with fallbacks + breaker metrics (A12 #5) | `smart-pet-backend` | M |
| **RDS Proxy** + tuned pool sizing per instance (`max` from `max_connections / instances`, timeouts, `statement_timeout`); pool gauges already on `/metrics` from P16 (A12 #1) | `smart-pet-terraform`, 4 service repos | M |
| **Table partitioning** by month for `access_log` / readings / `exceptions` so the Phase 8 retention sweep is `DROP PARTITION` (A12 #23) | `smart-pet-backend` | M |
| **MQTT broker limits** — EMQX per-client message-rate + connection-rate + max-inflight + max-packet-size; disconnect + alarm on breach (A10) | `smart-pet-terraform` | S |
| Feature-flag mechanism fleshed out (from the P12 seed) for gating the P14–P21 rollouts | `smart-pet-backend`, `backoffice-dashboard` | S |

**Exit:** the backend runs safely at ×2+ — one sweeper, shared rate limits,
cross-instance SSE, bounded outbound calls, a durable job queue; abusive traffic
gets `429`d at the edge and the app layer.

### Phase 21 — High availability, DR & load validation · size L

| Task | Repo | Size |
|---|---|---|
| **EMQX cluster depth** — ≥2 nodes with session persistence, split-brain policy, health checks; evaluate a clustered / RocksDB retained store vs the EFS contention point (A11) | `smart-pet-terraform` | M |
| **RDS read replica** for exports / growth-chart aggregation / GDPR export; route heavy reads to it (A11, A12) | `smart-pet-terraform`, `smart-pet-backend` | M |
| **OTA CDN hardening** — HTTP range-request / resumable OTA, immutable per-version paths, short-TTL `latest.json` per type+channel, staged-rollout-as-cache-warm (A11) | `smart-pet-backend`, SDK, `smart-pet-ci` | M |
| **ECS deploy safety** — deployment circuit breaker (auto-rollback), `minimumHealthyPercent`/`maximumPercent`, ≥2-AZ spread, autoscale on request-count-per-target + MQTT-ingest-lag (A11) | `smart-pet-terraform` | S |
| **Backup & DR** — cross-region RDS snapshot copy, S3 CRR for `firmware/` + `buyer-photos/`, RTO/RPO targets per data class, a `runbooks/dr.md`, a **quarterly restore drill** (A12 #19) | `smart-pet-terraform`, `smart-pet-docs` | M |
| **Load & capacity validation** — `k6` against the staging HTTP API + a scaled `smart-pet-simulator` run (~10k virtual devices) against staging MQTT; p99 + error-rate pass/fail thresholds in CI (A12 #24) | `smart-pet-ci`, `smart-pet-simulator` | L |
| **Cloudflare** in front of the website (proxied DNS): L3/4 DDoS, bot management, edge TLS (A11) | `smart-pet-terraform` / DNS | S |
| Key rotation drills — MQTT device-cred rotation, firmware signing-key rotation + revocation runbook (A12 #20) | SDK, `smart-pet-backend`, `smart-pet-docs` | S |

**Exit:** a single AZ or broker node loss is survivable; a documented,
drill-tested DR path exists; staging load tests pass at target scale before the
prod traffic ramp.

### Updated cross-cutting standards (extends dev-plan §4)

- **Repo boundaries:** contract/shared code ships as a versioned `@jubasjl76-eng/*`
  package; consumers depend on a range; the contract PR merges before consumer
  bumps; `REPOSITORIES.md` is authoritative.
- **Environments:** Local / Dev / Staging / Prod; one typed config contract;
  `config/index.ts` refuses to boot on a missing var; no plaintext secret in
  git, an image layer, or a task def; GH Environments gate deploy creds.
- **DX:** every repo has a devcontainer, Lefthook + the shared presets, an
  `.editorconfig`, a `CONTRIBUTING.md`; `task up` runs the local stack.
- **Every service:** OTel SDK, pino JSON logs with `trace_id`, `/metrics`,
  `/health` (liveness) + `/ready` (deps) + graceful SIGTERM shutdown,
  `@sentry/node`, a CycloneDX SBOM per build, non-root Dockerfile,
  `tsc --noEmit` + `vitest` green. No in-process `setInterval` scheduler without
  a leader lock or a dedicated worker.
- **Every REST surface:** zod schemas (from `@jubasjl76-eng/shared`), contributes to
  `/openapi.json`, versioned under `/api/v1`, rate-limited by route class,
  cursor-paginated list endpoints with a hard max page size, `Idempotency-Key`
  honoured on mutating routes.
- **Every outbound call** (email, SMS, webhook, S3, cross-service): wrapped in a
  circuit breaker with a fallback; retried with jittered exponential backoff on
  `429` / `5xx` / network error; never retried on a non-idempotent unkeyed POST.
- **Every PR (services):** format + lint + commitlint + gitleaks (hooks);
  Semgrep + `npm audit` gate + (weekly) CodeQL; Playwright E2E where a UI moves.
- **Every image:** Trivy scan, fail on fixable HIGH/CRITICAL, before ECR push.
- **Every firmware PR:** clang-format + cppcheck + clang-tidy + CodeQL C++ +
  native tests + sanitisers + Wokwi command-loop + size report.
- **Every release (`v*`):** SBOM + SLSA provenance attached; Sentry release
  created; firmware `.bin` signed + hash recorded; staging gate green.
- **Contract changes** regenerate downstream clients + C++ structs in the same
  PR (codegen, not hand-copy).

### Agent assignment

**Claude owns the entire hardening track (Phases 11–21), every repo** — including
`backoffice-dashboard`, `smart-pet-website`, and `smart-pet-app`. Cursor does
**not** pick up any hardening task. Cursor continues only product-feature work
per dev-plan §2a; when a hardening phase touches a web/app repo, Claude takes it
on a feature branch → PR, and Cursor holds product work on that repo until the
hardening PR merges (the "two agents, one working tree" hazard from Phase 3).

| Phase | Claude does (all repos) |
|---|---|
| 11 | GitHub Packages registry; publish `@jubasjl76-eng/mqtt-contract` + `@jubasjl76-eng/shared`; Renovate preset + `renovate.json` in every repo; `REPOSITORIES.md`; branch-protection script; adopt the contract package in every consumer incl. dashboard/website |
| 12 | `envs/staging`; config contract in `@jubasjl76-eng/shared` + service `config/index.ts`; SOPS+age; Secrets Manager rotation; GH Environments; align Vercel + EAS secret names; wire the config contract into dashboard/website/app |
| 13 | shared `@jubasjl76-eng/eslint-config` / `prettier-config` / `lefthook` / `.clang-format` / `ruff.toml` presets; base devcontainer image; `Taskfile` + root compose; `MOCKS.md`; adopt Lefthook + presets + devcontainer + `CONTRIBUTING.md` in every repo incl. dashboard/website/app |
| 14 | zod + OpenAPI + `/api/v1` + AsyncAPI + CI codegen (TS client, C++ structs); adopt the generated client in the dashboard + app; Starlight docs |
| 15 | `@sentry/node` ×4 services; firmware crash path + consumer; CI release wiring; `@sentry/react` (dashboard), `@sentry/nextjs` (website), `@sentry/react-native` (app) |
| 16 | OTel + pino + `/metrics` ×4; `traceparent` in the envelope; Grafana + dashboards-as-code in Terraform; device memory telemetry; DB pool + circuit-breaker metrics; cost budgets; runbooks + status page; Sentry replay/vitals review; fleet dashboard consumption |
| 17 | firmware GoogleTest + coverage + sanitisers + Wokwi command-loop + contract test; API conformance tests; reusable CI workflows; **Playwright** (dashboard + website); **Maestro + RNTL** (app) |
| 18 | backend/firmware/IaC scanners + reusable security workflows + report pipeline; OIDC role scoping; AWS posture; WAF edge rate-limiting; Secure Boot + secure-provisioning design; kennel-scope Semgrep rule; dashboard/website dependency + SAST + DAST wiring; `helmet`/CSP/HSTS; fix web findings |
| 19 | Secure Boot + Flash Encryption rollout; OTA provenance; HIL bench + runner; size gates; memory guards; brown-out + time-trust; kill-switch topic; fleet observability + "halt fleet" screen |
| 20 | Redis wiring; app rate-limit stack; cross-instance SSE; leader lock / worker service; `pg-boss` queue + outbox; idempotency store; circuit breakers; RDS Proxy + pool tuning; table partitioning; EMQX limits; generated-client `429`/backoff consumption + rate-limit UX + flag-gated rollouts in the dashboard |
| 21 | EMQX cluster depth; RDS read replica + read routing; OTA CDN hardening; ECS deploy safety; cross-region backup + DR runbook + restore drill; `k6` + 10k-device load test; Cloudflare (incl. website); key-rotation drills; load-test the dashboard critical paths |

Rules: one repo at a time; feature branch → PR to the repo's integration branch;
contract/backend PR merges before the consumer PR.

---

## Part C — Security Audit & Scanning Phase (detailed)

**Goal:** produce and continuously regenerate a **full, evidence-backed security
report across every repo including firmware**, with tracked remediation.

### C1. Scope

All ~14 repos: 4 Node services, 2 web frontends, 1 Expo app, the MQTT contract,
the device SDK, 3 firmware repos, the Terraform repo, the CI repo, the
`@jubasjl76-eng/*` packages. Plus the running AWS `dev`, `staging` and `prod`
environments and the MQTT broker.

### C2. Scanner matrix

| Class | Tool | Target | Trigger | Gate |
|---|---|---|---|---|
| SAST semantic | **CodeQL** (JS/TS, C/C++) | all code repos | PR + weekly | PR: no new Critical/High |
| SAST fast + custom rules | **Semgrep** (+ project ruleset) | all code repos | every PR | PR: no new High |
| Dep vulnerabilities | **Dependabot** alerts + PRs | all | continuous | — |
| Dep audit gate | **`npm audit --audit-level=high`** + allowlist | Node repos | every PR | PR: fail on non-allowlisted High+ |
| Dep polyglot | **OSV-Scanner** | Node + `platformio.ini` libs + Python HIL | PR + weekly | weekly review |
| Malicious packages | **Socket.dev** (optional) | Node repos | PR | advisory |
| Secrets (push) | **GitHub Secret Scanning + Push Protection** | all, org-wide | push | block push |
| Secrets (CI + history) | **Gitleaks** | all; one full-history sweep | every PR + one-off | PR: fail on any hit |
| Container image | **Trivy** (vulns + secrets + misconfig) | every Dockerfile / image | pre-ECR-push | fail on fixable HIGH/CRITICAL |
| Container runtime rescan | **ECR Enhanced Scanning** (Inspector) | `prod` images | continuous | Security Hub finding |
| IaC misconfig | **Checkov** (+ `trivy config`) | `smart-pet-terraform`, Dockerfiles | PR + weekly | PR: no new High |
| DAST passive | **OWASP ZAP baseline** | compose stack | nightly | report |
| DAST active + auth | **ZAP full scan, `-f openapi`** | `staging` deploy | pre-release + weekly | release: no new High |
| DAST templates | **Nuclei** | `dev` (and `prod` read-only checks) | weekly | report |
| Firmware static | **cppcheck** (+MISRA), **clang-tidy** (cert/bugprone/security), **Flawfinder** | SDK + firmware repos | every firmware PR | PR: no new error-severity |
| Firmware semantic | **CodeQL C/C++** | SDK + firmware repos | PR + weekly | PR: no new Critical/High |
| Cloud posture | **Security Hub** + **GuardDuty** + **IAM Access Analyzer** | AWS `dev` + `prod` | continuous | triage weekly |
| SBOM | **CycloneDX** (npm + Trivy) | every build | per build | attached to release |
| Provenance | **SLSA attestation** (`actions/attest-build-provenance`) | images + firmware `.bin` | per release | verify on deploy |

### C3. Normalisation & aggregation

Every tool emits **SARIF**. SARIF uploads to the GitHub `code-scanning` API →
per-repo Security tab + org Security Overview. A reusable workflow
`smart-pet-ci/.github/workflows/security-report.yml`:

1. runs the full C2 battery across all repos on a weekly schedule (and on
   demand),
2. pulls every repo's code-scanning + Dependabot + secret-scanning alerts via
   the GitHub API,
3. pulls Security Hub findings via the AWS API,
4. collates into one report: totals by severity, **week-over-week delta**, new
   vs resolved, **SLA-breach list**, top 10 by risk, firmware section, cloud
   section,
5. renders Markdown + HTML, posts a summary to a channel, commits the full
   report to `smart-pet-docs/security/YYYY-Www.md`.

### C4. Remediation SLAs

| Severity | Fix within | Escalation |
|---|---|---|
| Critical | 7 days | named owner day 1; blocks the next release if open at cut |
| High | 30 days | in the weekly report until closed |
| Medium | 90 days | tracked; batched |
| Low | best effort | tracked; no deadline |

An accepted-risk needs a written justification in
`smart-pet-docs/security/exceptions.md` with an expiry date; expired exceptions
re-open as findings.

### C5. Firmware-specific audit

- Static: the cppcheck + clang-tidy + CodeQL C++ + Flawfinder gate on every
  firmware PR, results in the weekly report's firmware section.
- Memory: ASan/UBSan/Valgrind on the host build; on-device heap + stack
  telemetry reviewed for leak trends per release.
- Supply chain: OSV-scan the pinned `platformio.ini` lib list; manual watch of
  the Espressif advisory feed; record the toolchain commit in each release.
- Boot chain: **Secure Boot v2** (RSA-3072) + **Flash Encryption** design doc in
  this phase (eFuse policy, key custody, dev vs prod, recovery); rollout in
  Phase 19. A device must reject unsigned firmware from OTA *and* physical flash.
- OTA integrity: signed manifest, device verifies artifact SHA-256 before apply,
  signing-key id + hash recorded server-side, SLSA attestation on the published
  `.bin`.
- Transport: `prod` MQTT is TLS-only (8883); per-device credentials (minted on
  claim, already built); broker ACL scopes each device to
  `kennel/{k}/{type}/{deviceId}/#`; scheduled credential rotation; publish
  rate-limits.

### C6. Cloud & IAM audit

- Checkov on every `terraform plan`; fail the PR on new High misconfig.
- Enable Security Hub (CIS + AWS Foundational Security Best Practices standards),
  GuardDuty, IAM Access Analyzer in `dev` and `prod`.
- **Scope the OIDC deploy role**: replace PowerUserAccess + IAMFullAccess on
  `gha-terraform` with a least-privilege policy; keep `gha-deploy-<service>`
  roles already scoped (ECR push + `ecs:*` deploy + `iam:PassRole` on
  `smart-pet-<env>-*`).
- Verify: RDS encryption at rest + in transit, S3 public-access-block on every
  bucket, CloudTrail on (org trail), VPC flow logs, ALB + WAF access logs,
  Secrets Manager for every secret (no plaintext in task defs / tfvars /
  user-data — the historical failure mode).

### C7. Application audit (services + web)

- SAST findings triaged and fixed to SLA.
- ZAP spec-driven active scan against `staging` before every release: auth,
  injection, SSRF, access control (every `/api/breeder/*` route enforces
  `auth` + `withKennel` — Semgrep rule + ZAP auth matrix confirm it), rate
  limiting, security headers (`helmet`), CORS, cookie flags.
- Dependency + container gates green or SLA-tracked.
- **Rate-limit + abuse controls verified** (A10): a test that `/api/auth/*` and
  `/api/public/*` return `429` + `Retry-After` under burst; WAF rate-based rules
  active on CloudFront + ALB; EMQX per-client limits set.
- **Multi-tenant isolation verified** (A12 #26): the kennel-scope Semgrep rule
  passes and a cross-kennel access test is red-then-green.
- Session replay / error PII scrubbing verified against the Phase 8 privacy
  rules before Sentry is enabled in `prod`.

### C8. Reporting cadence & sign-off

- **Weekly:** automated report to `smart-pet-docs/security/`.
- **Per release:** security gate check (no open Critical, no new High from the
  release DAST) recorded in the release checklist.
- **Quarterly:** a written review of exceptions, SLA performance, and posture
  trend.
- **Once real customer data + devices are live:** commission an external
  penetration test (web + API + a device sample) and a firmware security review;
  fold findings back in as tracked items.

### C9. Phase 18 exit criteria

1. Every repo has SAST + dependency + secret + (where applicable) container +
   IaC + firmware-static scanning wired and passing or SLA-tracked.
2. `/openapi.json`-driven DAST runs against `staging` and is clean of new High+.
3. SBOM + provenance attached to every release artifact.
4. AWS Security Hub score baselined; OIDC deploy role scoped; no plaintext
   secrets anywhere.
5. The weekly automated report is running and committed for at least two cycles.
6. Zero open Critical findings; every High has an owner and an SLA date.
7. Secure Boot / Flash Encryption design doc reviewed and approved (rollout
   tracked into Phase 19).
