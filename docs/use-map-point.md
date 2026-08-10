# `useMapPoint`

```ts
const point = useMapPoint(options: IPointOptions);
engine.points.push(point);
```

Creates one `IPoint` (a POI). Push the result onto `engine.points`
yourself — the engine doesn't create points on your behalf.

## Options (`IPointOptions`)

| Option      | Type       | Default     | Description                                                                                                                                                                                                                                        |
| ----------- | ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `string`   | _required_  | Stable, unique identifier. Required so `useMapUrlSync` can reference a selected/origin point in the URL without relying on array index (which shifts if points are added, removed, or reordered).                                                  |
| `label`     | `string`   | _required_  | POI name/title. Shown on clickable pins and searched by `engine.searchPoints`.                                                                                                                                                                     |
| `tags`      | `string[]` | `[]`        | Synonyms/alternative spellings matched by `engine.searchPoints` (SoW §3.6) — not shown to the user, only `label` is displayed in results.                                                                                                          |
| `groups`    | `string[]` | `[]`        | `IGroup.id` values this point belongs to (SoW §3.5) — matched against `engine.groups`, consumed by `engine.getGroupPoints`/`isPointInGroup`.                                                                                                       |
| `buildings` | `string[]` | `[]`        | Names of `kind: 'building-highlight'` layers (see `ILayer.name`) to force-show while this point is selected as destination or origin.                                                                                                              |
| `content`   | `unknown`  | `undefined` | Opaque, consumer-defined payload — the engine never reads its shape. Put whatever your site needs here (content-overlay blocks, a link, an icon, anything) and interpret it yourself in your own UI.                                               |
| `clickable` | `boolean`  | `true`      | Whether the point takes part in selection highlighting, `engine.searchPoints`, and grouping (SoW §3.3's bare icons author this `false`). No longer derived from `content`/`link`/`icon` — always author it explicitly for non-interactive markers. |
| `anchor`    | `IVector`  | `undefined` | Transform anchor for the rendered marker, in `[0, 1]` of its own box. Unset keeps the pin's default bottom-center (`{ x: 0.5, y: 1 }`); a bare, centered icon would author `{ x: 0.5, y: 0.5 }`.                                                   |
| `x`         | `number`   | `0`         | Position X in world-pixel space (`IPoint.position.x`).                                                                                                                                                                                             |
| `y`         | `number`   | `0`         | Position Y in world-pixel space.                                                                                                                                                                                                                   |
| `visible`   | `boolean`  | `true`      | Initial visibility. Independent of layer/floor filtering and of the "hidden while a group filter excludes it" behavior driven by `engine.selectedGroup` — this only seeds the point's own `IPoint.visible` flag.                                   |

## Runtime-only fields (not options)

`IPoint.selectedAsDestination` and `.selectedAsOrigin` are the single
sources of truth for selection/wayfinding-origin state and are mutated
only through `engine.selectPoint` and `engine.selectOriginPoint` — there
is no way to author a point as pre-selected.

## Content and activation

The engine has no notion of what `IPoint.content` is or what activating a
point does — see [`useMapEngine`](./use-map-engine.md)'s
`onActivatePoint` option and `engine.activatePoint`. `IPoint.clickable`
(above) is the only thing that gates selection/search/grouping; there is
no derived "clickability" helper anymore (previously `isPointClickable`,
now removed — author `clickable` directly instead).
