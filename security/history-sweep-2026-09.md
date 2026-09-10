# Gitleaks full-history sweep — 2026-09-10

Phase 18 (Part C · C2). One-off deep scan of **every ref, full history** of all
18 repos (`gitleaks git --log-opts="--all --full-history"`, gitleaks 8.30.1,
default ruleset). The per-PR `security.yml` gitleaks job only sees PR-diff
commits; this is the baseline pass over everything ever committed.

## Result

| Repo | Commits scanned | Findings |
|---|---:|---:|
| smart-pet-backend | 155 | **2** (both benign — see below) |
| backoffice-dashboard | 55 | 0 |
| smart-pet-website | 30 | 0 |
| smart-pet-app | 33 | 0 |
| pet-iot-camera-service | 30 | 0 |
| pet-iot-edge-gateway | 28 | 0 |
| pet-iot-sensors-service | 35 | 0 |
| smart-pet-mqtt | 19 | 0 |
| smart-pet-api-client | 8 | 0 |
| smart-pet-shared | 7 | 0 |
| smart-pet-simulator | 15 | 0 |
| smart-pet-device-sdk | 34 | 0 |
| smart-feeder | 19 | 0 |
| smart-water-dispenser | 14 | 0 |
| gps-dog-collar | 17 | 0 |
| smart-pet-terraform | 29 | 0 |
| smart-pet-ci | 52 | 0 |
| smart-pet-docs | 33 | 0 |

**17 / 18 repos clean.** No live credential was ever committed to any repo.

## smart-pet-backend — the two findings

### 1. `TESTING.md:8` — `jwt` (commit `f45744aa`, 2026-03-14)

A doc file from the pre-hardening **MongoDB** architecture:

```
## Marco's Account
Email: marco@test.com  Password: test123
## Test Token
eyJ...  (JWT)
```

- The JWT payload is `{"userId":"69b583a5294b955672 52c11b", "iat":…, "exp":1776095397}`.
  `exp` = **2026-04-11** — expired five months before this sweep. `jwt.verify`
  rejects it.
- `userId` is a Mongo ObjectId; the current backend is Postgres with UUID keys —
  that user does not exist in any live schema.
- Signed with a March-2026 local dev secret; production `JWT_SECRET` was rebuilt
  in Phase 12 (SOPS/age).

**Risk: none.** Dead token, dead account, dead schema, dead signing key.

**Action:** `TESTING.md` deleted on `development` ([backend#57](https://github.com/jubasjl76-eng/smart-pet-backend/pull/57)).
The historical commit is pinned in `.gitleaksignore` — a `git filter-repo`
rewrite of a public repo is not warranted for an expired example token.

### 2. `src/__tests__/privacy.test.ts:35` — `generic-api-key`

False positive. The `generic-api-key` rule fired on the string literal
`'009_access_log.sql'` inside a list of migration filenames in a test fixture.

**Action:** `// gitleaks:allow` on the line; historical commit pinned in
`.gitleaksignore`.

## Follow-up

- The weekly `security.yml` cron already re-runs gitleaks on full history; with
  `.gitleaksignore` in place the backend job stays green.
- No `git filter-repo` / BFG history rewrite is planned. If a *live* secret is
  ever found, that changes — rotate first, then rewrite, then force-push and
  invalidate every clone/fork.
