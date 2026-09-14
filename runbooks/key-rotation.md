# Key rotation drills

**Status:** Live · **Phase 21** deliverable (A12 #20).
**Scope:** MQTT device credentials, firmware signing-key revocation. `JWT_SECRET`
rotation to a `kid` keyset (A12 #20's other named item) is a separate, larger
piece — not done here; it needs a keyset + grace-window design of its own,
tracked separately.

---

## 1. MQTT device-credential rotation

**When:** a device's MQTT password is suspected leaked (a compromised
gateway, a support ticket where creds were pasted somewhere they shouldn't
be, a departing integrator who had them).

**What it does:** `POST /api/breeder/ops/devices/{deviceId}/rotate-credentials`
mints a new password for that device (the username, `device:<deviceId>`,
doesn't change — it's identity, not a secret), updates the broker ACL, and
pushes a `rotate_credentials` command over the device's *existing* MQTT
connection. The device acks over the old connection (proof it received the
new password before the old one stops working), saves the new credentials
to NVS, and reboots — the normal boot path reconnects with whatever's
stored, so there's no live credential swap on an open socket to get wrong.

**Response:** the new credentials, once — same "shown once" contract as
claiming a device. Note them if you need a manual fallback.

**Known limitation — no grace window:** the old password stops working the
instant the API call returns (the hash is overwritten, not appended). If
the device is offline right now, the `rotate_credentials` command never
arrives, and the device is stuck trying to reconnect with a password that
no longer works — it needs a physical re-pairing (a new pairing code, same
flow as first-time setup) to recover, not a retry of this endpoint.

*Why no grace window:* a real one needs the broker to accept two valid
passwords for the same device simultaneously, which needs an actual
password-checking auth backend at the Mosquitto layer — `smart-pet-terraform`'s
`modules/mqtt-broker` doesn't have one wired up yet (its own comment:
"prod must run an auth backend — dynamic-security or a plugin the backend
feeds"). Revisit if offline-device rotation becomes a real operational
problem, not just a theoretical one.

**Drill:** pick one online test/simulator device, rotate its credentials,
confirm it reconnects (comes back online in the fleet view within a
minute or so) and its `last_seen` keeps advancing. Then try it against an
*offline* device on purpose, to see the failure mode for real rather than
just reading about it here.

---

## 2. Firmware signing-key revocation

**When:** a signing key is suspected compromised (leaked from CI, a former
maintainer's access wasn't fully revoked, etc.).

**What it does today:** `POST /api/breeder/fleet/signing-keys/{keyId}/revoke`
(body: `{ "reason": "..." }`) blocks the **backend** from ever pushing a
build signed by that key again — registering a *new* build with a revoked
`signingKeyId` is rejected (403), starting a rollout targeting an
*already-registered* build signed by one is rejected (403), and the shared
push path every OTA command funnels through (manual push, the fleet sweep,
the pg-boss worker) refuses too. `GET /signing-keys` lists what's revoked;
`DELETE .../revoke` undoes an accidental one.

**What it does NOT do — no device-side enforcement yet.** `signature`/
`signingKeyId` are provenance metadata today, not a cryptographic check —
the device SDK verifies the artifact's **SHA-256 hash** (integrity) on
every OTA, but doesn't verify a **signature** (authenticity) at all.
Real device-side signature verification is Secure Boot v2
(`security/secure-boot-flash-encryption.md`), which is designed but still
blocked on hardware — a pilot device, sign-off, the eFuse burn being
one-way and per-chip. Until that ships, revoking a key here is real
defense in depth (stops this fleet's own backend from ever offering a
compromised-key build to any device) but isn't a guarantee against a
device fetching that build from somewhere else entirely (the CDN URL
directly, bypassing the backend's push path) — that guarantee is what
Secure Boot adds.

**Drill:** register a throwaway firmware build with a disposable
`signingKeyId` (e.g. `drill-key-<date>`), revoke it, confirm registering
another build under the same key is rejected and that starting a rollout
against the one already registered is rejected too, then un-revoke and
confirm both succeed again. No real device or hardware needed — this
entire drill is backend-API-only.

---

## Cadence

Run both drills once after reading this doc for the first time, then
whenever `runbooks/dr.md`'s quarterly restore drill happens — convenient
to batch the two together rather than tracking a separate schedule.
