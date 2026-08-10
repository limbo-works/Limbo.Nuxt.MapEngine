# Cookbook

Recipes for common integration tasks. Each is self-contained; all assume
the [Getting started](./getting-started.md) baseline (an `engine`, a
`<MapEngine>` with slots). The playground implements a full version of
most of these — file pointers are given per recipe.

## A custom pin with selection and hover states

_Reference: `playground/components/MapPointPin.vue`._

The `#point` slot renders inside a positioned `<MapPoint>` wrapper that
already handles clicks (`engine.activatePoint`) and carries the
selection/stacking classes — your pin only draws visuals and reads
state:

```vue
<template>
	<span
		:class="[
			'my-pin',
			{
				'my-pin--selected':
					point.selectedAsDestination || point.selectedAsOrigin,
				'my-pin--previewed': previewed,
			},
		]"
	>
		<span v-if="icon" class="my-pin__icon" v-html="icon"></span>
		<span v-else class="my-pin__label">{{ point.label }}</span>
	</span>
</template>

<script setup>
const props = defineProps({
	point: { type: Object, required: true },
	engine: { type: Object, required: true },
	previewed: { type: Boolean, default: false },
});

const icon = computed(() => props.point.content?.icon);
</script>

<style>
:where(.my-pin) {
	display: block;
	transition: scale 150ms ease;
	transform-origin: inherit; /* grows from the point's anchor */

	&.my-pin--selected {
		scale: 1.12;
	}
}
</style>
```

Notes:

- Scale/hover animations belong on your pin element (CSS), never on the
  `<MapPoint>` wrapper — the wrapper's transform is engine-managed.
- `transform-origin: inherit` picks up the point's anchor, so growth
  happens around the pin tip rather than the box center.
- A hover-preview state (pin highlighted from a list hover) should be a
  prop like `previewed` — visual only, no engine state involved.

## A content overlay driven by `onActivatePoint`

_Reference: `playground/components/MapContentOverlay.vue` +
[its doc page](./map-content-overlay.md)._

The pattern is: a consumer-owned `openPoint` ref, set by
`onActivatePoint`, rendered by your own panel in the `#overlay` slot.

```js
const openPoint = ref(null);

const engine = useMapEngine({
	onActivatePoint(point) {
		const { content } = point;

		if (content?.blocks?.length) {
			openPoint.value = point;
		} else if (content?.link?.url) {
			window.open(content.link.url, content.link.target ?? '_self');
		}
	},
});
```

Define your own `content` shape per site — `{ blocks, link, icon }` is
the playground's, not a contract. If the panel covers part of the map
while open, re-frame the focused point into the visible strip:

```js
// panel is 65% wide on the right → put the point at 17.5% from the left
engine.viewport.zoomTo(point.position, engine.focusScale, {
	...engine.focusAnimation,
	origin: { x: 0.175, y: 0.5 },
});
```

## Group filter pills with counts

_Reference: `playground/components/MapFilterPills.vue`._

```vue
<template>
	<ul>
		<li v-for="group in engine.groups" :key="group.id">
			<button
				type="button"
				:style="{ backgroundColor: group.color }"
				:aria-pressed="engine.selectedGroup === group"
				@click="engine.toggleGroup(group)"
			>
				{{ group.label }}
				({{ engine.getGroupPoints(group).length }})
			</button>
		</li>
	</ul>
</template>
```

`toggleGroup` handles the select/deselect cycle; selecting frames the
group's points and clears any point selection. Mix toggleable _layers_
into the same pill row via `engine.getToggleableLayers()` +
`engine.toggleLayer(layer)` — layers and groups are independent filter
mechanisms that happen to share a UI in the design.

## Search UI

_Reference: `playground/components/MapSearch.vue`._

```js
const query = ref('');
const results = computed(() => engine.searchPoints(query.value));

function choose(point) {
	engine.selectPoint(point); // frames + highlights it
	query.value = '';
}
```

`searchPoints` matches `label` first, then `tags`, Danish-normalized.
For custom matching (e.g. also searching your own content payload),
build on the exported normalizer so behavior stays consistent:

```js
import { normalizeSearchText } from '@limbo-works/map-engine';
```

## Pseudo-wayfinding ("where are you now?")

_Reference: the origin flow in `playground/components/MapSearch.vue`._

```js
// user picked a destination earlier via engine.selectPoint(point)
engine.selectOriginPoint(originPoint);
// → map narrows to the two endpoints, frames both, force-shows the
//   kind: 'walking-routes' layer

engine.selectOriginPoint(null); // origin cleared, map restores
```

Selecting a _new_ destination clears the origin pairing automatically.
Derive UI state by scanning points:

```js
const destination = computed(() =>
	engine.points.find((p) => p.selectedAsDestination)
);
const origin = computed(() => engine.points.find((p) => p.selectedAsOrigin));
```

## Zoom buttons and a floor switcher

_Reference: `playground/components/MapZoomButtons.vue` /
`MapFloorSwitcher.vue`._

```js
// zoom buttons — multiplicative steps feel even across the range
engine.viewport.zoomBy(1.5); // in
engine.viewport.zoomBy(1 / 1.5); // out
```

```vue
<template>
	<nav v-if="engine.getAvailableFloors().length">
		<button
			v-for="floor in engine.getAvailableFloors()"
			:key="floor.id"
			type="button"
			:aria-pressed="engine.selectedFloor === floor"
			@click="engine.selectFloor(floor)"
		>
			{{ floor.label }}
		</button>
	</nav>
</template>
```

`getAvailableFloors()` is already zoom-gated — the `v-if` makes the
whole switcher disappear when no floor layer is in range.

## Wiring CMS data

_Reference: the Herningsholm client's `MapPage.vue` doctype (in the
consuming solution, not this repo)._

The engine is CMS-agnostic; the consuming page translates. The typical
translation steps:

```js
// 1. Coordinates: if the CMS stores normalized [0,1] positions,
//    convert to world-pixel space using the world size
const { width, height } = worldSize; // from your largest sprite
engine.points.push(
	useMapPoint({
		id: cmsPoint.id,
		label: cmsPoint.label,
		x: cmsPoint.x * width,
		y: cmsPoint.y * height,
		// 2. Layer mapping: CMS layer ids → engine layer names
		layer: LAYER_BY_CMS_ID[cmsPoint.layerId],
		// 3. Groups: invert the CMS's group→points lists into per-point ids
		groups: groupsByPoint.get(cmsPoint.id) ?? [],
		// 4. Content: your own opaque payload
		content: { blocks: cmsPoint.popup, link: cmsPoint.link },
	})
);
```

Icon assets referenced by URL should be fetched up front (deduplicated,
client-side) and inlined into `content`, so pins can render recolorable
inline SVG without per-pin requests.

## Deep links from elsewhere

With `useMapUrlSync` active, any page can link into a specific map
state using only the params it cares about — no need to reproduce the
rest:

```
/map/?group=food              a group filter
/map/?point=cafe              a selected POI (framed on load)
/map/?floor=1&layers=routes:1 floor 1 with the routes layer on
```

Params reference stable ids (`IPoint.id`, `IGroup.id`, `IFloor.id`,
`ILayer.name`) — treat those as public API once links exist in the wild.
See [`useMapUrlSync`](./use-map-url-sync.md) for the full format.

## Tuning input feel

```js
const engine = useMapEngine({
	viewport: {
		wheelSensitivity: 0.5, // wheel/trackpad zoom speed (not touch)
		momentum: 0, // disables the release glide entirely
	},
});
```

Touch pinch and drag are deliberately not tunable — they're geometric
(the world point under a finger stays under it).

## Programmatic camera moves

All motion funnels through the same animated path the gestures use:

```js
engine.viewport.zoomTo({ x: 14311, y: 13682 }, 6); // world point, scale
engine.viewport.zoomTo(point.position, 6, { origin: { x: 0.75, y: 0.5 } });
engine.viewport.fitToPoints(positions, { padding: { left: 420 } });
engine.viewport.pan({ x: -120, y: 0 });
engine.viewport.stop(); // freeze mid-animation
```

Pass `{ duration, easing }` on any call to override the defaults; reuse
`engine.focusAnimation` to match the selection framing's spring. For a
scripted sequence you don't want reflected in the address bar, wrap it
in the URL sync's `pause()`/`resume()`.
