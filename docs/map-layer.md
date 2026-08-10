# `<MapLayer>`

Rendered internally by [`<MapEngine>`](./map-engine.md), one per entry in
`engine.layers`.

## Props

| Prop     | Type      | Description                                                                                       |
| -------- | --------- | ------------------------------------------------------------------------------------------------- |
| `layer`  | `ILayer`  | The layer to render.                                                                              |
| `engine` | `IEngine` | Read for `selectedFloor`, `viewport.scale`, and the fade easing (`engine.focusAnimation.easing`). |

## Rendering: sprites live in a ShadowRoot

The sprite `<svg>` is mounted inside a ShadowRoot on the
`.c-map-layer-transition` wrapper, together with the engine's own sprite
stylesheet — isolating it from the consuming site's CSS so that
`--viewport-scale` steps during zoom re-match only a handful of rules
per node instead of the whole site stylesheet (see
[Performance](./performance.md)). Consequences:

- Site CSS cannot target sprite internals; per-layer styling hooks go on
  the light-DOM wrapper (see CSS hooks below). Custom properties still
  inherit through the boundary.
- The sprite is not part of SSR HTML — it mounts client-side.
- Tests asserting on sprite internals must query through
  `element.shadowRoot` (see `findSprite` in
  `test/components/MapLayer.spec.ts`).

## Visibility

A layer is in the DOM only while
`(layer.visible || layer.forceVisible)` **and** its `floor` (if set)
matches `engine.selectedFloor`. Hidden layers are actually removed —
appear/disappear runs through a JS-driven opacity tween (see below), not
a CSS transition.

On top of that, `sprite.minScale`/`maxScale`/`scaleFeather` drive a
continuous opacity ramp against `viewport.scale`, so detail layers fade
in as the user zooms past their threshold.

## Fade duration

The enter/leave fade is driven frame-by-frame in JS (a CSS transition
here triggers an iOS Safari compositing bug while the viewport is
mid-transform), but its duration stays CSS-configurable:

```css
[data-layer-kind='building-highlight'] {
	--map-layer-transition-duration: 150ms;
}
```

The easing is fixed to `engine.focusAnimation.easing`.

## Sprite behavior hooks

- Elements with `id*="scale_"` counter-scale against zoom (strength from
  `sprite.scaleFactor`, pivot from `sprite.scaleOrigin`).
- `stroke`/`stroke-width` attributes are counter-scaled so line weights
  hold their screen size.
- Per-element overrides: `data-scale-origin` and `data-scale-factor`
  authored directly in the SVG — see
  [`useMapSprite`](./use-map-sprite.md#per-element-overrides-data-scale-origin-data-scale-factor).

## CSS hooks

`c-map-layer-transition` — the faded wrapper and ShadowRoot host,
carrying `data-layer-name`/`data-layer-kind` for per-layer selectors.
This is the only element site CSS can reach; the `c-map-layer` `<svg>`
itself lives inside the ShadowRoot. Values that need to reach the sprite
(e.g. a custom property consumed by authored SVG content) can be set on
the wrapper and inherit through.
