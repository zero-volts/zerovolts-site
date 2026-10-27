import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  output: 'static',
  integrations: [
    starlight({
      title: 'Zerovolts',
      locales: {
        root: { label: 'Español', lang: 'es' },
      },
      sidebar: [
        { label: 'Inicio', link: '/' },
        {
          label: 'Tutoriales',
          items: [{ autogenerate: { directory: 'meta' } }],
        },
      ],
    }),
  ],
});