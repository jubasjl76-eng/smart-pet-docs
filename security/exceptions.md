# Security exceptions — accepted risk register

Phase 18 (Part C · C4). Every entry is a finding we've consciously **not** fixed,
with a reason and an **expiry**. An expired entry re-opens as a live finding in
the weekly report. Keep newest first.

| Field | Meaning |
|---|---|
| Finding | package / advisory / CWE |
| Repos | where it shows up |
| Severity | as scored by the scanner |
| Reason | why it's accepted for now |
| Expiry | re-evaluate by this date |
| Owner | who re-evaluates |

---

## EX-0001 — Expo SDK 55 build-time tooling advisories

- **Finding:** `@expo/config-plugins` and its dependents (`@expo/config`,
  `@expo/cli`, `@expo/metro-config`, `@expo/prebuild-config`,
  `@expo/local-build-cache-provider`, `xcode`, `uuid`, `image-size`, `metro*`)
  — a cluster of ~20 `npm audit` advisories (16 moderate, 4 high) pulled in
  transitively by `expo` → `@sentry/react-native`.
- **Repos:** `smart-pet-app`
- **Severity:** high (max)
- **Reason:**
  - `npm audit fix` has already cleared the app's genuinely fixable runtime
    advisories (37 → 20): `axios`, `form-data`, `ws`, `yaml`, `shell-quote`,
    `brace-expansion`, `on-headers`, …
  - For the residual, npm's only proposed fix is `expo@46.0.21` — a **9-major
    downgrade** from the pinned SDK 55. That is breakage, not remediation.
  - The affected packages are **build / prebuild / bundler tooling** that runs
    on the developer machine and in EAS builds — they are **not shipped in the
    app bundle**, so the runtime attack surface on end-user devices is
    effectively nil.
  - Expo SDK 55 is bleeding edge; the patched `@expo/config-plugins` line lands
    in an SDK 55 patch or SDK 56.
- **Mitigation:** EAS build environment is trusted and ephemeral; no untrusted
  input reaches these tools during a build.
- **Expiry:** 2026-12-10 (or the next Expo SDK bump, whichever is first) —
  re-run `npm audit --omit=dev` then; drop this entry if clear.
- **Owner:** jubasjl76-eng

## EX-0002 — `@react-navigation` → `query-string` → `decode-uri-component`

- **Finding:** `decode-uri-component` DoS via exponential decoding
  ([GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)),
  reached through `@react-navigation/*` → `query-string`.
- **Repos:** `smart-pet-app`
- **Severity:** moderate
- **Reason:** `fixAvailable: false` — upstream `@react-navigation` has not
  bumped `query-string`. Deep-link / URL parsing in the app only ever sees our
  own generated links, not attacker-controlled percent-encoded input.
- **Expiry:** 2026-12-10 — re-check for an upstream `@react-navigation` release.
- **Owner:** jubasjl76-eng
