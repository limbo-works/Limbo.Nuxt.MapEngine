import {
	defineNuxtModule,
	addImportsDir,
	createResolver,
	addComponentsDir,
} from '@nuxt/kit';

// The runtime types are part of the public API — re-exported here so a
// packaged consumer can `import type { IEngine } from '@limbo-works/map-engine'`
export type * from './runtime/types';

// utils/ isn't auto-import-registered (only composables/ and components/
// are), so these two helpers — genuinely useful outside the engine itself,
// e.g. building a custom search UI — are re-exported explicitly here.
// `src/runtime` is external to the module build (mkdist compiles it
// separately into dist/runtime/*.mjs) — build.config.cjs rewrites this
// specifier to the .mjs-suffixed path in the published dist/module.mjs, so
// it stays extensionless here for Bundler module resolution/typechecking.
export { isPointInGroup } from './runtime/utils/points';
export { normalizeSearchText } from './runtime/utils/search';

// Module options TypeScript interface definition
export interface ModuleOptions {}

export default defineNuxtModule<ModuleOptions>({
	meta: {
		name: '@limbo-works/map-engine',
	},

	setup() {
		const resolver = createResolver(import.meta.url);

		addImportsDir(resolver.resolve('./runtime/composables'));

		addComponentsDir({
			path: resolver.resolve('./runtime/components'),
			pathPrefix: false,
		});
	},
});
