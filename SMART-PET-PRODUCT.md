# Smart Pet — Product Definition

**Version:** 1.0 · **Date:** 2026-09-08 · **Owner:** jubasjl76-eng

This document describes **what Smart Pet is** — the two products, the platform they
share, and every feature in scope. It does not track implementation status.

- **Build status, PRs, roadmap:** [`SMART-PET-PROGRESS.md`](SMART-PET-PROGRESS.md)
- **Original vision + idea backlog:** [`SMART-PET-VISION-AND-IDEAS.md`](SMART-PET-VISION-AND-IDEAS.md)

---

## 1. What we're building

**Two products on one device + cloud platform.**

| | Smart Kennel (B2B) | Smart Pet Home (B2C) |
|---|---|---|
| **Buyer** | A **dog-breeding** operation (not boarding) | A pet-owning household |
| **Client** | Staff web console + a reception tablet | Owner mobile app |
| **Scale** | Many pens, many dogs, litters, staff roles, an on-site edge box | 1–3 dogs, optional home hub |
| **Core value** | Routine care runs itself; staff work a triaged exception queue instead of scanning for problems; litters and buyers are managed in one place | Monitor and control the dog's feeder / water / camera / collar / environment from a phone, with meaningful alerts |

The **device ecosystem is identical** for both. A kennel is a tenant with many
animals, staff, and an edge gateway; a home is a tenant with a few animals and an
optional Pet Hub. Same firmware, same protocol, same backend. The difference is
the tenant type, the scale, and which client the person opens.

---

## 2. Platform architecture

```
      Smart Pet Home (B2C)                     Smart Kennel / Breeder (B2B)
   ┌──────────────────────┐              ┌──────────────────────────────┐
   │  Owner mobile app    │              │  Staff web console           │
   │                      │              │  + reception tablet          │
   └──────────┬───────────┘              └──────────────┬───────────────┘
              │  HTTPS + JWT                            │
              └───────────────────┬────────────────────┘
                                  ▼
                     ┌────────────────────────────────┐
                     │  Cloud backend                 │
                     │  identity · devices · schedules │
                     │  care plans · care inbox ·      │
                     │  rules engine · notifications ·  │
                     │  predictive maintenance ·        │
                     │  emergency mode · weights &      │
                     │  growth · attributed intake ·    │
                     │  consumables · wellness · meds ·  │
                     │  enrichment · litters · buyers ·  │
                     │  offline journal                 │
                     └───────┬──────────────┬───────────┘
                  database ──┘         MQTT │  broker (TLS + per-device ACL)
                                            │  canonical contract (see §7)
              ┌───────────────┬─────────────┼───────────────┬──────────────┐
              ▼               ▼             ▼               ▼              ▼
        Pet Hub          sensor         camera service   ESP32 devices   virtual-kennel
        (home + kennel    ingest &       + two-way audio  on the shared   simulator
         edge box)        alerts                          firmware SDK    (QA / CI)
        local API                                         ───────────────
        offline schedule runner                           WiFi provisioning · NTP ·
        LAN command queue                                 MQTT + LWT · OTA · on-device
        cloud MQTT bridge                                 schedule cache · offline
                                                          journal · modules: feeder /
                                                          water / door / scale /
                                                          presence / environment
```

**Design principles**

- **One tenant string.** `kennelId` identifies the tenant — a breeder-kennel slug
  for B2B, a household id for B2C. Everything else is the same.
- **The hub is the local authority.** Feeding, watering and door control run on the
  local clock whether or not the cloud (or even the owner's phone) is reachable.
  The cloud is where history, rules, staff workflow and multi-device intelligence live.
- **Commands round-trip.** Every command carries an id; the device acknowledges it;
  the backend correlates the ack with the retained device state to close the loop.
- **Nothing hardcoded on devices.** Wi-Fi and broker credentials are provisioned
  once through a captive portal and stored on the device; firmware carries no secrets.

---

## 3. The two products

### 3.1 Smart Kennel (B2B) — for a breeding operation

A dog breeder runs a facility with pens/runs, breeding stock, and a rotating set of
litters and puppies going to buyers. The product's job is to make **routine care run
itself** and turn staff from task-doers into exception-handlers.

Every pen has a feeder, a water unit, a door, and environment sensors. Each dog wears
a collar. A doorway or feeding station has a scale. An on-site **edge box (Pet Hub)**
keeps everything working during an internet outage.

The staff console is built around a **care inbox** — a triaged list of the things that
actually need a human (a feeder jam, a dog that skipped two meals, a room over 28 °C,
a collar at 12% battery, the wrong dog in a pen). Everything nominal is hidden.

Alongside care, the console manages the **breeding pipeline**: litters and whelping
records, per-puppy growth, a buyer waitlist with deposits, and an automated weekly
"update pack" to each reserving family until go-home day.

### 3.2 Smart Pet Home (B2C) — for a household

The same feeder, water unit, camera, collar and sensors, sold as a home kit. The
owner app monitors and controls the household's devices, watches live video and talks
to the dog, sees where the dog is, and gets alerts that matter — fed / missed,
escaped a safe zone, room too hot, device offline. Multi-dog homes get per-dog
attribution so the right dog gets the right meal and intake is tracked per animal.

An optional low-cost **Pet Hub** gives a home the same offline resilience a kennel
gets: schedules keep firing through a Wi-Fi or power outage, and the app on the LAN
can still reach the devices.

### 3.3 Where the two products meet

Because both run on one platform, a home owner who boards their dog at a Smart-Pet
breeder/kennel can have the dog's **Care Plan** (diet, meds, vet, quirks) transfer for
the stay, and keep a live read-only view — the feeding log, the dog's room camera, the
growth chart — in the **same app they already use**. Neither a pure consumer product
nor a pure facility product can offer this.

---

## 4. Feature catalogue

Grouped by capability. "Product" = which product the feature serves
(**Kennel** / **Home** / **Both**).

> This is the full envisioned product. It is **not** all committed scope — see
> [`SMART-PET-PROGRESS.md`](SMART-PET-PROGRESS.md) for what is built and
> [`SMART-PET-DEV-PLAN.md`](SMART-PET-DEV-PLAN.md) for what is planned. Several
> items below (camera AI, home↔kennel sharing, vet/sitter links, household
> sharing, multi-site/franchise, analytics warehouse, treat-toss, subscription
> tiers) are **proposed but not approved** and sit in the progress file's backlog.

### 4.1 Devices & firmware

| Feature | Product | Description |
|---|---|---|
| **Unified firmware base (device SDK)** | Both | One shared library every device is built on: Wi-Fi provisioning via a captive portal (no hardcoded secrets), NTP time, MQTT on the canonical scheme with a last-will, OTA updates, and a command→acknowledgement dispatcher with built-in commands (restart, OTA, identify, set schedule, set interval). Device firmware becomes a thin behaviour layer. |
| **On-device schedule cache** | Both | Feeding/dosing schedules are stored on the device and fired on its real-time clock **even with no cloud or Wi-Fi**. |
| **On-device offline journal** | Both | While a device can't reach the cloud it records what it did; on reconnect it replays the missed actions and the dark-window so nothing is silently lost. |
| **Feeder** | Both | Servo auger + ultrasonic food-level, calibrated grams-per-second, jam detection. |
| **Water unit** | Both | Pump (timed or start/stop) + level + water-quality (TDS) + temperature. |
| **Smart pen / run door** | Kennel (Home optional) | Servo latch or maglock, reed-switch for true open/closed state, timed auto-relatch, defined fail-safe on power loss, and an audit reason on every actuation. |
| **Smart scale bowl / weight station** | Both | Load cell under a bowl or at a doorway: grams **actually eaten vs dispensed**, plus a stable-reading gate for dog body weight. |
| **Multi-dog identification** | Both | Feeder / door / camera scans for collar BLE tags and reports which dog is present — so intake is attributed to the right animal and a wrong dog is flagged. |
| **Environment sensor** | Both | Temperature / humidity / air-quality plus door and motion, from whatever sensors are wired. |
| **Firmware OTA + fleet management** | Both | Signed over-the-air updates, staged rollout, per-device version visibility, rollback. |
| **Two-way audio hardware** | Home | Microphone + speaker on the camera for listen/talk and calming-clip playback. |
| **Treat-toss / play module** | Home | A small motorised treat launcher, triggered from the app or as an activity reward. |

### 4.2 Connectivity & the Pet Hub

| Feature | Product | Description |
|---|---|---|
| **Pet Hub** | Both | A cheap always-on box (home) or edge box (kennel) that keeps devices working when the internet is down. |
| **Local device API** | Both | An HTTP API on the LAN — health, device list, recent events, schedule CRUD, and command submission — so the app or dashboard reaches devices without the cloud. |
| **Offline schedule runner** | Both | The hub fires feed/dispense commands on the LAN clock, cloud or not, with a tolerance window and a de-dup guard against double feeds. |
| **LAN command queue** | Both | A "feed now" issued on the local network is queued and delivered to the device over MQTT with a correlation id, then resolved when the device acknowledges — all with the internet down. |
| **Cloud bridge** | Both | The hub mirrors the tenant's device traffic to a cloud broker (state up, commands down), loop-safe. This is how a home hub reaches the cloud backend. |
| **Offline / power-cut behaviour** | Both | Devices keep schedules via clock + flash; the hub records each dark window; clients show an honest "last seen". An optional battery-backup accessory covers power cuts. |

### 4.3 Breeding-kennel operations (B2B)

| Feature | Description |
|---|---|
| **Per-dog Care Plan** | Diet (food SKU, grams/day, meals, assigned feeder/water device), allergies, medication summary, vet + emergency contacts, exercise and free-text notes. The record the automation acts on and staff work from. |
| **Animals & pens** | Dogs (sire/dam, microchip, collar, BLE tag, role, status, expected adult weight); pens (run / whelping / yard / quarantine) with live occupancy; move-a-dog between pens. |
| **Litter & whelping records** | Plan a litter (dam/sire, mating and due dates), record the whelp (count born / alive), assign to a pen. *(This is the breeding equivalent of a boarding kennel's check-in — see §5.)* |
| **Puppies** | Per-puppy record (collar colour, sex, birth weight, chip, BLE tag, status); growth assessed against the litter's expected curve; daily weight gain. |
| **Buyer & waitlist management** | Prospective buyers with an automatic waitlist rank, deposit tracking, matching a buyer to a specific puppy, and a go-home date. *(The breeding equivalent of a booking calendar — see §5.)* |
| **Puppy buyer "update pack"** | An automated weekly package to each reserving family — weight series, growth, health/vaccination log — until go-home day. *(Reframed from a boarding "stay report" — see §5.)* |
| **Medication log** | Scheduled medications; **staff give the dose in person and register it on the dashboard** (given / skipped / refused / vomited, with a note and optional photo). A due-list worklist, a 30-day compliance rate, and an automatic flag when a scheduled dose is overdue with no record. |
| **Automated play / enrichment scheduling** | A round-robin rotation of dogs through play yards / enrichment stations; activity minutes per session recorded from the collar. |
| **Multi-site / franchise view** | One organisation, many kennel locations, with a regional view and consolidated analytics. |

### 4.4 Health & wellbeing

| Feature | Product | Description |
|---|---|---|
| **Weight & growth curves** | Both | An expected-weight curve scaled to the dog's expected adult weight; each reading gets a deviation flag (ok / under / over / concern); daily-gain and weight-loss detection for puppies; body-condition trend vs a baseline for adults. |
| **Attributed intake & wrong-dog detection** | Both | Feed/water events attributed to a dog via BLE presence, schedule, or manual entry. The **wrong dog at a device or in a pen raises a critical alert** — a wrong-pen alert for a kennel, a multi-dog-home mix-up for an owner. |
| **Activity & wellness insights** | Both | Plain-language, **non-diagnostic** observations from intake / water / activity / weight trends ("drinking ~30% more than usual — worth a vet check"), delivered as a weekly digest. |
| **Camera AI — dog-centric clips & bark detection** | Home | Keep only the video where the dog appears, tag behaviour, build a short daily reel, and alert on sustained barking / distress. |

### 4.5 Safety & access

| Feature | Product | Description |
|---|---|---|
| **Emergency mode** | Kennel | One control — mode fire / flood / evac / drill — that unlocks the pen doors, generates an evacuation manifest (pen → dog → chip → vet/owner contacts), raises a top-priority alert and notifies everyone. `drill` rehearses without touching doors. Ending it re-locks and clears. |
| **Pen door access control** | Kennel (Home optional) | Remote lock / unlock / open / close with a reason, timed auto-relatch, true state from a reed switch, fail-safe on power loss, and a full audit trail of who opened what and when. |
| **Predictive maintenance** | Both | Running wear counters per device (servo cycles, pump run-time, door cycles, jams, Wi-Fi signal trend) turn into "service soon" predictions and raise a maintenance task **before** the part fails during a stay. |
| **GPS & safe zones** | Both | A real map, a home/kennel safe zone, an escape alert, and location history. |

### 4.6 Owner app (B2C)

| Feature | Description |
|---|---|
| **Feed Now + schedules** | Real command round-trip, live food level, a "fed" confirmation, portion history. |
| **Water monitoring** | Level, freshness (TDS / temperature), auto top-up, a "change the water" nudge. |
| **Live camera + motion clips** | HLS live view; motion clips saved to a timeline. |
| **Two-way audio — "talk to your dog"** | Listen in and speak through the camera; push-to-talk; play a pre-recorded calming clip on a schedule or when the bark detector fires. |
| **GPS & safe zones** | See where the dog is; get alerted if it leaves the safe zone. |
| **Home environment** | Room temperature / humidity for the dog's area; a "too hot" alert while the owner is out. |
| **Notifications** | Push for fed / missed, escaped safe zone, low food, camera motion, hot room, device offline. |
| **Household sharing** | Invite a partner / family member / dog-walker with scoped permissions. |
| **Vet & sitter share link** | A time-boxed link giving a vet a window of the dog's data, or a sitter a weekend of feed + camera access, with no permanent account. |
| **Bridge to a kennel** | When the dog is boarded at a Smart-Pet facility, the Care Plan transfers for the stay and the owner keeps a live read-only view in the same app. |
| **Accessibility & low-connectivity mode** | Works on slow/again connections and offline (cached state, queued commands); large-text and screen-reader support; SMS fallback for critical alerts. |

### 4.7 Automation & intelligence

| Feature | Product | Description |
|---|---|---|
| **Rules / automation engine** | Both | Per-tenant "when this, then that" rules: a trigger (device status, a telemetry threshold, a missed meal, low battery, a wrong dog, a device offline, maintenance due), optional conditions, and actions (raise a task, notify, send a device command, switch a pen relay such as a fan or heat lamp). Each rule has a cooldown; rules can be dry-run and their firing history reviewed. |
| **Preset rules** | Both | A ready set of parameterised starters (whelping-room temperature high/low, collar battery low, two missed meals, wrong dog, device offline, feeder motor near its service limit) installable in one step. |

### 4.8 Notifications & alerting

| Feature | Product | Description |
|---|---|---|
| **Care inbox / exception queue** | Kennel (Home: a simpler alert list) | The primary staff screen: a triaged list ranked so stale critical items float to the top, with acknowledge / snooze / resolve / escalate / assign, de-dup while an item is open, a suggested action per item, and the notification history for each. |
| **Notification service** | Both | Per-recipient channel choices, **quiet hours** (with a severity override so a real emergency still gets through), and **escalation chains** — if an alert isn't acknowledged within N minutes it escalates to the next contact/channel. Channels: push, SMS, email, in-app, and a local siren. |

### 4.9 Supplies

| Feature | Product | Description |
|---|---|---|
| **Consumables low-stock warning** | Both | Track food, water filters, medication and bedding on hand against a threshold, project the run-out date from actual usage, and **warn the owner/staff to buy and replace** — no automated ordering. |
| **Tiered bundles + subscription** | Home | Starter / Watch / Care hardware bundles, with an optional monthly plan for cloud video retention, wellness insights, and cellular collar data. Core safety alerts stay free. |

### 4.10 Platform

| Feature | Description |
|---|---|
| **Canonical MQTT contract** | One protocol for both products and every device type, with typed message shapes for every topic leaf and a command router that turns an inbound message into a typed handler call and its acknowledgement (see §7). |
| **Virtual-kennel simulator** | Simulated devices that speak the real protocol, plus scripted failure scenarios (feeder jam, offline device, temperature spike, low battery, wrong dog), so the backend and the hub can be exercised end-to-end without hardware — in development and in CI. |
| **Data & analytics warehouse** | A columnar store fed by the event stream for operational reports, per-dog history across stays, wellness-model training data, and product analytics. |
| **Privacy & data-governance** | Camera-footage retention windows, per-role view permissions, disclosure of what is processed on the device vs in the cloud, GDPR data export and delete, a clear kennel-vs-owner data-ownership model during a stay, and audit logs on every camera and door access. |

---

## 5. Why the B2B side is breeder-shaped

The original concept assumed a **boarding** kennel. The operator does **breeding
only** — dogs live at the facility; there are no guests arriving and leaving. Three
boarding features are therefore replaced with breeding equivalents:

| Boarding feature | Why it doesn't fit breeding | Breeding replacement |
|---|---|---|
| Digital check-in / check-out kiosk | No guests arrive or leave | **Litter & whelping records** |
| Booking & occupancy calendar | Nothing is reserved by the night | **Buyer & waitlist management** |
| Owner "stay report" after a visit | There is no visit | **Puppy buyer "update pack"** |

The core care features — Care Plan, care inbox, rules, environment control, weights,
maintenance, emergency mode — apply unchanged.

---

## 6. Scope decisions

**Explicitly out of scope:**

- **Feeding safety interlocks** — capping manual "bonus" feeds or warning that
  someone already fed the dog. The dispensers are meant to always work; the
  overfeeding guard was cut.
- **"Away Mode" one-tap routine** — a bundle toggle for leaving the house.
  Scheduled feeding and water always run regardless, so the toggle adds nothing.
- **Consumables auto-reorder** — the product warns and links; it does not place
  orders or take payment.

**Open questions** (business / go-to-market):

1. Which product ships first — the Home kit or the Kennel system?
2. Custom-manufactured devices, or off-the-shelf ESP32 kits for the first release?
3. Own camera hardware, or support standard ONVIF/RTSP IP cameras?
4. Collar connectivity: Wi-Fi only for the MVP, or cellular (LTE-M) from the start?
5. Is there a paid subscription tier?
6. EU first (GDPR, CE marking) or US first?
7. One "Smart Pet" brand for both products, or distinct brands on one platform?

---

## 7. Appendix — the device protocol

Every device speaks one MQTT scheme:

```
kennel/{kennelId}/{deviceType}/{deviceId}/{leaf}

deviceType : feeder | water | door | sensor | gps | camera | scale | hub
leaf       : status | command | event | ack | telemetry | location | presence | audio
             | temperature | humidity | airquality | weight | tds | level | battery

delivery   : command → exactly-once, not retained
             status  → at-least-once, RETAINED   (last-will clears it to "offline")
             others  → at-least-once, not retained

command    : { command, id, deviceId, kennelId, timestamp, params }
ack        : { ackId, command, result: ok | error | rejected | queued }
presence   : { tagId, rssi, nearby: [...] }              ← multi-dog identification
audio      : { session, signal: { kind: offer|answer|ice|talk|play|stop } }  ← two-way audio

commands   : feed{amount} · dispense{seconds|ml} · schedule_set{schedules[]} ·
             door{action, reason, holdMs} · relay{relay, state, forMs} ·
             ota{url, version} · restart · set_interval{seconds} · identify{seconds}
```

`kennelId` is the tenant string — a breeder-kennel slug for B2B, a household id for
B2C. The same broker, ACL model and message shapes serve both products.
