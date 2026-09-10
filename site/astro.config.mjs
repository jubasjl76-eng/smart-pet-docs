// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// GitHub Pages project site: https://jubasjl76-eng.github.io/smart-pet-docs/
export default defineConfig({
  site: 'https://jubasjl76-eng.github.io',
  base: '/smart-pet-docs',
  integrations: [
    starlight({
      title: 'Smart Pet — Engineering Docs',
      description:
        'Architecture, ADRs, environment + repo model, and the API / MQTT contracts for the Smart Pet platform.',
      social: { github: 'https://github.com/jubasjl76-eng' },
      sidebar: [
        {
          label: 'Overview',
          items: [
            { label: 'Introduction', slug: 'index' },
            { label: 'Build progress', slug: 'progress' },
            { label: 'Operator actions', slug: 'operator-actions' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Repository model', slug: 'repositories' },
            { label: 'Environment strategy', slug: 'environments' },
            { label: 'Hardening plan (11–21)', slug: 'hardening-plan' },
          ],
        },
        { label: 'Decisions (ADR)', autogenerate: { directory: 'adr' } },
        {
          label: 'Contracts',
          items: [
            { label: 'HTTP API reference', slug: 'reference/api' },
            { label: 'MQTT / AsyncAPI', slug: 'reference/mqtt' },
          ],
        },
        {
          label: 'Product',
          items: [
            { label: 'Product overview', slug: 'product' },
            { label: 'Vision & ideas', slug: 'vision' },
            { label: 'Privacy policy', slug: 'privacy-policy' },
          ],
        },
      ],
    }),
  ],
});
