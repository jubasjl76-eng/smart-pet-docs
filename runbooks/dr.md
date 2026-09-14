# Disaster recovery — cross-region backup & restore

**Status:** Live · **Phase 21** deliverable (A12 #19).
**Scope:** `prod` only. `dev`/`staging` carry no DR infrastructure — same
cost-vs-scale call as Phase 20's RDS Proxy deferral and Phase 21's read
replica: a second always-on region is real ongoing AWS cost, and only prod
has anything worth protecting against a full region loss.

**Primary region:** `eu-west-1`. **DR region:** `eu-west-2`
(`smart-pet-terraform`'s `envs/prod` `var.dr_region`).

---

## 1. What actually replicates, and what doesn't

| Data class | Mechanism | RPO | RTO |
|---|---|---|---|
| Postgres (RDS) | Automated backups + PITR transaction-log stream, continuously replicated to `eu-west-2` (`aws_db_instance_automated_backups_replication`) | ~5 min (RDS's own PITR granularity — unchanged by adding cross-region replication, it's the same log stream, just also landing in a second region) | ≤ 1 hr — a `restore-db-instance-to-point-in-time` against the replicated copy, then re-point `PG_HOST` |
| `firmware/` + `buyer-photos/` (S3, the `assets` CDN bucket) | Versioning + cross-region replication (CRR) to a dedicated `smart-pet-prod-assets-dr` bucket in `eu-west-2` | Near-zero — CRR is typically seconds to minutes behind for new writes | Re-point `modules/cdn`'s `cdn_assets` bucket at the DR bucket (config change + `terraform apply`), or serve directly from the DR bucket while `eu-west-1` is down |
| Compute, network, ALB/NLB, ECS services, CloudFront, IAM, etc. | **Not replicated — not data.** Terraform + `envs/prod` *is* the recovery mechanism: `terraform apply` against a fresh region rebuilds every stateless resource from the committed config | N/A (nothing to lose — it's code) | The time to run `terraform apply` in a new region + DNS cutover — realistically 1–2 hrs including validation, not attempted live-tested here (see §4) |
| Redis (ElastiCache) | Not replicated | N/A — every consumer (rate limiter, SSE fan-out, leader lock, idempotency store) already degrades to in-process/single-instance behavior when Redis is unreachable (Phase 20) | N/A — a lost cache is not a data-loss event |
| MQTT broker (Mosquitto) retained state / session state | Not replicated (see Phase 21's EMQX-cluster-depth writeup — Mosquitto has no cross-node state to begin with) | N/A | Devices journal locally and replay on reconnect; the backend drops out-of-order replays (`applyStatus`, Phase 21) |
| Secrets (JWT signing key, DB master password, MQTT creds) | AWS Secrets Manager / RDS-managed password — regional, not cross-region replicated today | — | A region failover currently requires re-provisioning secrets in the DR region as part of the Terraform apply (`modules/secrets` in `eu-west-2`) before the app can boot there. Not automated — flagged here as a known gap, not a silent one. |

**Bottom line:** the only things that need an actual *restore* are Postgres
and the assets bucket. Everything else is either rebuilt from Terraform or
already designed to degrade gracefully.

---

## 2. Full region-loss recovery procedure

This assumes `eu-west-1` is unreachable/unusable and `eu-west-2` is healthy.

1. **Stand up the region.** In `smart-pet-terraform`, add (or already have)
   an `envs/prod-dr` — realistically, the fastest real path is repointing
   `envs/prod`'s `var.region` at `eu-west-2` and running `terraform apply`
   against a fresh state (the old state's resources are gone with the
   region; this is a from-scratch apply, not an update). `modules/secrets`
   creates new empty secrets — populate `JWT_SECRET` and anything else in
   `SECRET_KEYS` (`smart-pet-backend/src/config/index.ts`) before the
   backend can serve traffic.
2. **Restore Postgres.**
   `aws rds describe-db-instance-automated-backups-replications` in
   `eu-west-2` to find the replicated source, then:
   ```
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-automated-backups-arn <replicated-backup-arn> \
     --target-db-instance-identifier smart-pet-prod-restored \
     --restore-time <ISO8601, or --use-latest-restorable-time>
   ```
   Point the freshly-applied stack's `PG_HOST` at the restored instance
   (either update the Terraform `module.database` to reference it, or a
   manual `PG_HOST` override during the outage — reconcile Terraform state
   afterward).
3. **Assets bucket.** Either re-point `cdn_assets`'s CloudFront origin at
   `smart-pet-prod-assets-dr` directly, or copy its contents back into a
   freshly-created primary bucket once `eu-west-1` recovers (`aws s3 sync`).
4. **DNS.** Update the `api.`/`mqtt.` Route53 records (or the registrar, if
   the hosted zone itself lived in the lost region — it doesn't; Route53 is
   a global service) to the new region's ALB/NLB.
5. **Verify.** `/ready` on the backend (`db`, `redis`, `mqtt` all report
   healthy), a manual login, one MQTT round-trip against a test device or
   the simulator.

---

## 3. Quarterly restore drill

An untested backup is a hope, not a recovery plan. Every quarter (operator
task — see `OPERATOR-ACTIONS.md` H6; convenient to batch with the
key-rotation drills in `runbooks/key-rotation.md` rather than tracking a
separate schedule):

1. Restore the **latest** replicated automated backup to a throwaway
   instance in `eu-west-2` (`restore-db-instance-to-point-in-time`, a new
   `--target-db-instance-identifier`, not `smart-pet-prod`).
2. Connect to it directly (`psql`) and spot-check: row counts on a couple of
   high-traffic tables (`devices`, `access_log`), the most recent
   `updated_at` timestamp is recent relative to the restore point.
3. Confirm the assets DR bucket (`smart-pet-prod-assets-dr`) has objects
   matching the primary bucket's latest firmware version (`aws s3 ls`
   against both, compare the newest `firmware/<type>/<version>/` prefix).
4. **Tear down** the throwaway restored instance — this drill proves the
   backup is restorable, it isn't meant to become a permanent second copy.
5. Log the drill date + result (row counts checked, any gap found) — a line
   in this file's changelog below is enough; this doesn't need its own
   tracking system.

**Drill log:**

| Date | Result | Notes |
|---|---|---|
| _(none yet — first drill due once prod DR infra is applied)_ | | |
