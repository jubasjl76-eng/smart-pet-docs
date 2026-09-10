---
title: HTTP API reference
description: The Smart Pet backend + camera-service OpenAPI specs.
---

Every backend route is defined once as a zod schema and emitted as **OpenAPI 3**
(Phase 14). The spec is served live and is the input to
`@jubasjl76-eng/api-client` (the generated TypeScript client).

## Live specs

| Service | Spec | Reference UI |
| --- | --- | --- |
| `smart-pet-backend` | `GET /openapi.json` | `GET /docs` (Scalar) |
| `pet-iot-camera-service` | `GET /api/openapi.json` | `GET /api/docs` (Scalar) |

The versioned path is `/api/v1/*`; bare `/api/*` is a deprecated alias that
still works but carries `Deprecation` + `Sunset` headers (see the
[hardening plan](/smart-pet-docs/hardening-plan/), section A1).

## Committed snapshot

`smart-pet-backend` commits `openapi.json` at its repo root and a vitest check
fails the build if it drifts from the registered routes. The daily `regen`
workflow in `smart-pet-api-client` opens a patch-bump PR whenever the spec
changes:

<https://raw.githubusercontent.com/jubasjl76-eng/smart-pet-backend/development/openapi.json>

## Client

```ts
import { createSmartPetClient } from '@jubasjl76-eng/api-client';

const api = createSmartPetClient({
  baseUrl: '/api/v1',
  token: () => localStorage.getItem('accessToken'),
});

const { data, error } = await api.GET('/api/breeder/inbox');
```

Bearer auth + jittered retry/backoff on `429` / `5xx` (honours `Retry-After`,
idempotent methods + keyed POSTs only) + a `RateLimitedError` once retries are
exhausted.
