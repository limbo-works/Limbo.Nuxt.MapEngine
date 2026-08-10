# `useMapUrlSync`

```ts
// Auto-imported by Nuxt once the module is installed — no import needed
const engine = useMapEngine({ /* ... */ });
// ... push layers/points/groups/floors onto engine, call
// engine.selectFloor(engine.floors[0]), etc ...

useMapUrlSync(engine, options?: IUrlSyncOptions);
```

Opt-in URL syncing (SoW §3.2: _"share a specific view ... by copying the
map's URL"_, issue #3). Not part of `useMapEngine` itself — call it
explicitly once the engine's layers, points, and groups are fully
populated and any consumer-side defaults (`engine.selectFloor(0)`, an
initial `useMapEngine({ viewport: {...} })`, etc.) have already been
applied. This ordering matters: whatever the engine looks like _at the
moment this composable runs_ becomes the baseline that "divergence" is
measured against — not the engine's bare just-constructed defaults, and
not whatever the URL restores it to.

On call, it:

1. Captures that baseline (viewport center/scale, selected floor/group,
   selected/origin point, and each toggleable layer's visibility).
2. Reads matching query params from `window.location.search` and applies
   them to the engine.
3. Watches the engine (debounced) and keeps the URL's query params in
   sync with whatever currently diverges from the baseline, via
   `history.replaceState` — no history entries are pushed, so back/forward
   navigation isn't affected by panning/zooming/selecting.

A property is only ever written to the URL while it differs from the
baseline captured in step 1. A page loaded with no query string at all
still reflects the consumer's own configured defaults exactly, and a
shared link never carries more state than the user actually changed.

SSR-safe: outside the browser (`typeof window === 'undefined'`) this is a
no-op that returns inert `pause`/`resume` functions.

## Options (`IUrlSyncOptions`)

| Option          | Type          | Default | Description                                                                                                                                                                                                                                 |
| --------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paramPrefix`   | `string`      | `''`    | Prepended to every query key below (e.g. `'map_'` → `map_x`, `map_floor`, ...). Use this if the map shares its page with other query params it shouldn't collide with.                                                                      |
| `debounce`      | `number` (ms) | `100`   | Quiet period after the last change before the URL is rewritten. Viewport `center`/`scale` mutate on every animation frame during a pan/zoom, so this exists to avoid `replaceState` spam mid-gesture — the URL settles once movement stops. |
| `syncViewport`  | `boolean`     | `true`  | Sync `center`/`scale` (the `x`/`y`/`z` params below).                                                                                                                                                                                       |
| `syncFloor`     | `boolean`     | `true`  | Sync `engine.selectedFloor` (the `floor` param).                                                                                                                                                                                            |
| `syncGroup`     | `boolean`     | `true`  | Sync `engine.selectedGroup` (the `group` param).                                                                                                                                                                                            |
| `syncSelection` | `boolean`     | `true`  | Sync selected point and origin point together (the `point`/`origin` params) — grouped because both resolve through the same point-`id` lookup.                                                                                              |
| `syncLayers`    | `boolean`     | `true`  | Sync toggleable-layer visibility (the `layers` param).                                                                                                                                                                                      |

## Return value (`IUrlSync`)

| Method     | Description                                                                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pause()`  | Stops writing further engine changes to the URL. Does not affect engine state, and doesn't un-apply anything already written. Useful around a burst of programmatic changes you don't want reflected in the address bar (e.g. a scripted intro tour). |
| `resume()` | Resumes writing.                                                                                                                                                                                                                                      |

## Query param format

All params are plain query-string keys (not a hash fragment), each
optional and independent — a URL only ever contains the keys whose state
diverges from the consumer's defaults:

| Param    | Meaning                                       | Format                                                                                                                                        |
| -------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `x`      | `viewport.center.x`                           | Number in `[0, 1]`, 4 decimal places (e.g. `0.4231`).                                                                                         |
| `y`      | `viewport.center.y`                           | Same as `x`.                                                                                                                                  |
| `z`      | `viewport.scale`                              | Number, 2 decimal places (e.g. `3.20`).                                                                                                       |
| `floor`  | `engine.selectedFloor`                        | The floor's `IFloor.id`, or empty string (`floor=`) for an explicit `null` (only appears if the baseline floor was non-null and got cleared). |
| `group`  | `engine.selectedGroup`                        | The group's `id`, or empty string for cleared.                                                                                                |
| `point`  | The selected (destination) point              | The point's `id`, or empty string for cleared.                                                                                                |
| `origin` | The pseudo-wayfinding origin point (SoW §4.1) | The point's `id`, or empty string for cleared.                                                                                                |
| `layers` | Toggleable layers whose visibility diverges   | Comma-separated `name:0` / `name:1` pairs, e.g. `layers=routes:1,parking:0`. Layer `name` must not contain `,` or `:`.                        |

Any `paramPrefix` is prepended directly to these key names with no
separator (`paramPrefix: 'map_'` → `map_x`, `map_floor`, ...).

### Example

A shared link for "floor 1, the walking-routes layer turned on, and POI
`cafeteria` selected, viewport otherwise unchanged from default":

```
https://example.com/map?floor=1&layers=routes:1&point=cafeteria
```

### Constructing links elsewhere (e.g. from a CMS)

Because every param is optional and independent, a CMS-generated deep
link only needs to set the params relevant to what it wants to
pre-select — e.g. a "waste sorting" CTA button could link straight to
`?group=cardboard` without needing to know or reproduce the map's other
default state.
