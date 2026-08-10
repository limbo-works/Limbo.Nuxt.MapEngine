# `<MapViewport>`

Rendered internally by [`<MapEngine>`](./map-engine.md) — you don't place
it yourself, but its gesture behavior and CSS custom properties are part
of the public surface.

## Props

| Prop     | Type      | Description                                                                              |
| -------- | --------- | ---------------------------------------------------------------------------------------- |
| `engine` | `IEngine` | Registers its element as the viewport's size reference (`viewport.setElement`) on mount. |

## Gestures

All input funnels into the shared `animateTo` path on `engine.viewport`:

- **Drag** pans 1:1 (`duration: 0`); release adds a capped momentum glide
  scaled by `IViewportOptions.momentum` (`0` disables it).
- **Two-finger pinch** zooms geometrically around the midpoint — the world
  point under the fingers stays under them, referenced to the gesture
  start so tracking error can't compound.
- **Wheel** zooms toward the cursor with a short ease;
  **ctrl+wheel/trackpad pinch** tracks directly (`duration: 0`). Both are
  scaled by `IViewportOptions.wheelSensitivity`.
- **Safari trackpad pinches** arrive as proprietary GestureEvents and are
  handled separately (deferring to pointer events when any are active).

## CSS custom properties

`.c-map-viewport__inner` carries exactly one custom property:

| Property           | Meaning                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `--viewport-scale` | `viewport.scale` (the multiplier on cover-fit), quantized to ~3% multiplicative steps while a zoom is in progress. |

`--viewport-scale` is what `MapLayer`'s stroke counter-scaling computes
from; it inherits into the sprite ShadowRoots. The pan/zoom transform
itself (and the plane's width/height) is written as **direct inline
styles**, not custom properties — inherited variables changing per frame
would force a style recalc of the whole sprite subtree against the
consuming site's stylesheet (see [Performance](./performance.md)). Read
positional state from `engine.viewport` in JS rather than from CSS.

## CSS hooks

`c-map-viewport` (absolute, full-size, `touch-action: none`) and
`c-map-viewport__inner` (the transformed plane).
