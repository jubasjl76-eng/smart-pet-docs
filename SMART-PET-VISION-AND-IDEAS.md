# Smart Pet — Product Vision & New Ideas

**Status:** Draft for review · **Date:** 2026-09-08 · **Owner:** @marcofolgado76

This document builds on `smart-pet.code-workspace` / the workspace `WORKSPACE.md` overview.
It proposes how to turn the current set of prototypes into **two products on one platform**:

1. **Smart Kennel** (B2B) — a fully automated boarding kennel / daycare operation.
2. **Smart Pet Home** (B2C) — the same devices and services sold to individual dog owners.

Every idea that is **not** already implied by the existing repos is tagged:

> **🆕 NEW IDEA — needs validation**

Each new idea carries: *what it is*, *why*, *rough effort* (S ≈ days, M ≈ 1–3 weeks, L ≈ 1–3 months), *dependencies*, and *risk / open question*. A consolidated checklist is at the end — tick the ideas you approve and I will fold them into a build plan.

---

## 1. Where the project is today (condensed)

| Layer | Reality today |
|---|---|
| Owner app (`smart-pet-app`) | High-fidelity Expo UI, 7 tabs, **mock data only**, no auth |
| Staff dashboard (`backoffice-dashboard`) | Visual shell, 1 real page, hardcoded numbers, no API calls |
| Unified backend (`smart-pet-backend`) | Express on `:3000`, **in-memory**, API-key only, no MQTT, commands don't reach devices |
| Feeder / water firmware | ESP32 prototypes, HTTP poll to their **own** APIs (`:3002` / `:3003`), no NTP, secrets in source |
| GPS collar | Publishes MQTT on `dogs/...` (wrong topic scheme), no runnable consumer |
| Kennel services (edge gateway, sensors, camera) | Scaffolds; sensors service is structurally the most complete |
| MQTT library (`smart-pet-mqtt`) | Good protocol doc + client class, command handlers are stubs |
| Infra (`smart-pet-terraform`) | 1 EC2, no DB, security group wide open |

**Four things block any end-to-end demo:**

1. **Three device dialects** — feeder/water HTTP, collar `dogs/...` MQTT, kennel `kennel/...` MQTT.
2. **Commands don't round-trip** — APIs log events; firmware never receives them.
3. **Apps render fixtures** — no live data path.
4. **No persistence, no user model** — in-memory backend, API keys only.

The rest of this document assumes we fix those four first (Section 3), then layer the kennel and consumer products on top.

---

## 2. Target platform architecture (one platform, two products)

```
      Smart Pet Home (B2C)                 Smart Kennel (B2B)
   ┌──────────────────────┐          ┌──────────────────────────┐
   │  smart-pet-app       │          │  backoffice-dashboard    │
   │  (owner, Expo)       │          │  (staff web) + tablet    │
   └──────────┬───────────┘          └────────────┬─────────────┘
              │  HTTPS + JWT / WSS                │
              └───────────────┬──────────────────┘
                              ▼
                 ┌──────────────────────────┐
                 │  smart-pet-backend       │  (multi-tenant)
                 │  auth · tenants · devices │
                 │  schedules · events       │
                 │  command bus · rules      │
                 │  billing · notifications  │
                 └────┬─────────────┬────────┘
                      │             │
              Postgres│        MQTT │ broker (EMQX/Mosquitto + TLS + ACL)
              + Redis  │             │
                      │   ┌─────────┴───────────────────────┐
                      │   ▼            ▼           ▼         ▼
                      │ edge-gateway  sensors-svc  camera-svc  devices
                      │ (kennel LAN)  (ingest)     (RTSP→HLS)   feeder/water/
                      │                                         GPS/sensors/cam
                      ▼
                 data warehouse / analytics (later)
```

**Principle:** the *device ecosystem is identical* for home and kennel. The difference is **tenant type**, **scale**, and **which app** the user opens. A kennel is just a tenant with many pets, many devices, staff roles, and an on-site edge gateway. A home is a tenant with 1–3 pets and no edge gateway (devices talk to cloud MQTT directly, or via a cheap hub).

---

## 3. Foundation work (must happen before either product)

These are not "new ideas" — they are the known gaps. Listed so the roadmap is complete.

| # | Work | Effort | Notes |
|---|---|---|---|
| F1 | **One device protocol.** Adopt `smart-pet-mqtt` topic scheme everywhere. Migrate collar from `dogs/{id}/...` → `kennel/{tenantId}/gps/{id}/...`. Give feeder/water an MQTT path (keep HTTP as fallback). | M | Unifies the three dialects. Use `tenantId` instead of `kennelId` in the topic so homes fit the same scheme. |
| F2 | **Command round-trip.** Backend publishes command → device acks on `.../command/ack` → backend resolves with timeout + retry. `origin/development` already has a feeder version of this; bring it to `main` and generalise. | M | The single most important missing loop. |
| F3 | **Persistence.** Postgres for devices/pets/schedules/events/users/tenants; Redis for pub/sub fan-out to WebSockets and command state. | M | Kills the in-memory + JSON-file + SQLite inconsistency. |
| F4 | **Identity & multi-tenancy.** Users, tenants (`home` \| `kennel`), roles (owner, staff, admin), device claiming (QR / pairing code), JWT + refresh. | L | Prerequisite for both apps and for billing. |
| F5 | **Real-time to clients.** WebSocket/SSE gateway so app + dashboard get live device state instead of polling. | S–M | Collar architecture doc already recommends WebSockets. |
| F6 | **Device hardening.** NTP time sync, secrets out of firmware (Wi-Fi provisioning + per-device credentials via BLE/captive portal), OTA updates. | M | Blocks reliable scheduling and any real deployment. |
| F7 | **Wire the apps.** Replace mock data in `smart-pet-app` and `backoffice-dashboard` with the real API + WS. | M | Turns two shells into one product each. |

---

## 4. Product A — Fully Automated Kennel (B2B)

### 4.1 Vision

A boarding kennel or doggy-daycare where **routine care runs itself** and staff shift from "doing tasks" to "handling exceptions". Every pen/run has a feeder, a water unit, a camera, and environmental sensors. Each dog wears a collar. The system feeds, waters, monitors, logs, and alerts. Staff get a prioritised queue of things that actually need a human.

### 4.2 Core automated workflows (mostly assembling existing pieces)

| Workflow | How it works | Repos involved |
|---|---|---|
| **Scheduled feeding per dog** | Per-pet diet profile (portion, times, food type) → backend issues feeder commands → ack logged → portion decremented from hopper level | backend, smart-feeder, mqtt |
| **Water assurance** | Water unit reports level + TDS + temp; auto top-up; alert if a run's bowl stays low or quality drifts | backend, smart-water-dispenser, sensors-svc |
| **Environmental safety** | Per-zone temp/humidity/air-quality thresholds; HVAC/fan relay control; alert on door left open | sensors-svc, edge-gateway |
| **Presence & wellbeing** | Collar GPS/activity + camera motion → "dog X hasn't moved in N hours" or "left assigned zone" | gps-dog-collar, camera-svc, backend |
| **Offline resilience** | Edge gateway keeps feeding/watering/logging when internet drops; syncs on reconnect | edge-gateway |
| **Staff console** | Dashboard shows live board of all runs, exception queue, per-dog timeline, shift handover report | backoffice-dashboard |

### 4.3 New ideas for the kennel

> **🆕 NEW IDEA — Per-dog "Care Plan" object**
> A first-class entity: diet (portions, schedule, food SKU, allergies), meds, exercise needs, vet contact, behaviour notes, emergency contact, photos, consent forms. Everything the automation and staff need in one record, set at check-in.
> *Why:* today there is no pet model at all; automation needs a target to act on.
> *Effort:* M · *Depends on:* F3, F4 · *Risk:* scope creep — keep v1 to diet + meds + contacts.

> **🆕 NEW IDEA — Digital check-in / check-out kiosk**
> Tablet flow at reception: scan booking → confirm Care Plan → assign run → pair collar (NFC/QR) → owner signs consent → photo. Check-out reverses it and generates a stay report.
> *Why:* binds a physical dog to a tenant, a run, and a set of devices; without it nothing else has context.
> *Effort:* M · *Depends on:* F4, Care Plan · *Risk:* needs a booking source (see next idea).

> **🆕 NEW IDEA — Booking & occupancy module**
> Calendar of runs, availability, reservations, deposits, capacity limits, waitlist. Could be built-in or an integration with existing kennel-management SaaS (Gingr, PawLoyalty, Kennel Connect).
> *Why:* kennels won't adopt a system that ignores the thing they actually sell (nights).
> *Effort:* L to build, M to integrate · *Depends on:* F4 · *Risk:* build-vs-integrate decision; integrating first is safer.

> **🆕 NEW IDEA — Exception queue / "care inbox" as the primary staff UI**
> Instead of dashboards full of green numbers, the default screen is a triaged list: *feeder jam in Run 7*, *dog 14 skipped 2 meals*, *temp high in Zone B*, *collar 3 battery 12%*. Each item has a suggested action and a "resolve / snooze / escalate" control. Everything nominal is hidden.
> *Why:* automation only pays off if humans stop scanning for problems. This is the product's core value prop for staff.
> *Effort:* M · *Depends on:* F5, rules engine (below) · *Risk:* alert tuning; too noisy = ignored.

> **🆕 NEW IDEA — Rules / automation engine**
> User-defined "if this then that" per tenant: *if run temp > 28°C for 10 min → turn on fan relay + notify on-call*; *if dog skips 2 consecutive meals → create high-priority task + SMS manager*; *if collar leaves geofence → sound local siren + call staff*.
> *Why:* every kennel has different SOPs; hardcoding them doesn't scale. Also the backbone of the exception queue.
> *Effort:* L (M for a fixed rule set, L for a real editor) · *Depends on:* F3, F5 · *Risk:* start with ~10 preset rules with parameters, not a full editor.

> **🆕 NEW IDEA — Smart pen door / access control**
> Servo or maglock on each run door, opened by staff phone tap or collar NFC, with an audit log (who opened Run 7, when). Auto-lock. Integrates with the "door left open" alert already in the sensors service.
> *Why:* wandering dogs and unlogged access are real liability issues.
> *Effort:* M (hardware + firmware + API) · *Depends on:* F1, F2 · *Risk:* safety — must fail-safe (manual override, power-loss behaviour defined).

> **🆕 NEW IDEA — Automated play / enrichment scheduling**
> Rotate dogs through play yards or enrichment stations on a schedule the system tracks; log activity minutes per dog (from collar accelerometer) for the stay report.
> *Why:* differentiates a "smart" kennel; gives owners proof their dog was exercised.
> *Effort:* M · *Depends on:* Care Plan, collar activity data · *Risk:* needs collar firmware to expose activity, not just GPS.

> **🆕 NEW IDEA — Owner "stay report" (auto-generated)**
> After each stay: meals eaten vs planned, water intake trend, activity minutes/day, weight (smart scale, optional), temperature exposure, 3–5 auto-selected photo/video clips of the dog, any incidents. Delivered to the owner via the B2C app or email/PDF.
> *Why:* strong marketing artifact; turns telemetry into something owners pay for.
> *Effort:* M · *Depends on:* camera clip selection, Care Plan, analytics · *Risk:* clip auto-selection quality (see camera AI idea).

> **🆕 NEW IDEA — Weight & health trend station**
> Cheap load-cell platform scale at a doorway or feeding station; collar RFID/BLE identifies the dog as it stands on it. Trend weight over the stay and across visits.
> *Why:* weight change is the single best early indicator of illness or stress in boarding.
> *Effort:* M (HW: HX711 + load cells + ESP32) · *Depends on:* dog identification (collar BLE/RFID) · *Risk:* getting a clean reading from a moving dog; may need multi-sample median.

> **🆕 NEW IDEA — Medication dispensing & compliance log**
> For dogs on meds: scheduled reminder to the assigned staff member with photo confirmation ("photo of pill given"), or an automated pill-dropper module for simple cases. Full audit trail for liability.
> *Why:* med errors are a top source of kennel complaints and lawsuits.
> *Effort:* S (reminder + photo log) / L (hardware dispenser) · *Depends on:* Care Plan, tasks · *Risk:* keep automated dispensing to non-critical meds only; humans for anything dosage-sensitive.

> **🆕 NEW IDEA — Multi-site / franchise view**
> One org, many kennel locations; regional dashboard, cross-site staff, consolidated billing and analytics.
> *Why:* the buyers with money are chains, not single-site kennels.
> *Effort:* M on top of F4 multi-tenancy (add an `org` layer above `tenant`) · *Risk:* don't over-engineer before the first paying single site.

> **🆕 NEW IDEA — Predictive maintenance for devices**
> Track servo actuation counts, pump run-hours, sensor drift, Wi-Fi RSSI decline; flag "feeder 7 motor likely to fail" before it jams during a stay.
> *Why:* a jammed feeder at 2am with 40 dogs is the nightmare scenario.
> *Effort:* M · *Depends on:* F3 (telemetry history), analytics · *Risk:* needs real failure data to tune; start with simple counters + thresholds.

> **🆕 NEW IDEA — Emergency mode**
> One control that: unlocks all doors (or a defined evacuation set), turns on all lights, pushes the run→dog→owner-contact manifest to every staff phone, and starts recording all cameras at full rate. For fire/flood/evac.
> *Why:* life-safety; also a compliance selling point.
> *Effort:* M · *Depends on:* smart doors, F2, F5 · *Risk:* must be impossible to trigger accidentally; needs drill mode.

---

## 5. Product B — Smart Pet Home (B2C, dog owners)

### 5.1 Vision

The same feeder, water unit, camera, collar, and sensors, sold to a household. The existing `smart-pet-app` becomes the real product: monitor and control your dog's care from your phone, get alerts, watch live video, see where your dog is. Aimed at: people who work long hours, multi-dog homes, owners of dogs with medical needs, and anyone who currently pays for a mid-range pet camera + separate auto-feeder and wants one app.

### 5.2 Core features (turning the mock app into a product)

| Feature | Notes | Wires up |
|---|---|---|
| **Onboarding & pairing** | Create account → add dog(s) → pair devices via QR + BLE Wi-Fi provisioning | F4, F6 |
| **Feed Now + schedules** | Real command round-trip, live hopper level, "fed" confirmation, portion history | F1, F2, FeederScreen |
| **Water monitoring** | Level, freshness (TDS/temp), auto top-up, "change the water" nudge | WaterScreen, sensors |
| **Live camera + clips** | HLS live view, motion clips saved to timeline, 2-way audio (later) | camera-svc, CameraScreen |
| **GPS & safe zones** | Real map (`react-native-maps` already a dep), home safe-zone, escape alert, location history | gps-dog-collar, TrackerScreen |
| **Home environment** | Room temp/humidity for the dog's area, "too hot" alert while you're out | sensors-svc, SensorsScreen |
| **Notifications** | Push for: fed/missed, escaped safe zone, low food, camera motion, hot room, device offline | F5 + push service |
| **Household sharing** | Invite partner/family/dog-walker with scoped permissions | F4 |

### 5.3 New ideas for the consumer product

> **🆕 NEW IDEA — "Away Mode" one-tap routine**
> Leaving the house triggers a bundle: confirm feeder schedule active, top up water, arm camera motion alerts, start environment watch, enable location alerts. "Home Mode" relaxes it. Optional geofence auto-trigger from the phone.
> *Why:* the core B2C job-to-be-done is "I'm out, is my dog OK?" — make that one tap.
> *Effort:* S–M · *Depends on:* F5, notifications · *Risk:* geofence battery/permission friction on iOS; make manual the default.

> **🆕 NEW IDEA — Feeding safety interlocks for the owner**
> App-side guardrails: max portions/day, min interval between manual feeds, "someone already fed Bella 20 min ago" warning for multi-user homes, vacation-mode daily cap. Prevents the classic "everyone feeds the dog" overfeeding.
> *Why:* multi-person households double-feed constantly; this is a concrete health benefit.
> *Effort:* S · *Depends on:* household sharing, event history · *Risk:* none major.

> **🆕 NEW IDEA — Vet & sitter share link**
> Generate a time-boxed, read-only (or scoped-control) link: give your vet 7 days of feeding/water/activity/weight data, or give a sitter feed + camera access for a weekend without adding a permanent account.
> *Why:* removes friction for the two people owners most want to share with.
> *Effort:* M · *Depends on:* F4 · *Risk:* security of link scoping; expire aggressively, log usage.

> **🆕 NEW IDEA — Activity & wellness insights**
> From collar accelerometer + feeder/water data: daily activity minutes, rest patterns, eating/drinking trends, "Bella is drinking 30% more than her usual — worth a vet check" style nudges. Weekly digest.
> *Why:* moves the product from "gadget" to "health companion", supports subscription pricing.
> *Effort:* M–L · *Depends on:* collar activity firmware, analytics, F3 history · *Risk:* health claims — phrase as "consider talking to your vet", never diagnose.

> **🆕 NEW IDEA — Camera AI: dog-centric clip curation**
> On-device or edge motion → cloud/edge model that keeps only clips *with the dog in them*, tags behaviour (playing, barking, distressed, sleeping, eating), and builds a daily 30-second "dog's day" reel. Bark/whine detection → "Bella has been barking for 15 min" alert.
> *Why:* raw motion alerts are noise; owners want "show me my dog doing something", and separation-anxiety detection is a real unmet need.
> *Effort:* L · *Depends on:* camera-svc real motion pipeline (currently simulated), model hosting · *Risk:* compute cost + privacy; prefer edge inference; be explicit about what's processed where.

> **🆕 NEW IDEA — Two-way audio & "talk to your dog"**
> Speaker + mic on the camera or a standalone unit: listen in, speak, play a pre-recorded "you're OK, I'll be home soon" or a calming playlist on a schedule or triggered by the bark detector.
> *Why:* top-selling feature of every consumer pet camera; table stakes for B2C.
> *Effort:* M (HW + WebRTC) · *Depends on:* camera-svc → WebRTC path · *Risk:* WebRTC/NAT traversal complexity; latency.

> **🆕 NEW IDEA — Treat-toss / play module**
> Small motorised treat launcher, triggered from the app or as a reward inside the activity system ("Bella hit her activity goal → auto-toss a treat"). Piggybacks on the feeder mechanism design.
> *Why:* the single most engaging feature in consumer pet tech; drives daily app opens.
> *Effort:* M (reuse servo/auger work from smart-feeder) · *Depends on:* F2 · *Risk:* portion/calorie tracking so treats count toward the daily cap.

> **🆕 NEW IDEA — Multi-dog identification at shared devices**
> One feeder/water/camera, several dogs: collar BLE proximity (or camera vision) identifies which dog is present, so portions, intake, and activity are attributed correctly and a dog only gets *its* scheduled meal.
> *Why:* multi-dog homes are a huge segment and are underserved; "selective feeder" products sell at a premium.
> *Effort:* M–L · *Depends on:* collar BLE beacon, per-dog Care Plan · *Risk:* reliability of ID; fall back to time-based + manual correction.

> **🆕 NEW IDEA — Smart scale bowl / weight tracking at home**
> Load cells under the feeder bowl: measure grams actually eaten (not just dispensed) and how fast, plus periodic dog weight if they stand on a mat. Feeds the wellness insights.
> *Why:* "dispensed" ≠ "eaten"; appetite drop is an early illness sign owners miss.
> *Effort:* M · *Depends on:* HX711 in feeder HW rev · *Risk:* calibration, bowl removal handling.

> **🆕 NEW IDEA — Consumables auto-reorder**
> Track kibble/treat consumption vs hopper capacity → predict run-out date → one-tap reorder, or auto-subscribe (Amazon/retailer affiliate, or your own store). Same for water filters.
> *Why:* recurring revenue + genuine convenience; owners forget until the hopper is empty.
> *Effort:* M · *Depends on:* accurate consumption tracking, a fulfilment partner · *Risk:* commercial/partnership dependency; start with just a "reorder reminder + link".

> **🆕 NEW IDEA — Offline / power-cut behaviour spec for the home**
> Define and communicate clearly: feeder keeps its schedule via RTC + local flash for 72h without Wi-Fi; camera records to local SD; app shows "last seen" honestly. Optional cheap battery backup accessory.
> *Why:* trust. The one time it matters (storm, outage) it *really* matters, and it's a review-killer if it fails silently.
> *Effort:* M (overlaps F6) · *Depends on:* F6 · *Risk:* firmware complexity; but non-negotiable for a care product.

> **🆕 NEW IDEA — "Bridge to a kennel" — cross-product handoff**
> When an owner boards their dog at a Smart-Pet-equipped kennel, their Care Plan (diet, meds, vet, quirks) transfers to the kennel tenant for the stay, and the owner keeps a live read-only view (camera of their dog's run, feeding log, stay report) in the *same app they already use*.
> *Why:* this is the unique advantage of running both products on one platform — neither a pure B2C nor a pure B2B competitor can offer it.
> *Effort:* M (mostly a permissions + data-scoping feature once F4 exists) · *Depends on:* F4, Care Plan, kennel check-in · *Risk:* consent and data-ownership model must be crystal clear.

### 5.4 B2C packaging ideas

> **🆕 NEW IDEA — Tiered bundles**
> *Starter* (feeder + app), *Watch* (+ camera), *Care* (+ collar + sensors + wellness insights subscription), *Multi-dog* add-on pack. Hardware one-off + optional monthly for cloud video retention, wellness insights, and cellular collar data.
> *Why:* clear upsell path; matches how Ring/Furbo/Tractive price.
> *Effort:* N/A (business) · *Risk:* keep core safety alerts free forever — never paywall "your dog escaped".

---

## 6. Cross-cutting new ideas (platform, hardware, AI, ops)

> **🆕 NEW IDEA — One low-cost "Pet Hub" for homes**
> A small always-on device (ESP32-S3 or a Pi Zero 2 W) that runs a trimmed `edge-gateway`: local MQTT, schedule cache, RTC, and a bridge to cloud. Homes get kennel-grade offline resilience without every device needing its own cloud connection or the user configuring Wi-Fi five times.
> *Why:* unifies home and kennel on the *same* edge codebase; better reliability; single pairing step.
> *Effort:* M · *Depends on:* edge-gateway made deployable, F6 · *Risk:* adds BOM cost; make it optional (devices can still go direct-to-cloud).

> **🆕 NEW IDEA — Firmware OTA + fleet management**
> Signed OTA updates, staged rollouts, per-device version visibility, rollback. Table stakes once real hardware is in the field and impossible to retrofit cheaply later.
> *Effort:* M–L · *Depends on:* F6 · *Risk:* bricking devices — needs A/B partitions and a golden recovery image.

> **🆕 NEW IDEA — Unified device SDK / firmware base**
> One shared ESP32 library: Wi-Fi provisioning, MQTT with the canonical topic scheme, NTP, OTA, secure credential storage, command/ack pattern, last-will. Feeder/water/collar/sensor firmware become thin app layers on top.
> *Why:* four firmware codebases are currently reinventing the same plumbing (with the same bugs — hardcoded secrets, no NTP).
> *Effort:* M · *Depends on:* F1, F6 · *Risk:* refactor cost; do it before the fleet grows, not after.

> **🆕 NEW IDEA — Simulation & QA harness**
> Extend the existing Wokwi feeder sim into a full virtual kennel: N virtual feeders/water/collars/sensors publishing realistic MQTT, plus scripted failure scenarios (feeder jam, offline device, temp spike, escaped dog). Runs in CI against the backend + dashboard.
> *Why:* you can't hand-test a 40-run kennel; regressions in the command loop or rules engine need to be caught automatically.
> *Effort:* M · *Depends on:* F1, F2 · *Risk:* keeping the sim realistic enough to be useful.

> **🆕 NEW IDEA — Data & analytics warehouse**
> Stream events to a columnar store (Timescale/ClickHouse/BigQuery) for: kennel operational reports, per-dog history across stays, wellness ML training data, and product analytics. Keep the transactional Postgres lean.
> *Effort:* M–L · *Depends on:* F3 · *Risk:* premature — defer until there's real volume, but design event schema now so it's replayable.

> **🆕 NEW IDEA — Privacy & data-governance model (do this early)**
> Explicit policy + implementation: camera footage retention windows, who can view what, edge-vs-cloud inference disclosure, data export & delete (GDPR), kennel-vs-owner data ownership during a stay, audit logs on all camera/door access.
> *Why:* cameras + location + "in someone's home / with someone's pet" = the highest-scrutiny data category. Retrofitting compliance is brutal.
> *Effort:* M (policy) + ongoing · *Depends on:* F4 · *Risk:* legal review needed per market (EU vs US).

> **🆕 NEW IDEA — Alerting/notification service as its own component**
> Central service: channels (push, SMS, email, voice call, local siren), per-user quiet hours, escalation chains (notify owner → after 10 min notify emergency contact → after 20 min auto-call kennel), dedup, and delivery receipts. Both products need this and it should not live inside the API.
> *Effort:* M · *Depends on:* F5 · *Risk:* SMS/voice cost; provider choice (Twilio etc.).

> **🆕 NEW IDEA — Accessibility & low-connectivity mode**
> App works on 2G/edge and offline (cached last state, queued commands), large-text mode, screen-reader labels, and an SMS fallback for critical alerts when data is down.
> *Why:* rural kennels and rural dog-walks are exactly where connectivity is worst and alerts matter most.
> *Effort:* M · *Risk:* ongoing discipline more than a one-off.

---

## 7. Suggested roadmap

| Phase | Goal | Contents |
|---|---|---|
| **0 — Foundation** | One feeder round-trips, persisted, authed, live in the app | F1–F5, F7 (feeder only); minimal Care Plan; Postgres + Redis + broker in Terraform |
| **1 — Home MVP (B2C)** | Sellable single-dog home kit | Feeder + water + 1 camera + collar; pairing/provisioning (F6); Feed Now, schedules, live cam, safe zone, core push alerts; Away Mode; feeding interlocks; offline spec |
| **2 — Kennel MVP (B2B)** | One real kennel running daily care on the system | Multi-tenant + roles + check-in kiosk; edge gateway deployable; exception queue + ~10 preset rules; per-dog Care Plan; environment control; stay report v1; dashboard wired to real data |
| **3 — Differentiators** | The stuff competitors can't copy | Cross-product Care Plan handoff (home↔kennel); wellness insights; camera AI clip curation; multi-dog identification; weight stations; predictive maintenance |
| **4 — Scale** | Chains, hardware fleet, revenue | Multi-site/franchise; OTA + fleet mgmt; analytics warehouse; consumables reorder; tiered billing; two-way audio; treat-toss |

Rule of thumb: **don't start Phase 2 until Phase 0's command loop is rock-solid in the simulation harness.**

---

## 8. Open questions for you

1. **Which product first?** My recommendation: Phase 0 + **Home MVP first** (simpler tenancy, faster feedback, you already have the app shell), then Kennel MVP. Agree?
2. **Build vs integrate the kennel booking system?** Integrate with an existing kennel SaaS for v1, or build it?
3. **Hardware plan** — are you manufacturing custom devices, or is this software + off-the-shelf ESP32 kits for now? This changes how much to invest in the unified firmware SDK and OTA.
4. **Cameras** — own ESP32-CAM hardware, or support standard ONVIF/RTSP IP cameras (the camera-svc already assumes RTSP)? Supporting third-party cameras is a much faster path to a B2C product.
5. **Connectivity for the collar** — Wi-Fi-only (home) for MVP, or invest in LTE-M now for outdoor tracking? The architecture doc leans LTE-M for production.
6. **Subscription** — willing to run a paid tier (video retention, wellness insights, cellular data), or one-off hardware sales only?
7. **Target market / region** — EU (GDPR, CE marking) or US first? Affects privacy work and certification.
8. **Naming** — keep "Smart Pet" for both, or distinct brands for the kennel product vs the consumer product under one platform?

---

## 9. Validation checklist

Tick the ideas you want me to take forward into a detailed build plan. Strike through any you reject.

### Kennel (Product A)
- [ ] Per-dog Care Plan object
- [ ] Digital check-in / check-out kiosk
- [ ] Booking & occupancy module (build or integrate — note which)
- [ ] Exception queue / "care inbox" as primary staff UI
- [ ] Rules / automation engine (preset rules v1)
- [ ] Smart pen door / access control
- [ ] Automated play / enrichment scheduling
- [ ] Owner stay report (auto-generated)
- [ ] Weight & health trend station
- [ ] Medication dispensing & compliance log
- [ ] Multi-site / franchise view
- [ ] Predictive maintenance for devices
- [ ] Emergency mode

### Home (Product B)
- [ ] Away Mode one-tap routine
- [ ] Feeding safety interlocks (multi-user overfeeding guard)
- [ ] Vet & sitter time-boxed share link
- [ ] Activity & wellness insights
- [ ] Camera AI: dog-centric clip curation + bark detection
- [ ] Two-way audio
- [ ] Treat-toss / play module
- [ ] Multi-dog identification at shared devices
- [ ] Smart scale bowl / weight tracking
- [ ] Consumables auto-reorder
- [ ] Offline / power-cut behaviour spec
- [ ] Bridge to a kennel — cross-product Care Plan handoff
- [ ] Tiered hardware bundles + subscription

### Cross-cutting
- [ ] One low-cost "Pet Hub" for homes
- [ ] Firmware OTA + fleet management
- [ ] Unified device SDK / firmware base
- [ ] Simulation & QA harness (virtual kennel)
- [ ] Data & analytics warehouse
- [ ] Privacy & data-governance model (early)
- [ ] Dedicated alerting/notification service
- [ ] Accessibility & low-connectivity mode

---

*Once you mark this up, I'll turn the approved items into a phased implementation plan with repo-by-repo changes.*
