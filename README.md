# @limbo-works/map-engine

A Nuxt module providing a pan/zoom SVG map engine: stacked SVG layers,
positioned points of interest (POIs), floors, cross-layer group filters,
search, pseudo-wayfinding, and shareable-URL state — with the consuming
site in full control of every visual (pins, overlays, filter pills) via
slots and an opaque per-point content payload.

The engine renders at a locked 120 FPS on displays that support it, even
inside solutions with large stylesheets — see
[Performance](./docs/performance.md) for the architecture that makes that
hold and the rules for keeping it.

## What it is (and isn't)

- **Is:** the standalone runtime — viewport gestures and animation, layer
  visibility (floors, zoom thresholds, toggles), point positioning and
  selection, grouping, search, URL sync.
- **Isn't:** a UI kit or a CMS integration. The engine ships no pins, no
  search field, no overlay panel — the `playground/` app demonstrates one
  full set of those, and each consuming site builds (or copies) its own.
  The Umbraco side (page type, editor UI, icon pool) lives in the
  consuming solution's backend, not here.

## Installation

The package is published to the `@limbo-works` GitHub Packages registry
(the usual `.npmrc` auth token applies):

```bash
yarn add @limbo-works/map-engine
```

```js
// nuxt.config.js
export default defineNuxtConfig({
	modules: ['@limbo-works/map-engine'],
});
```

While unpublished (or when developing against a local checkout), point
`modules` at the module source instead and alias the package name to the
runtime directory:

```js
// nuxt.config.js
export default defineNuxtConfig({
	modules: [
		fileURLToPath(new URL('../../package/src/module', import.meta.url)),
	],
	alias: {
		'@limbo-works/map-engine': fileURLToPath(
			new URL('../../package/src/runtime', import.meta.url)
		),
	},
});
```

The module auto-imports the composables (`useMapEngine`, `useMapLayer`,
`useMapPoint`, `useMapGroup`, `useMapFloor`, `useMapSprite`,
`useMapGestures`, `useMapUrlSync`) and auto-registers the components
(`MapEngine`,
`MapViewport`, `MapLayer`, `MapPoint`). Types and the two exported utils
come from the package entry:

```ts
import type { IEngine, IPoint } from '@limbo-works/map-engine';
import { normalizeSearchText, isPointInGroup } from '@limbo-works/map-engine';
```

## Minimal map

```vue
<template>
	<MapEngine :engine="engine">
		<template #point="{ point }">
			<!-- clicks are routed by the wrapper: first selects, second activates -->
			<button type="button">{{ point.label }}</button>
		</template>
	</MapEngine>
</template>

<script setup>
import baseSprite from '~/assets/map/base.svg?raw';

const engine = useMapEngine();

engine.layers.push(useMapLayer({ name: 'base', sprite: baseSprite }));

engine.points.push(
	useMapPoint({ id: 'cafe', label: 'Café', x: 4200, y: 3100 })
);
</script>

<style>
.c-map-engine {
	position: fixed;
	inset: 0;
}
</style>
```

`x`/`y` are in the SVG's own coordinate space (world-pixel space — see
[Getting started](./docs/getting-started.md#coordinate-spaces)). The
`.c-map-engine` root has no intrinsic size; the consumer sizes it.

## Documentation

- **[Getting started](./docs/getting-started.md)** — step-by-step guide
  from an empty page to a full map with floors, groups, search, an
  overlay, and URL sync.
- **[Sprite authoring](./docs/sprite-authoring.md)** — how the map SVGs
  must be produced for the engine's layering, scaling, and stroke
  mechanics to work.
- **[Cookbook](./docs/cookbook.md)** — recipes for common integration
  tasks (custom pins, content overlays, wayfinding, CMS wiring).
- **[Performance](./docs/performance.md)** — the frame-rate architecture
  and the rules for not regressing it.
- **[API reference](./docs/README.md)** — every composable option,
  component prop/slot, CSS hook, and URL param.

## Development

```bash
yarn dev          # playground app (the de facto integration example)
yarn test         # vitest
yarn lint         # eslint
yarn typecheck    # vue-tsc
```

The `playground/` app consumes the module exactly the way a real site
would — through the public surface only. Its demo UI (pins, search,
pills, overlay) is reference material, not shipped API.
