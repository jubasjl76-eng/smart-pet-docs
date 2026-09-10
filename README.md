# smart-pet-docs

Canonical engineering docs for the Smart Pet platform, plus a
[Starlight](https://starlight.astro.build/) site that renders them
(hardening Phase 14).

## Layout

| Path | What |
| --- | --- |
| `*.md` (root) | The canonical docs — single source of truth. Edit these. |
| `adr/` | Architecture Decision Records. |
| `site/` | The Starlight site. `site/scripts/sync-content.mjs` copies the root docs + ADRs into the content collection at build time — **never edit `site/src/content/docs/`**. |
| `site/pages/` | Hand-authored site-only pages (landing, API/MQTT reference). |

## The site

```bash
cd site
npm ci
npm run dev      # http://localhost:4321/smart-pet-docs
npm run build    # -> site/dist
```

Deployed to GitHub Pages on push to `main`
(`https://jubasjl76-eng.github.io/smart-pet-docs/`).

## Branches

`main` is the integration branch (docs repo — no `development`). Changes land
via PR, same as every other repo (`REPOSITORIES.md`, Rule 1).
