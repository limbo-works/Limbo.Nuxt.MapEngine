import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		vue(),

		// Mirrors the auto-imports a consuming Nuxt app provides: Vue APIs
		// plus this module's own composables (module.ts addImportsDir).
		// Scoped to playground SFCs only — src/runtime is distributed module
		// code and must keep compiling on its explicit imports alone.
		AutoImport({
			include: [/playground[\\/].+\.vue$/],
			imports: ['vue'],
			dirs: [
				fileURLToPath(
					new URL('./src/runtime/composables', import.meta.url)
				),
			],
			// Global declarations for the auto-imported APIs, so vue-tsc
			// (tsconfig.typecheck.json) accepts playground components the
			// same way a consuming Nuxt app's generated types would
			dts: 'test/auto-imports.d.ts',
		}),
	],

	test: {
		environment: 'jsdom',
		include: ['test/**/*.spec.ts'],
		setupFiles: ['./test/setup.ts'],
	},
});
