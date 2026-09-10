# Secure Boot v2 + Flash Encryption — design

**Status:** Draft, pending sign-off · **Phase 18** deliverable (Part C · C5);
**rollout is Phase 19.**
**Scope:** ESP32 (`esp32dev`) — `smart-feeder`, `smart-water-dispenser`,
`gps-dog-collar`, and any board built from `smart-pet-device-sdk`.

> Burning the Secure Boot / Flash Encryption eFuses is **one-way and
> per-chip**. Nothing in this document is applied to hardware until it is
> reviewed, approved, and piloted on a single feeder (Phase 19).

---

## 1. Goals & threat model

| Threat | Control |
|---|---|
| Attacker flashes malicious firmware over USB/JTAG on a stolen or returned device | **Secure Boot v2** — the ROM refuses any bootloader/app not signed by our key |
| Attacker pushes a malicious image through the OTA channel | Secure Boot verifies the app signature on every boot; the OTA client also checks the manifest SHA-256 before swapping partitions (A6) |
| Attacker dumps flash to read Wi-Fi creds, MQTT per-device credentials, or the app | **Flash Encryption** (AES-256-XTS, key in eFuse, never leaves the chip) |
| Attacker rolls a device back to a known-vulnerable signed version | **Anti-rollback** — `CONFIG_BOOTLOADER_APP_ANTI_ROLLBACK`, secure-version counter in eFuse |
| Signing key leaks | 3 key slots in eFuse → rotate to slot 2, revoke slot 1 in the field via a signed OTA (see §6) |

Out of scope: physical decapsulation / power-glitch attacks on the eFuse
block (accepted risk — not economical against a $30 feeder), and the ESP32
(classic) Secure Boot v2 CVE surface, which is tracked against the Espressif
advisory feed per C5.

---

## 2. Secure Boot v2

- **Scheme:** RSA-3072 (PSS). Signed bootloader + signed app. The ROM verifies
  the bootloader; the bootloader verifies the app.
- **Key material:** one **RSA-3072 private key** signs everything. Only the
  **public-key digest** is burned into eFuse (`BLOCK_KEY0`). Up to 3 digests
  are supported → slots for rotation.
- **Build:** `CONFIG_SECURE_BOOT=y`, `CONFIG_SECURE_BOOT_V2_ENABLED=y`,
  `CONFIG_SECURE_BOOT_SIGNING_KEY` (CI only — see §4). PlatformIO builds a
  signed `bootloader.bin` + `firmware.bin`.
- **First boot on a factory device** burns `ABS_DONE_0`, the key digest, and
  (in prod) disables the UART/USB download-mode boot path and JTAG.

### Open decision D1 — one key or per-device-type

Default recommendation: **one org-wide signing key** for v1 (simplest custody,
one CI secret, one revocation drill). Revisit per-device-type keys only if a
contract-manufacturer split makes a shared key untenable.

---

## 3. Flash Encryption

- **Scheme:** AES-256-XTS. The key is generated **on-device at first boot**,
  stored in eFuse `BLOCK_KEY1`, `RD/WR`-protected — it never leaves the chip
  and is not known to us.
- **Encrypts:** the app partition, the bootloader, and **`nvs` is *not*
  encrypted by default** — the per-device MQTT credentials + Wi-Fi creds go in
  a dedicated **`nvs_keys`-encrypted `nvs` partition** (`CONFIG_NVS_ENCRYPTION=y`
  with keys derived from a flash-encrypted `nvs_key` partition). The SDK's
  `spd_config.h` NVS namespace moves there.
- **Modes:**
  - **Development** (`CONFIG_SECURE_FLASH_ENCRYPTION_MODE_DEVELOPMENT`) — the
    key is kept readable-for-reflash; plaintext serial download still works.
    Used on the bench.
  - **Release** (`..._RELEASE`) — download mode can no longer decrypt; the
    only way to update is a signed OTA or a full factory reflash. **Prod.**

### Open decision D2 — enable Flash Encryption release mode in the first pilot?

Default recommendation: pilot Secure Boot **first**, Flash Encryption in
**development** mode, and only flip to release mode once the OTA path is
proven end-to-end on hardware. A device in release mode with a lost signing
key is unrecoverable e-waste (see §6).

---

## 4. Key custody

| Artefact | Where | Access |
|---|---|---|
| RSA-3072 **private** signing key | **AWS Secrets Manager** (`smart-pet/prod/secure-boot-signing-key`), region-locked, versioned | Only the release CI job, via GitHub→AWS OIDC with a scoped role (`secretsmanager:GetSecretValue` on that one ARN). Never checked out to a developer machine. |
| Public-key **digest** | Committed to `smart-pet-device-sdk` (`secure_boot_public_key_digest.bin`) + burned to eFuse at factory | Public |
| Flash Encryption key | Generated on-device, eFuse `BLOCK_KEY1`, read-protected | The chip only |
| `nvs` encryption keys | Flash-encrypted `nvs_key` partition | The chip only |

- The signing key is generated **once**, offline, on an air-gapped machine
  (`espsecure.py generate_signing_key --version 2`), split into a Shamir 2-of-3
  and stored (Secrets Manager + two offline copies held by the operator).
- **Rotation drill** (pairs with A12 #20): quarterly, sign a no-op OTA with a
  *new* key added to slot 2, confirm the fleet accepts it, then a later OTA
  revokes slot 1.

### Open decision D3 — HSM vs Secrets Manager

Default: **Secrets Manager** for v1 (the key is used a few times per release,
not per device). Move to AWS CloudHSM / KMS-with-custom-keystore only if an
audit or a customer contract requires FIPS 140-2 Level 3 custody.

---

## 5. Dev vs prod eFuse policy

| eFuse / setting | Dev / bench | Prod / shipped |
|---|---|---|
| Secure Boot v2 | enabled, key burned | enabled, key burned |
| `SECURE_BOOT_AGGRESSIVE_REVOKE` | off | **on** |
| Flash Encryption | development mode | **release mode** |
| UART/USB download mode | enabled | **`DISABLE_DL_DECRYPT` + `DISABLE_DL_CACHE`** |
| JTAG | open | **`DISABLE_PAD_JTAG` / soft-disabled via eFuse** |
| Anti-rollback | on (secure version 0) | on, secure version bumped per release |

Dev boards are a **separate SKU** flashed with a **separate dev signing key**
and never leave the lab. A dev key is never accepted by a prod device and vice
versa.

---

## 6. Recovery story

| Situation | Recovery |
|---|---|
| Bad OTA image (crashes, won't connect) | A/B partitions + the bootloader rollback: the device boots the previous slot after N failed confirmations. The SDK's `spd_offline_journal.h` replays queued actions on recovery. |
| Signing key **compromised** (still held) | OTA signed with the new key (slot 2), then a follow-up OTA sets `SECURE_BOOT_AGGRESSIVE_REVOKE` to burn slot 1. Devices offline during the window pick it up on next contact. |
| Signing key **lost** (no copy) | Devices already in release mode **cannot be updated** — factory reflash only, and only if the *old* key is available. This is why the key is 2-of-3 split with offline copies. New production switches to a fresh key; the field fleet is frozen at its last good version until a copy is recovered. |
| Device bricked (bad bootloader, eFuses burnt) | Not field-recoverable. RMA → factory reflash with the matching key, or scrap. Mitigation: the bootloader is only re-signed on a deliberate bootloader change, which is rare and gets an extra review. |
| Flash Encryption key issue | The key is on-chip and never changes; there is no recovery path for a corrupt eFuse key block — the chip is scrap. Accepted (per-chip failure, not systemic). |

---

## 7. Provisioning (ties to A12 #18)

First-run Wi-Fi provisioning moves from the current open SoftAP portal
(`spd_wifi.h`) to **`protocomm` + proof-of-possession**, QR-driven: the factory
prints a per-device PoP + a QR on the label; the setup app scans it and runs an
X25519-encrypted `wifi_prov` session. No creds cross the air in the clear, and
the SoftAP is closed after provisioning. Detailed in the Phase 19 firmware plan.

---

## 8. Rollout (Phase 19 — not this phase)

1. CI: add the signed-build path (`espsecure` sign step, OIDC pull of the key),
   publish `bootloader.bin` + signed `firmware.bin` + SLSA provenance on the
   `.bin` (A6, extends the Phase 18 SBOM/attest work to firmware artifacts).
2. Bench: flash **one feeder**, burn Secure Boot eFuses, Flash Encryption in
   dev mode. Verify: an unsigned image is **rejected from OTA** and **rejected
   from a physical `esptool write_flash`** (C5 acceptance criterion).
3. Anti-rollback + secure-version wiring; OTA manifest hash check in the SDK.
4. Flip the pilot feeder to Flash Encryption **release mode**; re-run the
   rejection tests; 1-week soak.
5. Extend to the other two device types; update the factory procedure doc.

---

## 9. Sign-off

- [ ] D1 — one signing key vs per-device-type
- [ ] D2 — Flash Encryption release mode in pilot, or staged
- [ ] D3 — Secrets Manager vs HSM for the private key
- [ ] Key-generation ceremony scheduled (air-gapped, 2-of-3 split)
- [ ] Reviewer: __________  Date: __________
