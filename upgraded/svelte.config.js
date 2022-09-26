/* jshint esversion: 11 */

// Imports
import preprocess from 'svelte-preprocess';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// import node from '@sveltejs/adapter-node';
// import adapter from '@sveltejs/adapter-static';
import adapter from '@sveltejs/adapter-netlify';
const production = process.env.NODE_ENV === 'production';


// Adapters
// import vercelAdapter from '@sveltejs/adapter-vercel';

// Custom require function as replacement for the require from the commonJS in ES Module

// Custom __dirname as replacement for the __dirname from the commonJS in ES Module
const __dirname = dirname(fileURLToPath(import.meta.url)); // jshint ignore:line

const options = JSON.stringify(process.env.OPTIONS || '{}');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		preprocess({
			postcss: true,
			preserve: ['ld+json', 'module'],
			typescript: true,
		}),
	],

	kit: {
		adapter: adapter,
		target: '#starter',
		ssr: true,
		prerender: {
			crawl: true,
			enabled: true,
			onError: 'fail',
			pages: ['*'],
		},
		appDir: '_app',
		files: {
			assets: 'static',
			// hooks: 'src/hooks',
			lib: 'src/lib',
			// routes: 'src/routes',
			// serviceWorker: 'src/service-worker',
			// template: 'src/app.html'
		},
		// floc: true,
		// hydrate: true,
		// paths: {
		// 	assets: '',
		// 	base: ''
		// },

		vite: () => ({
			watch: {
				ignored: ['**/static/**']		// undocumented in vite
			  },
			resolve: {
				alias: {
					$stores: resolve(__dirname, './src/stores'),
					$components: resolve(__dirname, './src/lib/shared/components'),
					$ui: resolve(__dirname, './src/lib/shared/ui'),
					$layouts: resolve(__dirname, './src/lib/layouts'),
					$shared: resolve(__dirname, './src/lib/shared'),
					$models: resolve(__dirname, './src/lib/models'),
					$data: resolve(__dirname, './src/lib/data'),
					$core: resolve(__dirname, './src/lib/core'),
					$utils: resolve(__dirname, './src/lib/utils'),
					$environment: resolve(__dirname, './src/environments'),
				},
			},
			envPrefix: ['VITE_', 'SVELTEKIT_STARTER_'],
			plugins: [],
		}),
	},
};

export default config;
