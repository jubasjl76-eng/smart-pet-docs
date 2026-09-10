# Operator actions

Everything on the hardening track that needs **you** — an account, a payment
method, real cloud credentials, a hardware decision, or a console setting Claude
can't reach. Claude has written (or will write) all the code, IaC and CI around
each item; these are the gaps only you can close.

Ordered by when it starts to block work. Each item says **what**, **why**,
**how**, and **then Claude** (what unblocks once it's done).

Status key: ☐ not started · ◐ partly done · ☑ done

---

## Already done

- ☑ **Renovate GitHub App** installed + configured for the org.
- ☑ **Branch protection** applied to all 17 repos (`smart-pet-ci/scripts/apply-branch-protection.sh`).
- ☑ **`smart-pet-docs` → GitHub Pages** — repo created, Pages enabled (`build_type: workflow`), site live at <https://jubasjl76-eng.github.io/smart-pet-docs/>.
- ☑ All contract packages published (`@jubasjl76-eng/mqtt-contract`, `/shared`, `/api-client`).

---

## A · Now — unblocks Phase 15 (error tracking), already in flight

### A1 ☐ Sentry — account + one project per app

**Why:** the SDK is already wired into **all 4 Node services + the dashboard +
the app** (`src/instrument.ts`, no-op until a DSN is set). The website slice
is written but not merged (see A3). All of it stays dormant until you create
the org + DSNs.

**How:**
1. Create a Sentry org (SaaS free tier is fine): <https://sentry.io/signup/>.
2. Create these **projects** (platform in brackets):
   - `smart-pet-backend` (Node) · `pet-iot-edge-gateway` (Node) ·
     `pet-iot-sensors-service` (Node) · `pet-iot-camera-service` (Node)
   - `backoffice-dashboard` (React) · `smart-pet-website` (Next.js) ·
     `smart-pet-app` (React Native)
   - `smart-pet-firmware` (Native / other) *(Phase 19)*
3. Copy each project's **DSN** (Settings → Client Keys).
4. Put the DSN where each app reads env (var names are in each repo's
   `.env.example`):
   - **Node services (dev, local):** `SENTRY_DSN=` in each repo's `.env`
   - **Node services (staging/prod):** a GitHub **Environment** secret
     `SENTRY_DSN` per repo per tier (`dev` / `staging` / `prod`), plus
     `SENTRY_ENVIRONMENT` = the tier name
   - **dashboard:** build env `VITE_SENTRY_DSN`
   - **website:** Vercel env `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_DSN` server-side)
   - **app:** `.env` / EAS secret `EXPO_PUBLIC_SENTRY_DSN`

**Then Claude:** flips nothing — the SDKs pick the DSN up on the next deploy.
Confirms events land with a one-off test error.

### A3 ◐ Website Sentry — blocked on Cursor's working tree

The `@sentry/nextjs` wiring for `smart-pet-website` is written and verified
(`sentry.{server,edge}.config.ts`, `src/instrumentation*.ts`,
`global-error.tsx`, `withSentryConfig` in `next.config.ts`) but **not
committed** — the repo's working tree had uncommitted Cursor product work when
Claude got there (the `<Button>` → plain `<a>` refactor in `error.tsx` /
`not-found.tsx` / litters pages). Per the two-agents-one-tree rule, Claude
backed its changes out rather than bundle them.

**You:** have Cursor commit or shelve that work, then tell Claude — it re-applies
the Sentry slice on a clean branch (patch saved). Or say "go" and Claude will
land it alongside, accepting the merge with Cursor's next push.

### A2 ☐ Sentry — CI release + source-map upload (Phase 15 tail)

**Why:** to get readable stack traces (un-minified) and per-release
regression tracking on `v*` tags.

**How:** create an **org-level GitHub Actions secret** (not per-repo):
- `SENTRY_AUTH_TOKEN` — Sentry → Settings → Auth Tokens, scopes
  `project:releases` + `org:read`
- `SENTRY_ORG` — your org slug

**Then Claude:** adds a `sentry-cli releases` step to `smart-pet-ci`'s
release / `deploy-ecs` workflows and the Vite/Next/EAS build configs.

---

## B · AWS — one-time, unblocks staging & prod deploys (Phases 12, 16, 18, 20, 21)

Nothing here is needed for local dev (Docker compose covers that). It's the
gate for a real `dev` → `staging` → `prod` cloud.

### B1 ☐ AWS account + a credential for Terraform

**Why:** `smart-pet-terraform` is written and `validate`-clean but has never
been `apply`-d — that needs real credentials.

**How:** an AWS account (or a dedicated sub-account per the org's setup) and,
locally, either `aws configure` with an admin-ish IAM user or SSO
(`aws sso login`). Region: pick one and tell Claude (the tfvars default to
`us-east-1` unless changed).

### B2 ☐ Terraform apply — bootstrap → dev → staging → prod

**Why:** creates the state bucket, then each environment's VPC / RDS / ECS /
ALB / broker / ElastiCache.

**How** (from `smart-pet-terraform/`):
```bash
cd bootstrap && terraform init && terraform apply           # state bucket + lock table, once

cd ../envs/dev     && terraform init && terraform apply -var-file=dev.tfvars
cd ../envs/staging && terraform init && terraform apply -var-file=staging.tfvars
cd ../envs/prod    && terraform init && terraform apply -var-file=prod.tfvars   # Multi-AZ, deletion protection — do last
```
Review each `plan` before `apply`. `prod` is expensive (Multi-AZ RDS, NAT/AZ,
EMQX ×2) — only apply when you're ready to run it.

**Then Claude:** turns on `terraform plan` in CI (currently off — "needs real
credentials"), and the `deploy-ecs` workflows go live.

### B3 ☐ Per-environment deploy secrets

**Why:** the deploy workflows assume-role into AWS via OIDC.

**How:** after B2, read the OIDC role ARNs from
`terraform output gha_deploy_role_arns` and set, **per GitHub Environment**
(`dev` / `staging` / `prod`) on every deployable repo:
- `DEPLOY_ROLE_ARN` = that tier's role ARN
- `AWS_REGION` = your region

### B4 ◐ GitHub Environments on the remaining services

**Why:** `smart-pet-backend` + `pet-iot-sensors-service` already have
`dev` / `staging` / `prod`; `pet-iot-edge-gateway` + `pet-iot-camera-service`
don't.

**How:** for each, Repo → Settings → Environments → create `dev`, `staging`,
`prod`; on `prod` add **yourself as a required reviewer** and (optional) a
wait timer.

### B5 ☐ AWS Secrets Manager — the secret values

**Why:** ECS task defs pull `JWT_SECRET`, `PG_PASSWORD`, provider keys from
Secrets Manager at runtime (`modules/secrets` + `secret_refs`).

**How:** after B2, for each service × env create/populate the secret entries
(names are in `ENVIRONMENTS.md` and the module). Generate strong values
(`openssl rand -base64 48` for `JWT_SECRET`). Turn on rotation for the DB
secret + the app secret.

### B6 ☐ SOPS + age — the encryption key

**Why:** git-committed **non-prod** config (`*.enc.yaml`) is encrypted with
`age`; `SOPS_AGE_KEY` is the one static CI secret.

**How:**
```bash
age-keygen -o age.key                 # keep age.key OFFLINE (1Password / a USB)
# public key (age1...) → commit to smart-pet-ci/sops/.sops.yaml  (Claude wires this)
```
Then set `SOPS_AGE_KEY` (the **private** key contents) as an org-level GitHub
Actions secret, and share it with the team via your password manager.

**Then Claude:** encrypts the non-prod secrets files and switches the config
load path to decrypt-on-boot in CI/compose.

### B7 ☐ Domain + DNS (staging & prod)

**Why:** the `dns` module (Route53 zone + wildcard ACM) is disabled without a
domain; the website (Vercel) and API (ALB / Cloudflare) need real hostnames.

**How:** register or delegate a domain, tell Claude the apex + the
per-tier subdomains you want (e.g. `api.staging.…`, `mqtt.…`, `app.…`). If you
adopt Cloudflare (see H1) DNS lives there instead of Route53.

---

## C · Mobile app (`smart-pet-app`) — when it's de-deferred

The repo is currently **deferred** and Cursor-owned for product work. When you
decide to build it out, these come first.

### C1 ☑ Expo / EAS project

Done — `app.json` already carries `extra.eas.projectId`
(`6af745ed-…`, owner `marcofolgado76`) and `eas.json` has
`development` / `preview` / `production` profiles.

### C2 ☐ EAS secrets / env

`EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_API_BASE_URL` per profile, and any
provider keys — `eas secret:create` or the Expo dashboard. For Sentry
source-map upload also add `SENTRY_AUTH_TOKEN` (+ `SENTRY_ORG`,
`SENTRY_PROJECT`) as EAS secrets.

Also: `smart-pet-app`'s `build.yml` CI needs an `EXPO_TOKEN` repo secret to run
`eas build` (already referenced by the workflow).

### C3 ☐ Store accounts (only for store builds / submissions)

- **Apple Developer Program** ($99/yr) — bundle id, provisioning, an App
  Store Connect app record; `eas credentials` manages the signing assets.
- **Google Play Console** ($25 once) — package name, a service-account JSON
  for `eas submit`.

Not needed for internal `eas build --profile development` on a simulator.

---

## D · Website (`smart-pet-website`) — Vercel

### D1 ◐ Vercel project + env vars

**Why:** it's a Next.js app; Vercel is its deploy target (per the plan).

**How:** import the repo into Vercel; set env vars per environment:
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_API_BASE_URL` (the public marketing API — `/api/public/*`)
- `WEBSITE_REVALIDATE_SECRET` (matches the backend's, for ISR refresh)

Align the Vercel env-var names with `ENVIRONMENTS.md` §"align Vercel + EAS
secret names".

---

## E · Observability (Phase 16)

### E1 ☐ Grafana Cloud

**Why:** metrics + dashboards-as-code (Terraform) + trace/log correlation.

**How:** a Grafana Cloud account (free tier: 10k series, 50 GB logs). Create a
stack; generate an **API token** (MetricsPublisher + a Terraform-provider
token). Give Claude the stack URL + tokens (as GitHub Environment secrets:
`GRAFANA_URL`, `GRAFANA_TOKEN`, and the Prometheus remote-write creds).

### E2 ☐ Alert destination

A place for alerts to land: a PagerDuty / Opsgenie free account, or just a
Slack incoming webhook / an email list. Tell Claude the target; it wires the
SNS → destination and the Grafana contact point.

### E3 ☐ Status page (optional)

A hosted status page (e.g. a free Better Stack / Instatus) or accept the
self-hosted static page Claude can generate. Decision only.

---

## F · Security (Phase 18)

### F1 ☐ GitHub code scanning

All repos are **public**, so CodeQL default setup is free. Enable it: Org →
Settings → Code security → "Enable all" for CodeQL default setup (or Claude
adds the workflow per repo — say which you prefer).

### F2 ☐ Scanner accounts (optional — OSS works without)

- **Semgrep** — the OSS CLI runs in CI with no account; Semgrep AppSec
  Platform (free for small teams) adds a findings dashboard + PR comments.
- **Snyk** — optional, overlaps OSV/Trivy which Claude wires for free.

### F3 ☐ Security contact / disclosure inbox

An email (e.g. `security@yourdomain`) for `SECURITY.md`. Decision + the
address.

---

## G · Firmware hardening (Phase 19) — hardware & keys

### G1 ☐ Firmware signing keypair

**Why:** OTA images are signed; the device verifies before applying.

**How:** generate the keypair **offline** (`espsecure.py generate_signing_key`
or an ECDSA P-256 key). The **private key** goes in AWS Secrets Manager (CI
signs there) or an offline HSM — never in git. Commit the **public key** into
`smart-pet-device-sdk`. Claude wires the signing step + the on-device verify.

### G2 ☐ Secure Boot + Flash Encryption — go / no-go

**Why:** this **burns eFuses** on real hardware — irreversible, and it
complicates the dev loop. It's a product decision.

**How:** decide whether v1 hardware ships with it. If yes: you need a
**provisioning jig** (a bench setup that flashes + burns each unit) and to
accept that a mis-provisioned board is bricked. Claude writes the
provisioning scripts + the CI gates; the decision and the jig are yours.

### G3 ☐ HIL (hardware-in-the-loop) bench

**Why:** Wokwi covers logic in CI; HIL catches real-radio / real-power / real
-sensor issues.

**How:** a small always-on host (a Pi or a mini-PC) with one of each device
wired to it, on your network, running the HIL runner Claude builds. Physical
setup + the host are yours.

---

## H · Traffic control & HA (Phases 20–21)

### H1 ☐ Cloudflare account

**Why:** edge WAF + rate-limiting (Phase 18/20), CDN + DNS (Phase 21).

**How:** a Cloudflare account; move the domain's nameservers to it (or use a
subzone). Create an API token (Zone: DNS edit, Firewall edit). Give Claude
the token + zone id as GitHub secrets. If you'd rather stay all-AWS, say so —
Claude falls back to AWS WAF on the ALB (already in the plan) and Route53.

### H2 ☐ Cross-region backup

Pick a **second AWS region** for RDS snapshot copy + the firmware/S3 backup.
Decision only; Claude writes the replication + the DR runbook, and you run the
first **restore drill** with Claude.

### H3 ☐ k6 Cloud (optional)

OSS `k6` runs in CI / locally for the 10k-device load test. k6 Cloud only if
you want the hosted result history + higher VU counts.

---

## Quick reference — secrets by home

| Secret | Where it lives | Set by |
|---|---|---|
| `SENTRY_DSN` (per app) | `.env` (dev) · GitHub Environment secret (services) · Vercel/EAS env (UI) | A1 |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` | org-level GitHub Actions secret | A2 |
| `DEPLOY_ROLE_ARN`, `AWS_REGION` | GitHub Environment secret, per repo per tier | B3 |
| `JWT_SECRET`, `PG_PASSWORD`, provider keys | AWS Secrets Manager (runtime) | B5 |
| `SOPS_AGE_KEY` | org-level GitHub Actions secret; private key file offline | B6 |
| `GRAFANA_URL`, `GRAFANA_TOKEN`, remote-write creds | GitHub Environment secret | E1 |
| `CLOUDFLARE_API_TOKEN`, zone id | GitHub secret | H1 |
| Firmware signing **private** key | AWS Secrets Manager / offline HSM | G1 |
| `WEBSITE_REVALIDATE_SECRET` | backend Secrets Manager **and** Vercel env (must match) | D1 |
