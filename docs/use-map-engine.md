# `useMapEngine`

```ts
// Auto-imported by Nuxt once the module is installed — no import needed
const engine = useMapEngine(options?: IEngineOptions);
```

Creates the single `IEngine` reactive root — `viewport`, `layers`,
`points`, `groups`, `floors`, `selectedFloor`, `selectedGroup`, plus the
engine-level actions (`selectPoint`, `activatePoint`, `selectFloor`,
`selectGroup`, `toggleLayer`, ...). Pass it down as `:engine="engine"` to
`<MapEngine>`.

`engine.layers`, `engine.points`, `engine.groups`, and `engine.floors`
start as empty arrays — push `useMapLayer`/`useMapPoint`/`useMapGroup`/
`useMapFloor` results onto them after construction (see those
composables' docs).

## Options (`IEngineOptions`)

| Option            | Type                               | Default            | Description                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `viewport`        | `Omit<IViewportOptions, 'layers'>` | `{}`               | Forwarded to the internal `useMapViewport` call — see [`useMapViewport`](./use-map-viewport.md) for every field. `layers` is supplied internally from `engine.layers` and can't be overridden here.                                                                                                                            |
| `focusScale`      | `number`                           | `5`                | Zoom level a focused POI is framed at — used by `selectPoint`, and as the `maxScale` cap on the wayfinding and group `fitToPoints` framings. Exposed (and mutable) at runtime as `engine.focusScale`.                                                                                                                          |
| `focusAnimation`  | `{ duration?, easing? }`           | 750&nbsp;ms spring | Tween used for those framing moves. Unset fields keep their defaults (the Figma motion spec's spring, matching the playground content overlay's CSS slide). Exposed at runtime as `engine.focusAnimation` with both fields resolved.                                                                                           |
| `onActivatePoint` | `(point: IPoint) => void`          | `undefined`        | Called when `engine.activatePoint`'s second click hits an already-selected clickable point. The engine has no notion of what a point's content is or what activating it should do — this is the only hook into that gesture; unset means the second click does nothing beyond the selection the first click already performed. |

## Runtime state (`IEngine`)

Everything on the returned object is reactive — read it directly in
templates and computeds:

| Field            | Type                    | Description                                                                                                                                      |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `viewport`       | `IViewport`             | The pan/zoom state and camera API — see [`useMapViewport`](./use-map-viewport.md).                                                               |
| `layers`         | `ILayer[]`              | Push order is paint order (first = bottom).                                                                                                      |
| `points`         | `IPoint[]`              | Selection state lives on the points themselves (`selectedAsDestination` / `selectedAsOrigin`) — derive "what's selected" by scanning this array. |
| `groups`         | `IGroup[]`              | Authored filter groups.                                                                                                                          |
| `floors`         | `IFloor[]`              | Authored order = floor-switcher display order.                                                                                                   |
| `selectedFloor`  | `IFloor \| null`        | Single-select; mutate via `selectFloor`.                                                                                                         |
| `selectedGroup`  | `IGroup \| null`        | Single-select; mutate via `selectGroup`/`toggleGroup`.                                                                                           |
| `focusScale`     | `number`                | Zoom level focused POIs are framed at; mutable at runtime.                                                                                       |
| `focusAnimation` | `IEngineFocusAnimation` | The resolved framing tween (`duration` + `easing`, both always present) — reuse it for camera moves that should match the selection framing.     |

## Actions

| Action                             | Description                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectPoint(point \| null)`       | Selects (highlights + frames) a point, revealing its layer first (floor switch / force-show / zoom into range); `null` clears. Clears any origin pairing.           |
| `activatePoint(point)`             | Click semantics: first call selects, a second call on the already-selected point invokes `onActivatePoint`. Ignores non-clickable points.                           |
| `selectOriginPoint(point \| null)` | Sets the pseudo-wayfinding origin; with a destination also selected, narrows the map to the two endpoints, frames both, and force-shows the `walking-routes` layer. |
| `searchPoints(query)`              | Returns matching clickable points, label matches before tag matches, Danish-normalized.                                                                             |
| `selectFloor(floor \| null)`       | Plain single-select of `selectedFloor`.                                                                                                                             |
| `getAvailableFloors()`             | Floors whose layers are in zoom range right now, in authored order — render the switcher from this.                                                                 |
| `selectGroup(group \| null)`       | Selects a group: filters points, frames the members, clears point selection. `toggleGroup(group)` is the pill-friendly select/deselect cycle.                       |
| `getGroupPoints(group)`            | The group's clickable member points (drives pill counts).                                                                                                           |
| `toggleLayer(layer)`               | Flips a layer's `visible` flag.                                                                                                                                     |
| `getToggleableLayers()`            | The labeled layers (`IToggleableLayer[]`) — render layer pills from this.                                                                                           |
| `isLayerVisible(name)`             | Whether the named layer is currently shown (visibility + floor + zoom range) — the same gate that hides points tied to a layer. Unknown names return `true`.        |

### Example — editor-configured starting view (SoW §3.2)

```ts
const engine = useMapEngine({
	viewport: {
		center: { x: 0.42, y: 0.58 },
		scale: 3,
		maxScale: 30,
	},
});
```

This is the mechanism a CMS-driven "starting zoom level" editor field
would call into — the engine itself has no per-map config store, so the
consuming app is responsible for loading a specific map's saved
center/scale/etc. and passing them in here.

### Example — deciding what a second click does

```ts
const openPoint = ref<IPoint | null>(null);

const engine = useMapEngine({
	onActivatePoint(point) {
		const content = point.content as MyPointContent | undefined;

		if (content?.blocks?.length) {
			openPoint.value = point;
		} else if (content?.link) {
			window.open(content.link.url, content.link.target ?? '_self');
		}
	},
});
```

`point.content` is opaque to the engine (see [`useMapPoint`](./use-map-point.md))
— this is entirely the consumer's own payload shape and decision logic;
the playground's `playground/app.vue`/`playground/types.ts` is one example,
not a prescribed contract.

If `useMapUrlSync` is also in use, URL query params (if present) are
applied on top of this initial view once the engine, its points, and its
layers are fully populated — see [`useMapUrlSync`](./use-map-url-sync.md).
