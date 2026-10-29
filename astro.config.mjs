import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://zerovolts-site.pages.dev/',
  output: 'static',
  integrations: [
    starlight({
      title: 'Zerovolts',
      customCss: ['./src/styles/custom.css'],
      components: {
        PageTitle: './src/components/PageTitle.astro',
        ThemeProvider: './src/components/DarkTheme.astro',
        ThemeSelect: './src/components/DarkTheme.astro',
      },
	  favicon: '/favicon.svg',
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
	  social: [
		{
			icon: 'github',
			label: 'zero-volts code',
			href: 'https://github.com/zero-volts',
		},
		{
			icon: 'youtube',
			label: 'zero-volts',
			href: 'https://www.youtube.com/@zero-volts',
		}
	  ],
    }),
  ],
});
