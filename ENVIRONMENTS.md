# Smart Pet — Environments, Config & Secrets

**Date:** 2026-09-09 · Reference for `SMART-PET-HARDENING-PLAN.md` A8. What runs
where, how config is shaped, and where every kind of secret lives.

## Four tiers

| Tier | Purpose | Infra | Deploy trigger | Data |
|---|---|---|---|---|
| **Local** | daily dev | `docker compose` on the laptop | n/a | seeded / ephemeral |
| **Dev** | always-on integration | `smart-pet-terraform/envs/dev` (single NAT, `db.t4g.micro`) | merge to `development` | synthetic, resettable |
| **Staging** | prod-shaped pre-prod: DAST target, Playwright smoke, RC-firmware broker | `envs/staging` (prod topology, one task/service, single-AZ DB, Redis no replica) | tag `v*-rc.N` | anonymised prod-like |
| **Prod** | live | `envs/prod` (Multi-AZ, autoscale, WAF, deletion protection) | tag `v*` + **required reviewer** | real; strict access |

`envs/staging` state key is `staging/terraform.tfstate`. All three cloud tiers
share the account-global GitHub OIDC provider (created by `envs/dev`).

## Config contract

Every Node service loads config from **one zod schema over `process.env`** via
`@jubasjl76-eng/shared` `loadConfig()`. Importing the config module validates at
boot; a missing/invalid var prints **every** problem and `process.exit(1)`.
Schemas are grouped in three sections:

| section | examples | source |
|---|---|---|
| **public build-time** | API base URL, feature flags, public keys, ports | committable per-env |
| **runtime non-secret** | pool sizes, timeouts, tick intervals, thresholds | per-env files; SOPS-encryptable |
| **secret** | DB URL / creds, JWT keyset, provider API keys, signing keys | Secrets Manager (runtime) / SOPS+age (git non-prod) |

`redact(config, SECRET_KEYS)` is used to log the resolved config at boot.

## Secrets by surface

| Surface | Mechanism |
|---|---|
| Local dev | `.env` (git-ignored) from `.env.example`; team-shared secrets via **SOPS + age** (`smart-pet-ci/sops/`) |
| Git-committed non-prod config | **SOPS + age** `*.enc.yaml`; `SOPS_AGE_KEY` is the only static CI secret |
| Cloud runtime (dev/staging/prod) | **AWS Secrets Manager**, referenced by the ECS task-def `secrets:` (`secret_refs` in the `ecs-service` module); rotation on for DB + app secret |
| CI → AWS | **GitHub OIDC** short-lived role assumption — no static AWS keys |
| CI → third parties (Sentry, Resend, Twilio, Wokwi, Grafana) | org-level GitHub Actions secrets, **scoped to the GitHub Environment** (`prod` secrets only available to the `prod` environment, behind its reviewer) |
| Vercel (`smart-pet-website`) | Vercel env vars per environment. `NEXT_PUBLIC_*` = client, plain = server. **Names match the config-contract keys** (e.g. `PUBLIC_API_BASE_URL`, `REVALIDATE_SECRET`). |
| Mobile (`smart-pet-app`, when de-deferred) | **EAS Secrets** for build-time; `EXPO_PUBLIC_*` for genuinely public values only; runtime secrets fetched from the backend post-auth, never bundled. Names match the config contract. |
| Firmware | **no secrets in the image** — see `smart-pet-device-sdk/docs/firmware-secrets.md` |

Vault was evaluated and rejected: Secrets Manager covers the runtime need with
far less operational overhead, and SOPS+age covers git-committed config with no
service to run. Revisit only on outgrowing Secrets Manager.

## GitHub Environments

`dev` / `staging` / `prod` exist on each deploying repo (`smart-pet-backend`,
`pet-iot-sensors-service`). `prod` requires a reviewer. `DEPLOY_ROLE_ARN` and
`AWS_REGION` are set **per environment** to that tier's OIDC deploy role
(`smart-pet-terraform module.oidc` output `gha_deploy_role_arns`). A repo's
`deploy.yml` resolves the tier from the git ref and passes `environment:` to
`smart-pet-ci/deploy-ecs.yml`.

## Migrations — expand / contract

The runner is forward-only + idempotent + takes a Postgres advisory lock so
concurrent deploys serialise. Because a rolling deploy runs the new task-def's
migration **while old instances are still serving**, every migration must be
**backwards-compatible with the previous app version**:

1. **Expand** — add the column / table / index. Nullable or with a default.
   New code writes it; old code ignores it. Ship + deploy.
2. **Migrate data** in a follow-up migration if needed (batched, online).
3. **Contract** — only after every instance runs the new code: drop the old
   column, add the `NOT NULL`, remove the compatibility shim. A separate PR,
   a later deploy.

Never rename or drop in the same migration that new code depends on. Never make
a column `NOT NULL` in the same release that starts populating it.

## `.env.example`

Each service keeps a `.env.example` mirroring its config schema (every var,
grouped public / runtime / secret, with the default or a placeholder). `cp
.env.example .env` is a working local start.
