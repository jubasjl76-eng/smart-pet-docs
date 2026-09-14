# Key rotation drills

**Status:** Live · **Phase 21** deliverable (A12 #20).
**Scope:** MQTT device credentials, firmware signing-key revocation, and
`JWT_SECRET` rotation to a `kid` keyset with a grace window.

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

## 3. `JWT_SECRET` rotation

**When:** the secret is suspected leaked (committed to a repo by accident, a
departing engineer had prod access, a secrets-manager audit flags it) — or
just on a routine schedule if you want one; the mechanism costs nothing to
exercise when nothing's actually wrong.

**What it does:** every access token now carries a `kid` in its JWT header
— a deterministic hash of the secret that signed it
(`sha256(secret).slice(0, 8)`, `src/middleware/auth.ts#kidFor`), not an
operator-assigned id, so there's no separate id to keep in sync with the
secret itself. Verification looks up the right key by that `kid` instead of
trying secrets blindly. A token with **no** `kid` (issued before this
keyset existed) still verifies against the *current* secret — the feature
itself shipped with zero forced logouts.

**How to rotate:**
1. Generate a new random secret (`openssl rand -base64 48`, or your secrets
   manager's own generator).
2. Set `JWT_SECRET_PREVIOUS` = the **current** value of `JWT_SECRET` (before
   you change it).
3. Set `JWT_SECRET` = the new secret.
4. Deploy both changes together. From that moment: new logins get tokens
   signed (and `kid`-tagged) with the new secret; anyone already holding a
   token signed with the old one keeps working until it expires
   (`ACCESS_TTL`, 12h default) or you close the window early (next step).
5. **Close the grace window:** once you're confident (12h+ after step 4, or
   immediately if you need every existing session to die *right now* —
   e.g. the leak is confirmed, not just suspected), unset
   `JWT_SECRET_PREVIOUS` and deploy again. Every token signed with the old
   secret is rejected from that point on — anyone still holding one is
   logged out and must sign in again.

**What it does NOT do:** revoke a *specific* still-valid token early (there's
no per-token denylist) — closing the grace window revokes every token from
the *old* key at once, not one at a time. For "kick this one compromised
session out right now" without affecting everyone else, that's a different,
not-yet-built mechanism (a token denylist or a `tokenVersion` bumped per
user) — not needed for a key-rotation drill, called out here so it isn't
assumed to already exist.

**Drill:** in staging, note the current `JWT_SECRET`, rotate it following
the steps above (including setting `JWT_SECRET_PREVIOUS`), confirm an
already-logged-in session keeps working (its token still has the old
`kid`) while a *fresh* login gets a token with the *new* `kid` — decode
both with `jwt.io` or `node -e "console.log(require('jsonwebtoken').decode(token,{complete:true}).header)"`
and compare. Then close the grace window and confirm the old session's
next request gets a 401.

---

## Cadence

Run all three drills once after reading this doc for the first time, then
whenever `runbooks/dr.md`'s quarterly restore drill happens — convenient
to batch them together rather than tracking a separate schedule.
