import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
	modules: ['../src/module'],
	devtools: { enabled: true },

	// Nitro's vercel preset writes to `{rootDir}/.vercel/output`, where
	// rootDir is this playground folder — but Vercel's project Root
	// Directory is the repo root, so the output must land one level up.
	...(process.env.VERCEL && {
		nitro: {
			output: {
				dir: fileURLToPath(
					new URL('../.vercel/output', import.meta.url)
				),
			},
		},
	}),
});
