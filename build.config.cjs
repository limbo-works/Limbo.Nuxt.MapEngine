// CommonJS on purpose (not build.config.ts + defineBuildConfig): unbuild's
// own build.config loader (jiti, interopDefault: true) does not unwrap an
// ESM `export default` here — it comes back as `{ default: ... }`, so
// every setting below would silently be ignored. A plain `module.exports`
// object is returned as-is.
//
// module.ts re-exports two runtime/utils/* helpers as real values (not
// just types) — see the comment there. src/runtime is externalized (mkdist
// compiles it separately into dist/runtime/*.mjs), so these two imports
// reach Rollup as relative external specifiers rather than getting bundled.
//
// Two problems follow from that, both worked around here rather than in
// module.ts itself:
// - mkdist emits `points.mjs`/`search.mjs`, but Rollup's default handling
//   keeps module.ts's extensionless specifier verbatim in dist/module.mjs,
//   which doesn't resolve under Node ESM — breaking both @nuxt/module-
//   builder's own dist/module.mjs load (used to generate dist/types.d.ts)
//   and, in principle, any consumer resolving the package under strict Node
//   ESM. `dist/module.mjs` and `dist/runtime/` are always siblings (fixed
//   `outDir`s in @nuxt/module-builder's build command), so the `resolveId`
//   plugin below hands Rollup the exact final relative path directly via
//   `external: true`.
//   IMPORTANT: this plugin only ever gets a chance to run because the
//   `externals` entries below are exact strings matching the *.mjs* id,
//   not a prefix/regex — Rollup checks `externals` against the *raw,
//   unresolved* import specifier before any plugin's resolveId runs, so a
//   pattern that also matched the extensionless raw specifier
//   ("./runtime/utils/points") would mark it external right there and
//   skip this plugin entirely, reproducing the extensionless output.
// - unbuild's implicit-dependency check separately flags any externalized
//   import whose final id doesn't match `externals` — the module-builder-
//   provided `/src\/runtime/` pattern doesn't match our `.mjs` id, so it's
//   listed explicitly here too.
const RUNTIME_UTIL_SPECIFIERS = {
	'./runtime/utils/points': './runtime/utils/points.mjs',
	'./runtime/utils/search': './runtime/utils/search.mjs',
};

module.exports = {
	externals: Object.values(RUNTIME_UTIL_SPECIFIERS),
	hooks: {
		'rollup:options'(_ctx, rollupOptions) {
			rollupOptions.plugins.unshift({
				name: 'map-engine-runtime-utils-external',
				enforce: 'pre',
				resolveId(source, importer) {
					if (!importer || !(source in RUNTIME_UTIL_SPECIFIERS)) {
						return null;
					}

					return {
						id: RUNTIME_UTIL_SPECIFIERS[source],
						external: true,
					};
				},
			});
		},
	},
};
