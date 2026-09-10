/**
 * Copy the canonical markdown docs (repo root + adr/) into the Starlight
 * content collection, adding the `title` frontmatter Starlight needs.
 *
 * The root .md files stay the single source of truth; this is a build step,
 * never edit files under src/content/docs/ by hand.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const outDir = join(here, '..', 'src', 'content', 'docs');

/** root file -> { slug, title } */
const ROOT_DOCS = {
  'REPOSITORIES.md': { slug: 'repositories', title: 'Repository model' },
  'ENVIRONMENTS.md': { slug: 'environments', title: 'Environment strategy' },
  'SMART-PET-HARDENING-PLAN.md': { slug: 'hardening-plan', title: 'Hardening plan (Phases 11–21)' },
  'SMART-PET-PROGRESS.md': { slug: 'progress', title: 'Build progress' },
  'SMART-PET-PRODUCT.md': { slug: 'product', title: 'Product overview' },
  'SMART-PET-VISION-AND-IDEAS.md': { slug: 'vision', title: 'Vision & ideas' },
  'PRIVACY-POLICY.md': { slug: 'privacy-policy', title: 'Privacy policy' },
};

function firstHeading(md) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].replace(/`/g, '') : null;
}

/** Wrap body in Starlight frontmatter; strip a leading H1 (title renders it). */
function toEntry(title, body) {
  const stripped = body.replace(/^#\s+.+?\r?\n+/, '');
  const safeTitle = String(title).replace(/"/g, '\\"');
  return `---\ntitle: "${safeTitle}"\n---\n\n${stripped}`;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'adr'), { recursive: true });

for (const [file, { slug, title }] of Object.entries(ROOT_DOCS)) {
  let md;
  try {
    md = readFileSync(join(repoRoot, file), 'utf8');
  } catch {
    console.warn(`[sync] skip missing ${file}`);
    continue;
  }
  writeFileSync(join(outDir, `${slug}.md`), toEntry(title, md));
}

// ADRs
for (const file of readdirSync(join(repoRoot, 'adr')).filter((f) => f.endsWith('.md'))) {
  const md = readFileSync(join(repoRoot, 'adr', file), 'utf8');
  writeFileSync(join(outDir, 'adr', file), toEntry(firstHeading(md) ?? file.replace(/\.md$/, ''), md));
}

// Hand-authored pages that live with the site
mkdirSync(join(outDir, 'reference'), { recursive: true });
for (const f of readdirSync(join(here, '..', 'pages'))) {
  const src = readFileSync(join(here, '..', 'pages', f), 'utf8');
  const target = f === 'index.mdx' ? join(outDir, f) : join(outDir, 'reference', f);
  writeFileSync(target, src);
}

console.log('[sync] content collection rebuilt');
