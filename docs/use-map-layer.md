# `useMapLayer`

```ts
const layer = useMapLayer(options: ILayerOptions);
engine.layers.push(layer);
```

Creates one `ILayer` (a base layer, an optional information layer, or a
building-highlight/walking-routes helper layer) from raw SVG data. Push
the result onto `engine.layers` yourself — the engine doesn't create
layers on your behalf.

## Options (`ILayerOptions`)

| Option         | Type        | Default     | Description                                                                                                                                                                                                                                                             |
| -------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `string`    | _required_  | Unique layer identifier. Used to match building-highlight layers to `IPoint.buildings` entries, and by `useMapUrlSync` to reference toggleable layers in the URL — must be stable and unique across `engine.layers`.                                                    |
| `sprite`       | `string`    | _required_  | Raw SVG markup for the layer, passed through to `useMapSprite`.                                                                                                                                                                                                         |
| `label`        | `string`    | `undefined` | If set, this layer is toggleable — it shows up as a filter pill (SoW §3.5) and participates in `engine.toggleLayer`/`getToggleableLayers`. Layers without a label are always visible (subject to `floor`) and can't be toggled by the user.                             |
| `color`        | `string`    | `undefined` | Author-supplied CSS color for the layer's filter pill, if `label` is set.                                                                                                                                                                                               |
| `enabled`      | `boolean`   | `false`     | Initial toggle state — **only applies to labeled layers** (and is ignored for `kind: 'building-highlight'`, which always starts closed regardless of `label`). Unlabeled layers ignore this and are always visible.                                                     |
| `kind`         | `LayerKind` | `undefined` | Marks special-purpose layers. `walking-routes` is force-shown while pseudo-wayfinding has both an origin and destination selected. `building-highlight` layers are matched to points by `name` and force-shown while a point naming that building is selected/origin.   |
| `floor`        | `string`    | `undefined` | References an [`IFloor.id`](./use-map-floor.md) — restricts the layer to that floor, only visible while `engine.selectedFloor` matches. Also what `engine.getAvailableFloors()` derives its available subset from (combined with `sprite.minScale`).                    |
| `minScale`     | `number`    | `undefined` | Forwarded to `useMapSprite` — the scale below which this layer fades out (see [`useMapSprite`](./use-map-sprite.md)).                                                                                                                                                   |
| `maxScale`     | `number`    | `undefined` | Forwarded to `useMapSprite` — the scale above which this layer fades out.                                                                                                                                                                                               |
| `scaleFeather` | `number`    | `1`         | Forwarded to `useMapSprite` — the fade transition width around `minScale`/`maxScale`.                                                                                                                                                                                   |
| `scaleFactor`  | `number`    | `1`         | Forwarded to `useMapSprite` — how strongly this layer's stroke widths/markers counter-scale against zoom (`0` = fully counter-scaled/constant screen size, `1` = scales with the map).                                                                                  |
| `scaleOrigin`  | `string`    | `'center'`  | Forwarded to `useMapSprite` — the `transform-origin` used by this layer's `scale_` elements when counter-scaling (see [`useMapSprite`](./use-map-sprite.md#options-ispriteoptions)). Individual elements can override this via `data-scale-origin` directly in the SVG. |
| `counterScaleFrom` | `number` | `undefined` | Forwarded to `useMapSprite` — the viewport scale where this layer's counter-scaling starts; zoomed out past it, the layer's marks scale with the map instead of growing relative to it (see [`useMapSprite`](./use-map-sprite.md)). |

## Runtime-only fields (not options)

`ILayer.visible` and `ILayer.forceVisible` are mutated at runtime (by
`engine.toggleLayer` and the wayfinding/building-highlight logic
respectively) — there's no way to author `forceVisible`, and `visible`'s
initial value is derived from `label`/`enabled`/`kind` as described above,
not settable directly.

`engine.getToggleableLayers()` returns `IToggleableLayer[]` — `ILayer`
with `label` narrowed to `string` (rather than `string | undefined`),
since that's exactly what the filter guarantees. Use this type instead of
`ILayer` when binding a toggleable layer's `label` to something that
requires a defined `string`, e.g. a pill component's prop.
