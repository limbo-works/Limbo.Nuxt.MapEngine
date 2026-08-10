# Getting started

A walkthrough from an empty page to a working map with layers, floors,
points, groups, search, a content overlay, and shareable URLs. Every step
builds on the previous one; the finished result is structurally the same
as `playground/app.vue`, which remains the live reference.

The example is a generic two-building campus. Swap in your own sprites
and data — nothing below depends on the demo content.

## Mental model

Three ideas carry the whole engine:

1. **One reactive engine object.** `useMapEngine()` returns the single
   `IEngine` root. Everything — layers, points, groups, floors, the
   viewport, selection state — hangs off it, and every `Map*` component
   receives it as an explicit `:engine="engine"` prop (no
   provide/inject). You populate its arrays yourself by pushing
   `useMapLayer`/`useMapPoint`/`useMapGroup`/`useMapFloor` results onto
   them.
2. **Layers are stacked SVGs; points are screen-space DOM.** Layer
   sprites live inside the pan/zoom transform and scale with the map.
   Points are positioned wrappers _outside_ the transform, repositioned
   per frame via `worldToScreen` — so your pin markup keeps a constant
   screen size and ordinary CSS behavior regardless of zoom.
3. **The engine owns behavior, you own visuals.** It ships no pin, no
   search field, no overlay. You supply markers through the `#point`
   slot, UI through the `#overlay` slot, and decide what activating a
   point does via `onActivatePoint`.

### Coordinate spaces

You will mostly touch the first of these; the other two exist so you can
read the API docs without surprises:

| Space            | Used by                                       | Meaning                                                                                         |
| ---------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **World-pixel**  | `IPoint.position` (`x`/`y` options), `zoomTo` | Raw coordinates in the reference layer's native SVG units — what you read off the SVG in Figma. |
| **Normalized**   | `viewport.center`, URL params                 | `[0, 1]` of the world on each axis, independent of world size. Stable enough to share via URL.  |
| **Screen-pixel** | `worldToScreen`/`screenToWorld`, gesture math | Pixels relative to the viewport element.                                                        |

`viewport.scale` is a multiplier on top of cover-fit: `scale = 1` is the
smallest scale that fully covers the viewport (`object-fit: cover`
math), so `minScale: 1` means "can't zoom out past filling the screen".
The world's size comes from the largest layer sprite's own
`width`/`height` unless overridden via `viewport.worldSize`.

## Step 1 — engine and base layer

```vue
<template>
	<MapEngine :engine="engine" />
</template>

<script setup>
import baseSprite from '~/assets/map/0-base.svg?raw';

const engine = useMapEngine({
	viewport: {
		center: { x: 0.5, y: 0.42 },
		scale: 1.5,
		maxScale: 30,
	},
});

engine.layers.push(useMapLayer({ name: 'base', sprite: baseSprite }));
</script>

<style>
.c-map-engine {
	position: fixed;
	inset: 0;
	width: 100vw;
	/* 100vh on iOS Safari is the large viewport — its bottom strip hides
	   behind the collapsible toolbar */
	height: 100vh;
	height: 100dvh;
	cursor: grab;

	&:active {
		cursor: grabbing;
	}
}
</style>
```

Sprites are raw SVG strings (`?raw` imports here; a CMS would deliver
them as strings too). A layer without a `label` is always visible.

The `viewport` option is the editor-defined starting view — the engine
has no per-map config store, so the consuming app loads whatever its CMS
saved and passes it in here. All fields are optional; see
[`useMapViewport`](./use-map-viewport.md) for the full list, including
`wheelSensitivity` and `momentum` (the two input-feel knobs).

This already pans (drag, with a momentum glide on release) and zooms
(wheel, trackpad pinch, touch pinch — all gestures ship
with [`MapViewport`](./map-viewport.md), which `MapEngine` renders
internally).

## Step 2 — detail layers and zoom thresholds

Layers can fade in/out against zoom via `minScale`/`maxScale` (+
`scaleFeather`, the fade band's width in scale units) — the standard
pattern for detail that would be noise when zoomed out:

```js
import detailsSprite from '~/assets/map/1-details.svg?raw';

engine.layers.push(
	useMapLayer({
		name: 'details',
		sprite: detailsSprite,
		minScale: 5, // fades in around scale 5 (from 4 to 6 with feather 1)
	})
);
```

Line weights and markers inside a sprite counter-scale against zoom
(strength set by `scaleFactor`, `0` = constant screen size, `1` = scales
with the map) so a road doesn't become a ribbon at high zoom. That — and
the `scale_` id convention that drives it — is authored in the SVG
itself; see [Sprite authoring](./sprite-authoring.md).

## Step 3 — floors

Floors are ids + labels, authored explicitly because **their array order
is the floor switcher's display order**:

```js
import floor0 from '~/assets/map/floors/floor-0.svg?raw';
import floor1 from '~/assets/map/floors/floor-1.svg?raw';

for (const [id, label] of [
	['0', 'st'],
	['1', '1'],
]) {
	engine.floors.push(useMapFloor({ id, label }));
}

for (const [floor, sprite] of [
	['0', floor0],
	['1', floor1],
]) {
	engine.layers.push(
		useMapLayer({
			name: `floor-${floor}`,
			sprite,
			floor, // references IFloor.id
			minScale: 5.25, // floor plans only appear zoomed in
		})
	);
}

engine.selectFloor(engine.floors[0]);
```

A layer with a `floor` renders only while that floor is selected; a
layer without one shows on every floor. `engine.getAvailableFloors()`
returns the floors whose layers are in range at the current zoom — the
switcher UI renders from it and disappears naturally when zoomed out
(the engine resets to the first floor when that happens, so it never
silently reappears on some other floor).

## Step 4 — points and the pin slot

Points are data; the marker is yours, rendered once per point through
the `#point` slot inside a positioned [`<MapPoint>`](./map-point.md)
wrapper:

```vue
<template>
	<MapEngine :engine="engine">
		<template #point="{ point }">
			<MyMapPin :point="point" :engine="engine" />
		</template>
	</MapEngine>
</template>
```

```js
engine.points.push(
	useMapPoint({
		id: 'cafe', // stable — referenced by URL sync
		label: 'Café',
		tags: ['Coffee', 'Break'], // search synonyms, never displayed
		x: 14311, // world-pixel space (the SVG's own units)
		y: 13682,
		content: {
			// opaque to the engine — your own shape (see step 6)
			blocks: [{ alias: 'richText', text: '…' }],
		},
	})
);
```

Inside the slot, read state straight off the point:
`point.selectedAsDestination` (highlighted), `point.selectedAsOrigin`
(wayfinding origin), `point.label`. A minimal pin:

```vue
<!-- MyMapPin.vue -->
<template>
	<button
		:class="[
			'my-map-pin',
			{ 'my-map-pin--selected': point.selectedAsDestination },
		]"
		type="button"
	>
		{{ point.label }}
	</button>
</template>

<script setup>
defineProps({
	point: { type: Object, required: true },
	engine: { type: Object, required: true },
});
</script>
```

Clicks are handled by the `<MapPoint>` wrapper: the first click on a
clickable point selects it (highlight + an animated `zoomTo` framing at
`engine.focusScale`), a second click triggers your `onActivatePoint`
(step 6). Points can be:

- **Tied to a layer** (`layer: 'floor-1'`) — shown only while that layer
  is shown (floor selection, toggle state, zoom range). Selecting such a
  point reveals its layer first (switches floor, force-shows a toggled
  layer, zooms into range).
- **Non-clickable** (`clickable: false`) — decorative markers excluded
  from selection, search, and grouping.
- **Anchored differently** (`anchor: { x: 0.5, y: 0.5 }`) — where in the
  marker's own box the coordinate sits; default is bottom-center (a pin
  tip).

## Step 5 — groups, search, and toggleable layers

These three are independent filters; none clears the others (with one
deliberate exception noted below).

**Groups** are cross-layer POI filters with a pill color:

```js
engine.groups.push(
	useMapGroup({ id: 'food', label: 'Food & drink', color: '#c0935f' })
);
// membership is authored on the point: useMapPoint({ groups: ['food'], … })
```

`engine.selectGroup(group)` filters the map to the group's points and
frames them (`fitToPoints`); `engine.toggleGroup(group)` is the
pill-friendly variant that deselects on the second click. Members bypass
their layer gate — a group reveals every point it contains. Selecting a
group clears any point selection (the one cross-clear: the framing would
otherwise strand a selection off-screen). Render pills from
`engine.groups`, counts from `engine.getGroupPoints(group).length`.

**Search** is a plain synchronous call, label matches first:

```js
const results = engine.searchPoints(query); // IPoint[]
```

Matching is Danish-aware (æ/ø/å and diacritics normalized) via the
exported `normalizeSearchText` — reuse it for any custom matching UI.

**Toggleable layers** are layers with a `label` (that's the whole rule —
labeled means toggleable, starts hidden unless `enabled: true`):

```js
engine.layers.push(
	useMapLayer({
		name: 'parking',
		sprite: parkingSprite,
		label: 'Parking', // makes it a toggleable pill
		color: '#08AFE6',
	})
);
// pills render from engine.getToggleableLayers(); flip with engine.toggleLayer(layer)
```

## Step 6 — activation and a content overlay

The engine has no notion of what a point's content _is_ — `content` is
an opaque payload, and `onActivatePoint` is the only hook into "the user
clicked an already-selected point":

```js
const openPoint = ref(null);

const engine = useMapEngine({
	onActivatePoint(point) {
		const { content } = point;

		if (content?.blocks?.length) {
			openPoint.value = point; // open our overlay panel
		} else if (content?.link) {
			window.open(content.link.url, content.link.target ?? '_self');
		}
	},
});
```

The overlay itself is your UI, rendered into the `#overlay` slot —
screen-space, stacked above the points, `pointer-events: none` on the
container with `auto` restored on its direct children so empty regions
still pan the map:

```vue
<template #overlay>
	<MySearchField :engine="engine" />
	<MyGroupPills :engine="engine" />
	<MyContentPanel :point="openPoint" @close="openPoint = null" />
</template>
```

The playground's [`MapContentOverlay`](./map-content-overlay.md) is a
complete reference implementation of the sliding panel, including
re-framing the focused point into the strip the panel leaves visible.

## Step 7 — shareable URLs

Call [`useMapUrlSync`](./use-map-url-sync.md) **last**, after every
layer/point/group/floor is pushed and defaults like
`engine.selectFloor(...)` are applied — the engine's state at that
moment becomes the baseline, and only state diverging from it is ever
written to the URL:

```js
useMapUrlSync(engine);
```

That gives you `?x=…&y=…&z=…&floor=…&group=…&point=…&origin=…&layers=…`
— all optional and independent, applied on load and kept in sync
(debounced, `history.replaceState`, no history spam). A CMS deep link
only needs the params it cares about: `?group=food` is a complete link.

## Step 8 — wayfinding (optional)

`engine.selectOriginPoint(point)` sets the "where are you now?" origin.
Once both a destination and an origin are selected, the map narrows to
exactly those two points, frames them together, and force-shows the
`kind: 'walking-routes'` layer if one exists. Clearing either side
restores normal visibility. The playground's search UI demonstrates the
"Hvor står du nu?" flow that drives it.

## Checklist for a real integration

- Size `.c-map-engine` yourself (it has no intrinsic size); remember the
  `100dvh` iOS fallback and `overscroll-behavior: none` on the page.
- Author sprites to the conventions in
  [Sprite authoring](./sprite-authoring.md) — the engine's scaling and
  stroke behavior depends on them.
- Keep point `id`s, layer `name`s, group `id`s, and floor `id`s stable —
  URLs reference all of them.
- Push floors in display order; push layers in paint order (first =
  bottom).
- Call `useMapUrlSync` after all authoring is done.
- Read [Performance](./performance.md) before wrapping the map in your
  own reactive UI.
