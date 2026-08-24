# `useMapSprite`

```ts
const sprite = useMapSprite(options: ISpriteOptions);
```

Parses raw SVG markup into an `ISprite` (attributes, inner children, and
scale-behavior config). You normally don't call this directly — it's
called internally by `useMapLayer` (for layer artwork) and `useMapPoint`
(for custom `icon` markup), which forward their own scale-related options
straight through to it (see [`useMapLayer`](./use-map-layer.md#options-ilayeroptions)
and [`useMapPoint`](./use-map-point.md#options-ipointoptions)).

## Options (`ISpriteOptions`)

| Option         | Type     | Default     | Description                                                                                                                                                                                                                                                                                                                           |
| -------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`         | `string` | _required_  | Raw `<svg>...</svg>` markup. Parsed into `attributes` (a plain record of the root `<svg>` tag's attributes, v-bindable as-is) and `children` (the inner markup) via regex — not a full XML parse, so the source should be a single well-formed `<svg>` root.                                                                          |
| `minScale`     | `number` | `undefined` | Viewport scale below which this sprite fades out (used for layers to hide detail layers when zoomed out, e.g. floor plans; also settable on point icons). `undefined` means no lower fade.                                                                                                                                            |
| `maxScale`     | `number` | `undefined` | Viewport scale above which this sprite fades out. `undefined` means no upper fade.                                                                                                                                                                                                                                                    |
| `scaleFeather` | `number` | `1`         | Width (in scale units) of the fade transition around `minScale`/`maxScale`. E.g. with `minScale: 5, scaleFeather: 1`, opacity ramps from `0` at scale `4` to `1` at scale `6`.                                                                                                                                                        |
| `scaleFactor`  | `number` | `1`         | How strongly stroke widths/markers inside this sprite counter-scale against zoom, via the `--scale-factor` CSS variable consumed by `MapLayer.vue`'s `<style>` block. `0` keeps strokes a constant screen size regardless of zoom; `1` lets them scale with the map like any other content.                                           |
| `scaleOrigin`  | `string` | `'center'`  | CSS `transform-origin` value used by every `id*="scale_"` element in this sprite when counter-scaling, via the `--scale-origin` CSS variable. `'center'` is right for symmetric marks (dots, labels); a directional mark (e.g. an arrow that should shrink toward its tip rather than its centroid) needs something else — see below. |
| `counterScaleFrom` | `number` | `undefined` | Viewport scale where counter-scaling starts. Below it the formula's viewport scale is clamped to this value, freezing `--scale` — the sprite's marks then simply scale with the map instead of growing relative to it as the user zooms further out. Use it when marks that look right zoomed in dominate the map at overview zoom. Unset means counter-scaling applies at every zoom. |

### Per-element overrides (`data-scale-origin`, `data-scale-factor`)

`scaleOrigin`/`scaleFactor` set one default for the whole sprite, but a
single sprite can contain a mix of `scale_` elements that need different
pivots or counter-scale strength (e.g. an entrance layer with both a
symmetric dot and a directional arrow sharing one SVG). For those, set
`data-scale-origin`/`data-scale-factor` attributes directly on the
individual element in the SVG markup — read once on mount and applied
as that element's own `transform-origin`/`--scale-factor` inline,
overriding the sprite-wide default just for that element:

```xml
<g id="scale_entrance-arrow-01" data-scale-origin="50% 100%" data-scale-factor="0">...</g>
```

`data-scale-factor` works because `--scale-factor` is a custom property:
setting it inline on the element re-resolves `--scale` (and everything
`[id*='scale_']` computes from it) using that element's own overridden
value instead of the one inherited from the layer root.

These exist because the `id` values that trigger `scale_` behavior are
authored by the SVG's consumer, not the package — so a per-element
override has to live in the SVG content itself rather than as a selector
hardcoded into `MapLayer.vue`.
