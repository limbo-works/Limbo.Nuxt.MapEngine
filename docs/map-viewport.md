# `<MapViewport>`

Rendered internally by [`<MapEngine>`](./map-engine.md) — you don't place
it yourself, but its gesture behavior and CSS custom properties are part
of the public surface.

## Props

| Prop       | Type        | Description                                                                                                                                     |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`   | `IEngine`   | Registers its element as the viewport's size reference (`viewport.setElement`) on mount.                                                        |
| `gestures` | `IGestures` | The recognizer, created by `<MapEngine>`. This component binds it and registers its element as the recognizer's measuring stick (`setElement`). |

## Gestures

Gesture recognition itself lives in
[`useMapGestures`](./use-map-gestures.md), not in this component — see
there for pan/pinch/wheel/momentum behavior and the deferred pointer
capture that keeps POI taps working.

This component is one of two bind sites for that recognizer;
[`<MapEngine>`](./map-engine.md) binds the same instance on the points
overlay so gestures starting on a pin behave identically. It owns the
recognizer's element: pointer positions are measured against
`.c-map-viewport`'s bounding rect regardless of which element the event
came from, since the two share their geometry exactly.

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
