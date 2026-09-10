---
title: MQTT / AsyncAPI
description: The Smart Pet device protocol — topic scheme, payloads, QoS policy.
---

The device protocol is **protocol v2**, published as
[`@jubasjl76-eng/mqtt-contract`](https://github.com/jubasjl76-eng/smart-pet-mqtt)
and described as **AsyncAPI 3.1** in that repo's `asyncapi.yaml` (CI-validated).

## Topic scheme

```
kennel/{kennelId}/{deviceType}/{deviceId}/{leaf}
```

- `kennelId` — tenant string (a kennel slug for B2B, a household id for B2C)
- `deviceType` — `feeder | water | door | sensor | gps | camera | scale | hub`
- `leaf` — `status | command | event | ack | telemetry | location | presence | audio`
  or a single sensor metric (`temperature`, `humidity`, `weight`, …)

A backend subscribes `kennel/{id}/#` and gets everything for a tenant.

## Delivery policy (per leaf)

| Leaf | QoS | Retained |
| --- | --- | --- |
| `command` | 2 | no |
| `status` | 1 | yes (also the LWT topic) |
| `event`, `ack`, `telemetry`, `location`, `presence`, `audio`, metrics | 1 | no |

## Consumers

| Repo | How it consumes the contract |
| --- | --- |
| `pet-iot-edge-gateway` | `@jubasjl76-eng/mqtt-contract` (topics + `commandId`) |
| `smart-pet-backend` | topic helpers from the package; feeder payload layer stays local (v1 wire format, deployed firmware) |
| `smart-pet-device-sdk` | C++ `spd_topics.h` — hand-written logic; the device-type list + QoS policy are contract-derived |

Full channel definitions: `asyncapi.yaml` in
[`smart-pet-mqtt`](https://github.com/jubasjl76-eng/smart-pet-mqtt/blob/main/asyncapi.yaml).
