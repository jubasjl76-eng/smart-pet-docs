# ADR-0001 — Polyrepo with published contract packages

**Status:** Accepted · **Date:** 2026-09-09 · **Deciders:** jubasjl76-eng
**Context phase:** Hardening Phase 11 (`SMART-PET-HARDENING-PLAN.md` A7)

## Context

Smart Pet is ~14 repos across web, mobile, backend services, an MQTT contract, a
C++ firmware SDK, three firmware apps, IaC, and CI. Shared code is currently
**hand-copied**: the MQTT contract lives in `smart-pet-mqtt/src/{topics,payloads}.ts`
and is mirrored by hand into `smart-pet-device-sdk` (C++ `spd_topics.h`) and
vendored as subsets into `pet-iot-edge-gateway` and `smart-pet-simulator`. Web
formatters (status → label, date formatting) are duplicated between
`backoffice-dashboard` and `smart-pet-website`.

`v1.0.0` shipped. The hardening track needs a decision on repository structure
before the API-contract, codegen, and shared-schema work (Phases 12–14) can
land somewhere sane.

## Decision

**Stay polyrepo. Add versioned `@jubasjl76-eng/*` packages (GitHub Packages,
private) for shared code. Generate — never hand-copy — cross-language artifacts
from the OpenAPI / AsyncAPI specs.**

## Alternatives considered

### A. Full monorepo (Nx / Turborepo + Bazel for firmware)

Rejected.

- The two-agent workflow depends on **physical repo isolation**. Phase 3 failed
  precisely when two agents edited one working tree. A monorepo reintroduces
  that; clawing back safety needs worktrees + path CODEOWNERS + affected-graph
  CI — work to regain what polyrepo gives for free.
- Firmware (PlatformIO, per-repo `#<commit>` pins, Wokwi, HIL) gains nothing
  from a JS monorepo tool; the result is a JS monorepo *plus* separate firmware
  repos regardless.
- Four independent release cadences (Vercel continuous / backend on
  `development` / firmware on `v*` staged rollout / Terraform on `main`) fight a
  shared version.
- `smart-pet-ci` reusable workflows already removed the main polyrepo tax
  (duplicated CI config).
- `v1.0.0` is live; a migration now is cost with no user-facing benefit.

### B. Polyrepo, keep hand-copying

Rejected. The manual C++/TS contract sync is a standing source of drift
(`SMART-PET-DEV-PLAN.md` §4 calls it out); it has already caused a broken build
when a branch pin went stale.

### C. Polyrepo + published contract packages + codegen — **chosen**

- ~80% of a monorepo's code-sharing benefit; cost is one `npm publish` step per
  contract change.
- `smart-pet-mqtt` is already shaped as a library (`main`, `types`,
  `files: [dist, docs]`); publishing it is a small change.
- OpenAPI + AsyncAPI (Phase 14) become the source of truth; CI generates the TS
  client, TS MQTT types, and the C++ structs/topic strings — the manual mirror
  is deleted.
- Keeps repo isolation intact for the agent workflow.

### D. Partial workspace for the web cluster

Deferred, not rejected. `backoffice-dashboard` + `smart-pet-website` +
`@jubasjl76-eng/*` could later become one Turborepo (both Cursor-owned → no
collision risk). A future ADR if/when it earns its keep.

## Consequences

- New: a private GitHub Packages npm registry; `@jubasjl76-eng/mqtt-contract`
  published from `smart-pet-mqtt`; `@jubasjl76-eng/shared` (Phase 12) and
  `@jubasjl76-eng/api-client` (Phase 14) added later.
- Consumers depend on a semver range and take Renovate bump PRs; they must not
  vendor a copy to get ahead of a release.
- The "contract PR merges before the consumer PR" rule (already in
  `SMART-PET-DEV-PLAN.md` §2a) now also means "and is published before".
- Protobuf was considered for the wire format and rejected: the system is
  JSON-over-MQTT / JSON-over-HTTP end to end, payloads must stay
  eyeball-debuggable (`mosquitto_sub`, the simulator panel), and ArduinoJson v7
  is already on the device. Type-safety comes from types generated off the
  specs' JSON Schema, not a binary format.
